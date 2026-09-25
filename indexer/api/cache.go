package api

import (
	"sync"
	"time"
)

type TTLCache struct {
	items map[string]cacheItem
	mu    sync.RWMutex
}

type cacheItem struct {
	value      interface{}
	expiration int64
}

func NewTTLCache() *TTLCache {
	return &TTLCache{
		items: make(map[string]cacheItem),
	}
}

func (c *TTLCache) Set(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = cacheItem{
		value:      value,
		expiration: time.Now().Add(ttl).UnixNano(),
	}
}

func (c *TTLCache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	item, found := c.items[key]
	if !found {
		return nil, false
	}
	if time.Now().UnixNano() > item.expiration {
		return nil, false
	}
	return item.value, true
}
