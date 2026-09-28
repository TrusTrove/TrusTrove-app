import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Resolve the workspace SDK to its source so the CLI tests never
      // depend on a prior `pnpm --filter @trusttrove/sdk build`.
      "@trusttrove/sdk": resolve(__dirname, "../sdk/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
