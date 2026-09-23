import type { Meta, StoryObj } from "@storybook/react";

import { ConfigBanner } from "./ConfigBanner";

/**
 * Warns when the required `NEXT_PUBLIC_*` contract IDs are missing. The banner
 * renders nothing once the app is configured — that null branch is the
 * component's default in a configured deployment, so a story cannot force the
 * warning when the build-time env vars are present.
 *
 * In a clean checkout (no `.env` / `.env.local`, as in CI) the contract IDs are
 * absent and this story shows the warning banner it is named for.
 */
const meta = {
  title: "Shared/ConfigBanner",
  component: ConfigBanner,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ConfigBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Unconfigured: lists the missing contract env vars. */
export const MissingContractIds: Story = {};
