package config

import (
	"strings"
	"testing"

	"github.com/stellar/go-stellar-sdk/keypair"
)

var configEnvNames = []string{
	"APP_ENV",
	"STELLAR_NETWORK",
	"HORIZON_URL",
	"SOROBAN_RPC_URL",
	"NETWORK_PASSPHRASE",
	"REGISTRY_CONTRACT_ID",
	"INVOICE_CONTRACT_ID",
	"POOL_CONTRACT_ID",
	"ESCROW_CONTRACT_ID",
	"USDC_ISSUER",
	"USDC_ASSET_CODE",
	"DATABASE_URL",
	"JWT_SECRET",
	"SERVER_SEED",
	"INDEXER_POLL_INTERVAL_MS",
	"JWT_EXPIRY_HOURS",
	"API_PORT",
	"PORT",
	"ALLOWED_ORIGINS",
	"CORS_ALLOWED_ORIGINS",
	"RATE_LIMIT_RPS",
}

func setConfigEnv(t *testing.T, values map[string]string) {
	t.Helper()
	for _, name := range configEnvNames {
		t.Setenv(name, values[name])
	}
}

func requiredConfigEnv() map[string]string {
	return map[string]string{
		"STELLAR_NETWORK":      "testnet",
		"HORIZON_URL":          "https://horizon.example",
		"SOROBAN_RPC_URL":      "https://rpc.example",
		"NETWORK_PASSPHRASE":   "Test SDF Network ; September 2015",
		"REGISTRY_CONTRACT_ID": "registry",
		"INVOICE_CONTRACT_ID":  "invoice",
		"POOL_CONTRACT_ID":     "pool",
		"ESCROW_CONTRACT_ID":   "escrow",
		"USDC_ISSUER":          "issuer",
		"USDC_ASSET_CODE":      "USDC",
		"DATABASE_URL":         "postgres://localhost/test",
	}
}

func TestLoadConfig(t *testing.T) {
	tests := []struct {
		name    string
		env     map[string]string
		check   func(t *testing.T, cfg *Config)
		wantErr string
	}{
		{
			name: "explicit values",
			env: func() map[string]string {
				env := requiredConfigEnv()
				env["APP_ENV"] = "production"
				env["JWT_SECRET"] = "configured-secret"
				env["SERVER_SEED"] = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
				env["INDEXER_POLL_INTERVAL_MS"] = "2500"
				env["JWT_EXPIRY_HOURS"] = "12"
				env["API_PORT"] = "9000"
				env["ALLOWED_ORIGINS"] = " https://app.example,https://admin.example, "
				env["RATE_LIMIT_RPS"] = "25"
				return env
			}(),
			check: func(t *testing.T, cfg *Config) {
				if cfg.JWTSecret != "configured-secret" || cfg.JWTSecretGenerated {
					t.Errorf("JWT secret = %q, generated = %v; want configured secret and false", cfg.JWTSecret, cfg.JWTSecretGenerated)
				}
				if cfg.ServerSeedGenerated || cfg.ServerSeed == "" {
					t.Errorf("server seed generated = %v, seed = %q; want configured seed and false", cfg.ServerSeedGenerated, cfg.ServerSeed)
				}
				if cfg.IndexerPollIntervalMs != 2500 || cfg.JWTExpiryHours != 12 || cfg.APIPort != "9000" || cfg.RateLimitRPS != 25 {
					t.Errorf("parsed settings = (%d, %d, %q, %d); want (2500, 12, 9000, 25)", cfg.IndexerPollIntervalMs, cfg.JWTExpiryHours, cfg.APIPort, cfg.RateLimitRPS)
				}
				wantOrigins := []string{"https://app.example", "https://admin.example"}
				if strings.Join(cfg.CORSAllowedOrigins, ",") != strings.Join(wantOrigins, ",") {
					t.Errorf("origins = %v, want %v", cfg.CORSAllowedOrigins, wantOrigins)
				}
			},
		},
		{
			name: "development defaults and generated secrets",
			env:  requiredConfigEnv(),
			check: func(t *testing.T, cfg *Config) {
				if !cfg.JWTSecretGenerated || len(cfg.JWTSecret) != 64 {
					t.Errorf("JWT fallback = (%q, %v); want 64-character generated secret", cfg.JWTSecret, cfg.JWTSecretGenerated)
				}
				if _, err := keypair.Parse(cfg.ServerSeed); err != nil || !cfg.ServerSeedGenerated {
					t.Errorf("server seed = (%q, %v); want valid generated seed", cfg.ServerSeed, cfg.ServerSeedGenerated)
				}
				if cfg.IndexerPollIntervalMs != 5000 || cfg.JWTExpiryHours != 24 || cfg.APIPort != "8080" || cfg.RateLimitRPS != 10 {
					t.Errorf("defaults = (%d, %d, %q, %d); want (5000, 24, 8080, 10)", cfg.IndexerPollIntervalMs, cfg.JWTExpiryHours, cfg.APIPort, cfg.RateLimitRPS)
				}
				if len(cfg.CORSAllowedOrigins) != 1 || cfg.CORSAllowedOrigins[0] != "http://localhost:3000" {
					t.Errorf("default origins = %v, want localhost origin", cfg.CORSAllowedOrigins)
				}
			},
		},
		{
			name:    "production rejects missing required values",
			env:     map[string]string{"APP_ENV": "production"},
			wantErr: "missing required environment variables",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setConfigEnv(t, tt.env)

			cfg, err := LoadConfig()
			if tt.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("LoadConfig error = %v, want error containing %q", err, tt.wantErr)
				}
				if cfg != nil {
					t.Fatalf("LoadConfig config = %+v, want nil on error", cfg)
				}
				return
			}
			if err != nil {
				t.Fatalf("LoadConfig: %v", err)
			}
			tt.check(t, cfg)
		})
	}
}
