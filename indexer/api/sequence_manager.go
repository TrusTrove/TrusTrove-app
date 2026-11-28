package api

import (
	"context"
	"sync"
)

// sequenceManager assigns sequence numbers for the shared server account.
//
// Soroban's getAccount reports the account's last-applied sequence number,
// which can lag behind transactions that were just submitted but not yet
// included in a ledger. Reading it for every request therefore hands concurrent
// requests the same sequence number and all but one fail with tx_bad_seq
// (issue #940).
//
// sequenceManager reads the sequence from the network once, then hands out
// locally incremented values. If a submission fails the manager is invalidated,
// forcing the next caller to re-sync from getAccount before assigning another
// number so a partially allocated sequence cannot leave a permanent gap.
type sequenceManager struct {
	mu          sync.Mutex
	seq         int64
	initialized bool
}

// next returns the account sequence the next transaction should be built
// against, initializing from fetch on first use (or after invalidate). txnbuild
// increments this value when IncrementSequenceNum is set.
func (m *sequenceManager) next(ctx context.Context, fetch func(context.Context) (int64, error)) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.initialized {
		seq, err := fetch(ctx)
		if err != nil {
			return 0, err
		}
		m.seq = seq
		m.initialized = true
	}

	seq := m.seq
	m.seq++
	return seq, nil
}

// invalidate forces the next call to next to re-read the sequence from the
// network.
func (m *sequenceManager) invalidate() {
	m.mu.Lock()
	m.initialized = false
	m.mu.Unlock()
}
