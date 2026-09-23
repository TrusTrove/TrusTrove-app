# TrusTrove web app container image.
#
# Build context is the repository root (the pnpm workspace root) so the build
# can resolve workspace packages (notably @trusttrove/sdk):
#
#   docker build -f apps/web/Dockerfile -t trusttrove-web .
#
# NEXT_PUBLIC_* values are inlined into the web client bundle at build time, so
# they are passed as build args (defaults mirror .env.example). Server-side API
# URLs can be overridden at runtime via environment variables.

# ---------- base: Node with pnpm via corepack ----------
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ---------- deps: install all workspace dependencies from manifests only ----------
FROM base AS deps
WORKDIR /src
RUN apk add --no-cache libc6-compat
# Every workspace importer in pnpm-lock.yaml must be present for a frozen lock.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/sdk/package.json packages/sdk/
COPY packages/cli/package.json packages/cli/
COPY examples/sdk-quickstart/package.json examples/sdk-quickstart/
RUN pnpm install --frozen-lockfile

# ---------- builder: compile SDK + web with standalone output ----------
FROM base AS builder
WORKDIR /src
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /src/node_modules ./node_modules
COPY --from=deps /src/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /src/packages/sdk/node_modules ./packages/sdk/node_modules
COPY --from=deps /src/packages/cli/node_modules ./packages/cli/node_modules
COPY --from=deps /src/examples/sdk-quickstart/node_modules ./examples/sdk-quickstart/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web ./apps/web
COPY packages/sdk ./packages/sdk

# NEXT_PUBLIC_* values are inlined into the client bundle at build time; pass
# them as build args so the image builds without an .env file. Defaults match
# .env.example.
ARG NEXT_PUBLIC_STELLAR_NETWORK=testnet
ARG NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
ARG NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
ARG NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
ARG NEXT_PUBLIC_REGISTRY_CONTRACT_ID=CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C
ARG NEXT_PUBLIC_INVOICE_CONTRACT_ID=CA4O3MR7LWHRSUDBNU6FY6UDFFYBN7TGBZXBDZB4OYYXFYXIFJ6RJF6B
ARG NEXT_PUBLIC_POOL_CONTRACT_ID=CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS
ARG NEXT_PUBLIC_ESCROW_CONTRACT_ID=CAJWGUKDTTC3SKN4RAAY72J4DVIIYSCFHX6GIMNTT22ABMISJK4GBCEH
ARG NEXT_PUBLIC_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
ARG NEXT_PUBLIC_USDC_ASSET_CODE=USDC
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8080

ENV NEXT_PUBLIC_STELLAR_NETWORK=$NEXT_PUBLIC_STELLAR_NETWORK \
    NEXT_PUBLIC_HORIZON_URL=$NEXT_PUBLIC_HORIZON_URL \
    NEXT_PUBLIC_SOROBAN_RPC_URL=$NEXT_PUBLIC_SOROBAN_RPC_URL \
    NEXT_PUBLIC_NETWORK_PASSPHRASE=$NEXT_PUBLIC_NETWORK_PASSPHRASE \
    NEXT_PUBLIC_REGISTRY_CONTRACT_ID=$NEXT_PUBLIC_REGISTRY_CONTRACT_ID \
    NEXT_PUBLIC_INVOICE_CONTRACT_ID=$NEXT_PUBLIC_INVOICE_CONTRACT_ID \
    NEXT_PUBLIC_POOL_CONTRACT_ID=$NEXT_PUBLIC_POOL_CONTRACT_ID \
    NEXT_PUBLIC_ESCROW_CONTRACT_ID=$NEXT_PUBLIC_ESCROW_CONTRACT_ID \
    NEXT_PUBLIC_USDC_ISSUER=$NEXT_PUBLIC_USDC_ISSUER \
    NEXT_PUBLIC_USDC_ASSET_CODE=$NEXT_PUBLIC_USDC_ASSET_CODE \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN pnpm --filter @trusttrove/sdk build && pnpm --filter web build

# ---------- runner: standalone server output only ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone output mirrors the app's path inside the monorepo build context
# (apps/web). Ship the minimal traced runtime plus static assets and public dir.
COPY --from=builder --chown=nextjs:nodejs /src/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /src/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /src/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]