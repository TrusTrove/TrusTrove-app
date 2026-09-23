import type { Meta, StoryObj } from "@storybook/react";

import {
  balanceSeeds,
  profileSeeds,
  withStoryProviders,
} from "../../.storybook/decorators";

import { Navbar } from "./Navbar";

/**
 * The app's top navigation. It reads the wallet store plus the balance and
 * profile queries, so the stories seed all three to cover the connected /
 * disconnected and verified / unverified combinations without a network or the
 * Freighter extension. The active nav item comes from the mocked pathname
 * (`/dashboard`, set globally in `.storybook/preview.ts`).
 */
const meta = {
  title: "Shared/Navbar",
  component: Navbar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    withStoryProviders({
      wallet: { role: "issuer" },
      query: [...balanceSeeds(), ...profileSeeds()],
      pending: [["balances"]],
    }),
  ],
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Disconnected: only the connect prompt shows in the actions area. */
export const Disconnected: Story = {
  decorators: [
    withStoryProviders({
      wallet: null,
      query: [...profileSeeds(undefined, false)],
    }),
  ],
};

/** Connected with balances loaded and a verified profile. */
export const ConnectedVerified: Story = {
  decorators: [
    withStoryProviders({
      wallet: { role: "issuer" },
      query: [...balanceSeeds(), ...profileSeeds()],
    }),
  ],
};

/** Connected but unverified: no verification dot next to Profile. */
export const ConnectedUnverified: Story = {
  decorators: [
    withStoryProviders({
      wallet: { role: "issuer" },
      query: [...balanceSeeds(), ...profileSeeds(undefined, false)],
    }),
  ],
};

/** Connected as an LP, with the role selector on "LP (Funder)". */
export const LpRole: Story = {
  decorators: [
    withStoryProviders({
      wallet: { role: "lp" },
      query: [...balanceSeeds(), ...profileSeeds()],
    }),
  ],
};

/** Connected while the balances request is still in flight. */
export const BalancesLoading: Story = {};
