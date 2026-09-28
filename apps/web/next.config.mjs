import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";
import createBundleAnalyzer from "@next/bundle-analyzer";

// The root README's Quick Start has contributors run `cp .env.example
// .env.local` at the repo root so the web app and the Go indexer share one
// file. Next.js only ever reads env files from its own package directory
// (apps/web), so without this, that root .env.local is silently ignored and
// every NEXT_PUBLIC_* var comes back undefined. Load it here so the
// documented single-file workflow actually reaches the frontend; a web-only
// apps/web/.env.local (see apps/web/README.md) still works unchanged since
// dotenv never overrides a variable that is already set.
for (const file of [".env", ".env.local"]) {
  const rootEnvPath = path.resolve(process.cwd(), "..", "..", file);
  if (existsSync(rootEnvPath)) {
    loadDotenv({ path: rootEnvPath });
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Opt-in bundle analysis: `pnpm --filter web analyze`, or any build run with
// ANALYZE=true, writes client/nodejs/edge treemaps to apps/web/.next/analyze.
// Disabled otherwise, so ordinary `next build` / `next dev` runs are unchanged.
// Set ANALYZE_OPEN=true to have the reports opened in a browser.
// See docs/developer-guide/local-setup.md.
const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: process.env.ANALYZE_OPEN === "true",
});

export default withBundleAnalyzer(withNextIntl(nextConfig));
