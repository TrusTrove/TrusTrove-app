package listener

import (
	"context"
	"trusttrove/indexer/config"
	"github.com/stellar/go-stellar-sdk/keypair"
)

type EventListener struct {
	cfg            *config.Config
	serverKP       *keypair.Full
	getPoolStatsFn func(context.Context, *config.Config, *keypair.Full) error
	dispatcher     interface{}
}

func NewEventListener(cfg *config.Config, serverKP *keypair.Full) *EventListener {
	return &EventListener{
		cfg:      cfg,
		serverKP: serverKP,
		getPoolStatsFn: func(ctx context.Context, c *config.Config, kp *keypair.Full) error {
			return nil
		},
	}
}
