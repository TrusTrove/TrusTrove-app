import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@trusttrove/sdk": resolve(__dirname, "../sdk/src/index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
