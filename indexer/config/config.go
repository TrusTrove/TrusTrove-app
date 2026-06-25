package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	StellarNetwork        string
	HorizonURL            string
	SorobanRPCURL         string
	NetworkPassphrase     string
	RegistryContractID    string
	InvoiceContractID     string
	PoolContractID        string
	EscrowContractID      string
	USDCIssuer            string
	USDCAssetCode         string
	DatabaseURL           string
	APIPort               string
	IndexerPollIntervalMs int
	JWTSecret             string
	JWTExpiryHours        int
}

func LoadConfig() (*Config, error) {
	// Try loading from parent directories or current directory
	_ = godotenv.Load("../.env.local")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env.local")
	_ = godotenv.Load(".env")

	missing := make([]string, 0)
	getRequired := func(name string) string {
		value := strings.TrimSpace(os.Getenv(name))
		if value == "" {
			missing = append(missing, name)
		}
		return value
	}

	pollIntervalMsStr := os.Getenv("INDEXER_POLL_INTERVAL_MS")
	pollIntervalMs := 5000
	if pollIntervalMsStr != "" {
		if val, err := strconv.Atoi(pollIntervalMsStr); err == nil {
			pollIntervalMs = val
		}
	}

	jwtExpiryHoursStr := os.Getenv("JWT_EXPIRY_HOURS")
	jwtExpiryHours := 24
	if jwtExpiryHoursStr != "" {
		if val, err := strconv.Atoi(jwtExpiryHoursStr); err == nil {
			jwtExpiryHours = val
		}
	}

	apiPort := strings.TrimSpace(os.Getenv("API_PORT"))
	if apiPort == "" {
		apiPort = strings.TrimSpace(os.Getenv("PORT")) // Render provides PORT automatically
	}
	if apiPort == "" {
		apiPort = "8080"
	}

	cfg := &Config{
		StellarNetwork:        getRequired("NEXT_PUBLIC_STELLAR_NETWORK"),
		HorizonURL:            getRequired("NEXT_PUBLIC_HORIZON_URL"),
		SorobanRPCURL:         getRequired("NEXT_PUBLIC_SOROBAN_RPC_URL"),
		NetworkPassphrase:     getRequired("NEXT_PUBLIC_NETWORK_PASSPHRASE"),
		RegistryContractID:    getRequired("NEXT_PUBLIC_REGISTRY_CONTRACT_ID"),
		InvoiceContractID:     getRequired("NEXT_PUBLIC_INVOICE_CONTRACT_ID"),
		PoolContractID:        getRequired("NEXT_PUBLIC_POOL_CONTRACT_ID"),
		EscrowContractID:      getRequired("NEXT_PUBLIC_ESCROW_CONTRACT_ID"),
		USDCIssuer:            getRequired("NEXT_PUBLIC_USDC_ISSUER"),
		USDCAssetCode:         getRequired("NEXT_PUBLIC_USDC_ASSET_CODE"),
		DatabaseURL:           getRequired("DATABASE_URL"),
		APIPort:               apiPort,
		IndexerPollIntervalMs: pollIntervalMs,
		JWTSecret:             getRequired("JWT_SECRET"),
		JWTExpiryHours:        jwtExpiryHours,
	}

	if len(missing) > 0 {
		return nil, fmt.Errorf("missing required environment variables: %s; see .env.example", strings.Join(missing, ", "))
	}

	return cfg, nil
}
