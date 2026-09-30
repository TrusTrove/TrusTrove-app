package webhooks

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"time"
)

// verifyTrusTroveSignature is the receiver-side check published in
// docs/webhooks.md ("Verifying signatures"). Keep the two copies identical;
// Example_verifySignature runs it against the worker's own signer.
const signatureTolerance = 5 * time.Minute

func verifyTrusTroveSignature(secret string, rawBody []byte, timestamp, signature string, now time.Time) bool {
	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return false
	}
	if age := now.Sub(time.Unix(ts, 0)); age > signatureTolerance || age < -signatureTolerance {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(rawBody)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func Example_verifySignature() {
	secret := "whsec_example"
	body := []byte(`{"event_id": "0021255638529081344-0000000001", "event_type": "invoice.created"}`)
	timestamp := "1790763125"
	sentAt := time.Unix(1790763125, 0)

	// Exactly what attemptDelivery puts in X-TrusTrove-Signature.
	signature := "sha256=" + sign(secret, timestamp, body)

	fmt.Println("valid:", verifyTrusTroveSignature(secret, body, timestamp, signature, sentAt))
	fmt.Println("5 minutes later:", verifyTrusTroveSignature(secret, body, timestamp, signature, sentAt.Add(5*time.Minute)))
	fmt.Println("stale:", verifyTrusTroveSignature(secret, body, timestamp, signature, sentAt.Add(5*time.Minute+time.Second)))
	fmt.Println("from the future:", verifyTrusTroveSignature(secret, body, timestamp, signature, sentAt.Add(-5*time.Minute-time.Second)))
	fmt.Println("tampered body:", verifyTrusTroveSignature(secret, append([]byte(" "), body...), timestamp, signature, sentAt))
	fmt.Println("wrong secret:", verifyTrusTroveSignature("whsec_other", body, timestamp, signature, sentAt))
	// Output:
	// valid: true
	// 5 minutes later: true
	// stale: false
	// from the future: false
	// tampered body: false
	// wrong secret: false
}
