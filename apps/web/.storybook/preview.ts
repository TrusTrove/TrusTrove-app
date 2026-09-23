import type { Preview } from "@storybook/react";

// The app's Tailwind entrypoint. Importing it here makes every story render
// with the same design tokens (CSS variables) and utility classes as the app.
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // The app ships a dark-first palette; default the canvas to it so
    // components that do not set their own background still read correctly.
    backgrounds: {
      default: "trusttrove-dark",
      values: [
        { name: "trusttrove-dark", value: "#080c10" },
        { name: "surface", value: "#0d131a" },
        { name: "light", value: "#ffffff" },
      ],
    },
    nextjs: {
      // Components call `usePathname()` / render `next/link`, so tell the
      // Next.js addon to mock the App Router and give it a pathname.
      appDirectory: true,
      navigation: {
        pathname: "/dashboard",
      },
    },
    options: {
      storySort: {
        order: ["UI", "Shared", "Invoice", ["*"]],
      },
    },
  },
};

export default preview;
