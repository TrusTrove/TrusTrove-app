import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";

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
const nextConfig = {};

export default nextConfig;
