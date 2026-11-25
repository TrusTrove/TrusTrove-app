# CLI Usage

`@trusttrove/cli` is the `trusttrove` command for reading TrusTrove contract and
indexer state from a terminal or script.

## Build and run

From the repository root:

```bash
pnpm install
pnpm --filter @trusttrove/cli build
node packages/cli/dist/index.js --help
```

When installed from a package, the binary is `trusttrove`.

## Commands

### `list-invoices`

Lists invoices from the invoice contract, filtered by exactly one of status or
issuer, and prints a table.

```bash
trusttrove list-invoices \
  --status Funded \
  --public-key G... \
  --contract-id C... \
  --network testnet
```

| Flag                  | Description                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `--status <status>`   | One of `Created`, `Listed`, `Funded`, `Active`, `Confirmed`, `Repaid`, `Defaulted` (case-insensitive). Mutually exclusive with `--issuer`. |
| `--issuer <address>`  | Issuer Stellar address. Mutually exclusive with `--status`.                                                                                |
| `--public-key <key>`  | Public key for the read-only simulation. Defaults to `TRUSTTROVE_PUBLIC_KEY`.                                                              |
| `--contract-id <id>`  | Invoice contract ID. Defaults to `INVOICE_CONTRACT_ID`.                                                                                    |
| `--network <network>` | `testnet` or `mainnet`. See [Network selection](#network-selection).                                                                       |
| `--rpc-url <url>`     | Custom Soroban RPC endpoint.                                                                                                               |
| `--json`              | Emit errors as structured JSON on stderr.                                                                                                  |

`--status` and `--issuer` are required, and passing both is an error. A filter
that matches nothing prints the header-only table and `No invoices found.`

### `check-pool-balance`

Prints the pool's total deposits, available liquidity, utilization, and
distributed yield.

```bash
trusttrove check-pool-balance \
  --public-key G... \
  --pool-contract-id C... \
  --network mainnet
```

| Flag                      | Description                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `--public-key <key>`      | Public key for the read-only simulation. Defaults to `TRUSTTROVE_PUBLIC_KEY`, `NEXT_PUBLIC_PUBLIC_KEY`, or `PUBLIC_KEY`.              |
| `--pool-contract-id <id>` | Pool contract ID. Defaults to `TRUSTTROVE_POOL_CONTRACT_ID`, `NEXT_PUBLIC_POOL_CONTRACT_ID`, `POOL_CONTRACT_ID`, then the SDK config. |
| `--network <network>`     | `testnet` or `mainnet`.                                                                                                               |
| `--rpc-url <url>`         | Custom Soroban RPC endpoint.                                                                                                          |
| `--json`                  | Emit errors as structured JSON on stderr.                                                                                             |

### `webhook-deliveries`

Lists recent delivery attempts for one webhook subscription. This command calls
the indexer API, not Soroban RPC, and requires a JWT for the subscription owner
(the same token the dashboard uses for `/webhooks`).

```bash
export TRUSTTROVE_API_TOKEN="<jwt>"
trusttrove webhook-deliveries \
  --subscription-id 00000000-0000-0000-0000-000000000001 \
  --limit 20
```

| Flag                       | Description                                                                       |
| -------------------------- | --------------------------------------------------------------------------------- |
| `--subscription-id <uuid>` | Subscription to inspect. Required.                                                |
| `--token <jwt>`            | JWT for the owner. Defaults to `TRUSTTROVE_API_TOKEN`.                            |
| `--api-url <url>`          | Indexer base URL. Defaults to `TRUSTTROVE_API_URL`, then `http://localhost:8080`. |
| `--limit <n>`              | Rows to request, `1`–`100` (default `20`).                                        |
| `--json`                   | Print `{ "data": [...] }` on stdout and errors as JSON on stderr.                 |

Each row shows the delivery `ID`, `EVENT`, `STATUS` (`pending`, `delivered`, or
`dead_letter`), `ATTEMPTS` (`used/max`), `LAST STATUS`, `NEXT RETRY` (only for
pending rows), and the last error. The command never prints destination URLs or
signing secrets, and URLs inside stored error messages are redacted. The backing
endpoint is `GET /webhooks/{id}/deliveries`; see the
[API reference](./openapi/README.md).

An empty subscription prints `No deliveries found.` A subscription that does not
exist or belongs to another token subject returns a not-found error, so the
command does not reveal whether an ID exists.

### `completion <shell>`

Prints a completion script generated from the live command definitions:

```bash
trusttrove completion bash
trusttrove completion zsh
trusttrove completion powershell
```

See [Shell completions](#shell-completions) for installation and a quick test.

## Network selection

Every read command accepts `--network` and `--rpc-url`. The selected network is
printed before the command's output:

```text
Network: testnet
RPC: https://soroban-testnet.stellar.org
```

Resolution order:

1. `--network` (with an optional `--rpc-url` for a provider endpoint).
2. `--rpc-url` alone, with the passphrase from
   `NEXT_PUBLIC_NETWORK_PASSPHRASE` or `NEXT_PUBLIC_STELLAR_NETWORK`.
3. Environment configuration (`NEXT_PUBLIC_*`), falling back to testnet.

Contradictory sources are rejected rather than silently resolved. Examples:

- `--network mainnet` with `NEXT_PUBLIC_STELLAR_NETWORK=testnet`.
- `--network mainnet` with a testnet passphrase in
  `NEXT_PUBLIC_NETWORK_PASSPHRASE`.
- `--network mainnet --rpc-url https://soroban-testnet.stellar.org`.
- An RPC endpoint whose known host belongs to a different network than the
  configured one.

`--network` takes precedence over `NEXT_PUBLIC_SOROBAN_RPC_URL`: switching
networks without `--rpc-url` always uses that network's public endpoint.

## Exit codes and `--json`

Automation can branch on the exit status without parsing messages:

| Code | Meaning                                                               |
| ---- | --------------------------------------------------------------------- |
| `0`  | Success.                                                              |
| `1`  | Usage or configuration error (bad flag, missing key, invalid ID).     |
| `2`  | Soroban RPC, Horizon, or indexer API failure.                         |
| `3`  | Authorization failure (missing, invalid, expired, or rejected token). |
| `4`  | Unexpected internal error.                                            |

With `--json`, errors are a single line on stderr:

```json
{
  "error": {
    "code": "AUTH_ERROR",
    "message": "The indexer API rejected the token (HTTP 401). Check --token or TRUSTTROVE_API_TOKEN.",
    "exitCode": 3
  }
}
```

URLs in error messages, and the `RPC:` header, are always redacted: userinfo,
query strings, and fragments become `***`, so provider API keys do not reach
logs. For example `https://rpc.example.com/v1?api_key=secret` is reported as
`https://rpc.example.com/v1?***`.

## Shell completions

Completion scripts are generated from the actual Commander command definitions,
so commands and flags added later appear after regenerating the script.

### Bash

Install for the current user:

```bash
mkdir -p ~/.local/share/bash-completion/completions
trusttrove completion bash > ~/.local/share/bash-completion/completions/trusttrove
```

Or load it for one shell:

```bash
source <(trusttrove completion bash)
```

Test it:

```bash
trusttrove li<TAB>                 # completes list-invoices
trusttrove list-invoices --st<TAB> # completes --status
trusttrove list-invoices --status <TAB> # suggests Created Listed Funded ...
```

### Zsh

Write it to a directory on `fpath` before `compinit` runs:

```zsh
mkdir -p ~/.zsh/completions
trusttrove completion zsh > ~/.zsh/completions/_trusttrove
```

Then in `~/.zshrc`, before `compinit`:

```zsh
fpath=(~/.zsh/completions $fpath)
autoload -Uz compinit && compinit
```

Test it in a new shell:

```zsh
trusttrove web<TAB>                 # completes webhook-deliveries
trusttrove webhook-deliveries --li<TAB> # completes --limit
```

### PowerShell

Load it for the current session:

```powershell
trusttrove completion powershell | Out-String | Invoke-Expression
```

To load it in every session, add the same line to `$PROFILE`:

```powershell
Add-Content -Path $PROFILE -Value 'trusttrove completion powershell | Out-String | Invoke-Expression'
```

Test it:

```powershell
trusttrove check<TAB>              # completes check-pool-balance
trusttrove check-pool-balance --net<TAB> # completes --network
```

The generated completion covers every command, its options, and the fixed value
sets for `--network` and `--status`.
