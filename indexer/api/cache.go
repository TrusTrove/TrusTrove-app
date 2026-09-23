package api

import (
	"context"
	"sync"
	"time"
)

// DefaultCacheTTL is the standard duration for which API responses are cached.
const DefaultCacheTTL = 30 * time.Second

// TTLCache provides a generic, thread-safe cache with a time-to-live.
type TTLCache[T any] struct {
	mu     sync.RWMutex
	data   T
	cached time.Time
	ttl    time.Duration
}

func NewTTLCache[T any](ttl time.Duration) *TTLCache[T] {
	return &TTLCache[T]{
		ttl: ttl,
	}
}

func (c *TTLCache[T]) GetOrUpdate(ctx context.Context, fetch func(context.Context) (T, error)) (T, error) {
	c.mu.RLock()
	if !c.cached.IsZero() && time.Since(c.cached) < c.ttl {
		data := c.data
		c.mu.RUnlock()
		return data, nil
	}
	c.mu.RUnlock()

	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.cached.IsZero() && time.Since(c.cached) < c.ttl {
		return c.data, nil
	}

	data, err := fetch(ctx)
	if err != nil {
		var zero T
		return zero, err
	}

	c.data = data
	c.cached = time.Now()
	return c.data, nil
}
