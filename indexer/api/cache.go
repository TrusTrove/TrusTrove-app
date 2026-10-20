package api

import (
	"sync"
	"time"
)

type CacheItem struct {
	Value      interface{}
	Expiration int64
}

type TTLCache struct {
	items map[string]CacheItem
	mu    sync.RWMutex
}

func NewTTLCache() *TTLCache {
	return &TTLCache{
		items: make(map[string]CacheItem),
	}
}

func (c *TTLCache) Set(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = CacheItem{
		Value:      value,
		Expiration: time.Now().Add(ttl).UnixNano(),
	}
}

func (c *TTLCache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	item, found := c.items[key]
	c.mu.RUnlock()

	if !found {
		return nil, false
	}
	if time.Now().UnixNano() > item.Expiration {
		c.mu.Lock()
		delete(c.items, key)
		c.mu.Unlock()
		return nil, false
	}
	return item.Value, true
}
