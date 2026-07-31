# Security Policy

## Supported Versions

TrusTrove is currently in active development and deployed on Stellar testnet only.
No mainnet deployment exists. Smart contracts have not undergone a formal audit.

| Version         | Supported       |
| --------------- | --------------- |
| 0.1.x (testnet) | ✅              |
| mainnet         | ❌ Not deployed |

## Scope

TrusTrove is split across two repositories, each with its own security scope:

- **This repository ([TrusTrove-app](https://github.com/Maxwell316/TrusTrove-app))**
  covers the web frontend (`apps/web`), the indexer/API (`indexer/`), and the
  SDK (`packages/sdk`).
- **[TrusTrove-contract](https://github.com/Maxwell316/TrusTrove-contract)**
  covers the Soroban smart contracts (registry, invoice, escrow, pool).
  Report smart contract vulnerabilities there — see that repository's
  `SECURITY.md` for its reporting process.

The following are in scope for security reports in this repository:

- Authentication bypass or unauthorized access in the indexer/API
- Frontend issues that could cause users to sign unintended transactions
- SDK bugs that produce incorrect transaction construction or signing
- Indexer bugs that misreport on-chain state

The following are out of scope for this repository:

- Smart contract logic errors — report to [TrusTrove-contract](https://github.com/Maxwell316/TrusTrove-contract)
- Stellar protocol-level issues (report to SDF directly)
- Freighter wallet vulnerabilities (report to Freighter team)
- Testnet-only issues with no mainnet impact path
- UI cosmetic bugs

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities by emailing: **security@trusttrove.xyz**
(If this address is not yet active, open a private GitHub Security Advisory
via the Security tab on this repository.)

Include in your report:

- Description of the vulnerability
- Steps to reproduce
- Affected repository and component (e.g. `apps/web`, `indexer/`, `packages/sdk`)
- Potential impact
- Suggested fix if you have one

## Response Timeline

| Action             | Target Time      |
| ------------------ | ---------------- |
| Acknowledgement    | 48 hours         |
| Initial assessment | 5 business days  |
| Fix or mitigation  | 14 business days |

## Disclosure Policy

TrusTrove follows coordinated disclosure. We ask that you give us reasonable
time to assess and address a vulnerability before public disclosure.

We will credit researchers who report valid vulnerabilities in our changelog
unless they prefer to remain anonymous.

## Audit Status

The [TrusTrove-contract](https://github.com/Maxwell316/TrusTrove-contract)
smart contracts have not been formally audited.
Users interact with testnet contracts at their own risk.
A security audit is planned prior to any mainnet deployment.

## Important Notice

TrusTrove is experimental software. Do not deposit real funds.
All contracts operate on Stellar testnet with test USDC only.
