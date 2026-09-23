import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";

import {
  withFreighterSimulation,
  withStoryProviders,
} from "../../.storybook/decorators";

import { WalletConnect } from "./WalletConnect";

/**
 * The Freighter connect / disconnect control.
 *
 * `@stellar/freighter-api` is aliased to a stub for Storybook (see
 * `.storybook/main.ts`), so these stories cover every branch of the real
 * component — extension missing, wrong network, disconnected, connected, and
 * a rejected connection request — without the extension installed.
 */
const meta = {
  title: "Shared/WalletConnect",
  component: WalletConnect,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    withFreighterSimulation(),
    withStoryProviders({ wallet: null, query: [] }),
  ],
} satisfies Meta<typeof WalletConnect>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No wallet connected: the "CONNECT WALLET" prompt. */
export const Disconnected: Story = {};

/** Connected and on testnet: address chip, network badge, disconnect control. */
export const ConnectedOnTestnet: Story = {
  decorators: [
    withStoryProviders({
      wallet: { connected: true, network: "testnet" },
      query: [],
    }),
  ],
};

/** Connected on mainnet, which is flagged by a different badge. */
export const ConnectedOnMainnet: Story = {
  decorators: [
    withStoryProviders({
      wallet: { connected: true, network: "mainnet" },
      query: [],
    }),
  ],
};

/** Connected with an unknown network: the "Switch to Testnet" prompt shows. */
export const UnknownNetwork: Story = {
  decorators: [
    withStoryProviders({
      wallet: { connected: true, network: null },
      query: [],
    }),
  ],
};

/** The extension is not installed: the install link replaces the control. */
export const FreighterNotInstalled: Story = {
  decorators: [withFreighterSimulation({ connected: false })],
};

/** Requesting access when the simulated user rejects the prompt. */
export const ConnectionRejected: Story = {
  decorators: [withFreighterSimulation({ userRejects: true })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /connect wallet/i }),
    );

    await expect(
      await canvas.findByText(/cancelled the connection request/i),
    ).toBeInTheDocument();
  },
};
