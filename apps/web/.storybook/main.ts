import path from "node:path";

import type { StorybookConfig } from "@storybook/nextjs";

/**
 * Storybook configuration for the TrusTrove web app.
 *
 * The app is a Next.js 14 App Router project whose components live under
 * `components/`, so stories are discovered there (colocated `*.stories.tsx`
 * next to each component). The `@storybook/nextjs` framework reuses the app's
 * `next.config.mjs` and tsconfig `paths`, which is what makes the `@/*` import
 * alias and Tailwind/PostCSS pipeline work exactly as they do in `next dev`.
 */
const config: StorybookConfig = {
  stories: [
    "../components/**/*.stories.mdx",
    "../components/**/*.stories.@(js|jsx|ts|tsx)",
    "../app/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  addons: ["@storybook/addon-essentials"],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  staticDirs: ["../public"],
  typescript: {
    // Type-check the stories' props so a component API change surfaces here.
    reactDocgen: "react-docgen-typescript",
  },
  docs: {
    autodocs: "tag",
  },
  webpackFinal: async (config) => {
    // Storybook must never require the Freighter browser extension. Alias the
    // real API to a local stub so wallet components render — and so the app's
    // `lib/freighter.ts` "extension missing" branch can be exercised on
    // purpose. The stub lives in the repo and is type-checked like any other
    // module.
    const freighterStub = path.resolve(
      process.cwd(),
      ".storybook/mocks/freighter-api.ts",
    );

    config.resolve = config.resolve ?? {};
    // `resolve.alias` may be either an object or the array form webpack also
    // accepts — Next.js uses the array form — so handle both without
    // clobbering the aliases the Next.js builder already registered.
    const existingAlias = config.resolve.alias;
    config.resolve.alias = Array.isArray(existingAlias)
      ? [...existingAlias, { "@stellar/freighter-api": freighterStub }]
      : {
          ...(existingAlias as Record<string, string> | undefined),
          "@stellar/freighter-api": freighterStub,
        };

    return config;
  },
};

export default config;
