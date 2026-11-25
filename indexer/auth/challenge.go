// Package auth implements the indexer's SEP-10 style wallet authentication: it
// builds and verifies the signed challenge transaction and mints the session
// JWT. It is independent of HTTP transport.
package auth

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stellar/go-stellar-sdk/keypair"
	"github.com/stellar/go-stellar-sdk/txnbuild"
)

// ChallengeOperationName is the ManageData key that identifies a TrusTrove
// authentication challenge.
const ChallengeOperationName = "trusttrove auth"

// challengeTTL is how long a generated challenge may be redeemed. It matches
// the transaction's timebounds.
const challengeTTL = 15 * time.Minute

// nonceStore remembers challenge nonces until they are redeemed. A nonce is
// single-use: VerifyChallenge deletes it, so replaying a signed challenge is
// rejected even while its timebounds are still valid (#1079). The store is
// in-memory because the indexer runs as a single process; a multi-instance
// deployment would need a shared store at the same seam.
type nonceStore struct {
	mu      sync.Mutex
	expires map[string]time.Time
}

func newNonceStore() *nonceStore {
	return &nonceStore{expires: make(map[string]time.Time)}
}

var challengeNonces = newNonceStore()

// put records a freshly issued nonce, pruning entries that have already
// expired so an unauthenticated GET /auth loop cannot grow the map without
// bound.
func (s *nonceStore) put(nonce string, expiresAt time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for n, exp := range s.expires {
		if !now.Before(exp) {
			delete(s.expires, n)
		}
	}
	s.expires[nonce] = expiresAt
}

// consume removes nonce and reports whether it was known and unexpired. The
// delete and the lookup happen under one lock, so two concurrent submissions
// of the same signed challenge cannot both succeed.
func (s *nonceStore) consume(nonce string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	expiresAt, ok := s.expires[nonce]
	if !ok {
		return false
	}
	delete(s.expires, nonce)
	return time.Now().Before(expiresAt)
}

// GenerateChallenge constructs and signs a SEP-10 challenge transaction
func GenerateChallenge(serverKP *keypair.Full, clientAddr string, passphrase string) (string, error) {
	nonce := make([]byte, 48)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	nonceStr := base64.StdEncoding.EncodeToString(nonce)
	expiresAt := time.Now().Add(challengeTTL)

	tx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount: &txnbuild.SimpleAccount{
			AccountID: serverKP.Address(),
			Sequence:  0,
		},
		IncrementSequenceNum: false,
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions: txnbuild.Preconditions{
			TimeBounds: txnbuild.NewTimebounds(time.Now().Unix(), expiresAt.Unix()),
		},
		Operations: []txnbuild.Operation{
			&txnbuild.ManageData{
				SourceAccount: clientAddr,
				Name:          ChallengeOperationName,
				Value:         []byte(nonceStr[:64]),
			},
		},
	})
	if err != nil {
		return "", err
	}

	tx, err = tx.Sign(passphrase, serverKP)
	if err != nil {
		return "", err
	}

	signed, err := tx.Base64()
	if err != nil {
		return "", err
	}

	// Only remember the nonce once the challenge is actually issuable, so a
	// signing failure does not leave an unreachable entry behind.
	challengeNonces.put(nonceStr[:64], expiresAt)
	return signed, nil
}

// VerifyChallenge parses the signed transaction and checks the server and client signatures
func VerifyChallenge(signedXDR string, serverKP *keypair.Full, passphrase string) (string, error) {
	genericTx, err := txnbuild.TransactionFromXDR(signedXDR)
	if err != nil {
		return "", fmt.Errorf("failed to parse XDR: %w", err)
	}

	tx, ok := genericTx.Transaction()
	if !ok {
		return "", errors.New("invalid transaction type")
	}

	srcAcc := tx.SourceAccount()
	if srcAcc.AccountID != serverKP.Address() {
		return "", errors.New("invalid server source account")
	}

	if len(tx.Operations()) != 1 {
		return "", errors.New("must contain exactly one operation")
	}

	op, ok := tx.Operations()[0].(*txnbuild.ManageData)
	if !ok {
		return "", errors.New("operation must be ManageData")
	}

	clientAddr := op.SourceAccount
	if clientAddr == "" {
		return "", errors.New("client source account is empty")
	}

	if op.Name != ChallengeOperationName {
		return "", fmt.Errorf("invalid operation name: %s", op.Name)
	}

	nonce := string(op.Value)
	if nonce == "" {
		return "", errors.New("challenge nonce is missing")
	}

	tb := tx.Timebounds()
	if tb.MaxTime == 0 {
		return "", errors.New("timebounds must be set")
	}
	now := time.Now().Unix()
	if now < tb.MinTime || now > tb.MaxTime {
		return "", errors.New("challenge has expired or is not yet valid")
	}

	txHash, err := tx.Hash(passphrase)
	if err != nil {
		return "", fmt.Errorf("failed to get transaction hash: %w", err)
	}

	signatures := tx.Signatures()
	serverSigned := false
	clientSigned := false

	for _, sig := range signatures {
		serverKPCheck, _ := keypair.Parse(serverKP.Address())
		if err := serverKPCheck.Verify(txHash[:], sig.Signature); err == nil {
			serverSigned = true
			continue
		}

		clientKP, err := keypair.Parse(clientAddr)
		if err != nil {
			continue
		}
		if err := clientKP.Verify(txHash[:], sig.Signature); err == nil {
			clientSigned = true
		}
	}

	if !serverSigned {
		return "", errors.New("missing server signature")
	}
	if !clientSigned {
		return "", errors.New("missing client signature")
	}

	// Consume only after every other check passed: an invalid submission must
	// not be able to burn a legitimate challenge's nonce. consume() is atomic,
	// so two simultaneous redemptions of the same challenge yield one JWT.
	if !challengeNonces.consume(nonce) {
		return "", errors.New("challenge nonce is invalid, expired, or already used")
	}

	return clientAddr, nil
}

// GenerateJWT creates a JWT token signed by the server's secret
func GenerateJWT(address string, jwtSecret string, expiryHours int) (string, error) {
	claims := jwt.MapClaims{
		"sub": address,
		"exp": time.Now().Add(time.Duration(expiryHours) * time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}
