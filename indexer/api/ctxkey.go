package api

import "context"

type ctxKey int

const (
	userAddressKey ctxKey = iota
)

// WithUserAddress returns a copy of parent context with the user address attached.
func WithUserAddress(ctx context.Context, addr string) context.Context {
	return context.WithValue(ctx, userAddressKey, addr)
}

// GetUserAddress extracts the user address from context if present and valid.
func GetUserAddress(ctx context.Context) (string, bool) {
	if ctx == nil {
		return "", false
	}
	addr, ok := ctx.Value(userAddressKey).(string)
	return addr, ok
}
