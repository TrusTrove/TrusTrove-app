# Stellar Mainnet Setup and Support Status

## Product Decision on Mainnet Support

As of the current release, Stellar Mainnet is an experimental/upcoming target for the web application. While environment configuration (`NEXT_PUBLIC_STELLAR_NETWORK=mainnet`) is fully supported across network helpers, wallet connection gating, and transaction signing, full production deployment on Mainnet requires final security audits and contract migrations. This document details how to configure mainnet when ready.

## Configuration

| Aspect                 | Testnet                                                    | Mainnet                                                                                                 |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Network Name**       | `testnet`                                                  | `mainnet`                                                                                               |
| **Horizon URL**        | `https://horizon-testnet.stellar.org`                      | `https://horizon.stellar.org`                                                                           |
| **Stellar RPC URL**    | `https://soroban-testnet.stellar.org`                      | Provider URL (see [Stellar RPC providers](https://developers.stellar.org/docs/data/apis/rpc/providers)) |
| **Network Passphrase** | `Test SDF Network ; September 2015`                        | `Public Global Stellar Network ; September 2015`                                                        |
| **USDC Issuer**        | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`                                              |

The mainnet USDC issuer above is listed in [Circle's official USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).

Set the following environment variable in your `.env.local` or deployment platform:

Set the following environment variable in your `.env.local` or deployment platform:
| Aspect                 | Testnet                                                    | Mainnet                                                                                                 |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Network Name**       | `testnet`                                                  | `mainnet`                                                                                               |
| **Horizon URL**        | `https://horizon-testnet.stellar.org`                      | `https://horizon.stellar.org`                                                                           |
| **Stellar RPC URL**    | `https://soroban-testnet.stellar.org`                      | Provider URL (see [Stellar RPC providers](https://developers.stellar.org/docs/data/apis/rpc/providers)) |
| **Network Passphrase** | `Test SDF Network ; September 2015`                        | `Public Global Stellar Network ; September 2015`                                                        |
| **USDC Issuer**        | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`                                              |

The mainnet USDC issuer above is listed in [Circle's official USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).
   NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
   NEXT_PUBLIC_SOROBAN_RPC_URL=<your-mainnet-rpc-provider-url>
   NEXT_PUBLIC_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
   NEXT_PUBLIC_REGISTRY_CONTRACT_ID=<your-contract-id>
   NEXT_PUBLIC_INVOICE_CONTRACT_ID=<your-contract-id>
   NEXT_PUBLIC_ESCROW_CONTRACT_ID=<your-contract-id>
   NEXT_PUBLIC_POOL_CONTRACT_ID=<your-contract-id>
   NEXT_PUBLIC_USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
   NEXT_PUBLIC_USDC_ASSET_CODE=USDC
   NEXT_PUBLIC_API_BASE_URL=https://your-indexer-domain.com
   NEXT_PUBLIC_STELLAR_NETWORK=mainnet
   ```

NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
   NEXT_PUBLIC_SOROBAN_RPC_URL=<your-mainnet-rpc-provider-url>
   NEXT_PUBLIC_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
   NEXT_PUBLIC_REGISTRY_CONTRACT_ID=<your-contract-id>
   NEXT_PUBLIC_INVOICE_CONTRACT_ID=<your-contract-id>
   NEXT_PUBLIC_ESCROW_CONTRACT_ID=<your-contract-id>
   NEXT_PUBLIC_POOL_CONTRACT_ID=<your-contract-id>
   NEXT_PUBLIC_USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
   NEXT_PUBLIC_USDC_ASSET_CODE=USDC
   NEXT_PUBLIC_API_BASE_URL=https://your-indexer-domain.com
