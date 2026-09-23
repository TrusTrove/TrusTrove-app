import type { Meta, StoryObj } from "@storybook/react";

import {
  balanceSeeds,
  profileSeeds,
  withStoryProviders,
} from "../../.storybook/decorators";

import { PageLayout } from "./PageLayout";

/**
 * The app shell: ambient background glows, the `Navbar`, a centred main column,
 * and the footer. It renders the real `Navbar`, so the stories seed the wallet,
 * balance, and profile queries to cover the connected/unverified variants
 * without a network.
 */
const meta = {
  title: "Shared/PageLayout",
  component: PageLayout,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    withStoryProviders({
      wallet: { role: "issuer" },
      query: [...balanceSeeds(), ...profileSeeds()],
    }),
  ],
  args: {
    children: (
      <div className="space-y-2">
        <h1 className="text-lg font-bold text-white">SME Dashboard</h1>
        <p className="text-sm text-slate-400">
          Tokenized trade obligations, funded instantly.
        </p>
      </div>
    ),
  },
} satisfies Meta<typeof PageLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Connected, verified issuer with balances. */
export const Connected: Story = {};

/** Connected but unverified: the profile dot is absent and balances still show. */
export const ConnectedUnverified: Story = {
  decorators: [
    withStoryProviders({
      wallet: { role: "issuer" },
      query: [...balanceSeeds(), ...profileSeeds(undefined, false)],
    }),
  ],
};

/** Disconnected: the wallet prompt replaces the balance chip. */
export const Disconnected: Story = {
  decorators: [
    withStoryProviders({
      wallet: null,
      query: [...balanceSeeds(), ...profileSeeds(undefined, false)],
    }),
  ],
};

/** Balances still loading: the navbar shows shimmer placeholders. */
export const BalancesLoading: Story = {
  decorators: [
    withStoryProviders({
      wallet: { role: "issuer" },
      query: profileSeeds(),
      pending: [["balances"]],
    }),
  ],
};
