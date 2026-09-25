import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Resolve the workspace SDK from source so the unit tests run without a
      // prior `pnpm --filter @trusttrove/sdk build` (mirrors apps/web).
      "@trusttrove/sdk": fileURLToPath(
        new URL("../sdk/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
  },
});
