import type { Meta, StoryObj } from "@storybook/react";

import { mockSimulation } from "../../.storybook/mockData";

import { SimulationPreview } from "./SimulationPreview";

/**
 * Shows the outcome of a Soroban transaction simulation before the user signs.
 * It is a pure component — all four of its states are driven by props, so each
 * one gets its own story and no backend is involved.
 */
const meta = {
  title: "Shared/SimulationPreview",
  component: SimulationPreview,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    details: mockSimulation,
    error: null,
    isLoading: false,
    isFallback: false,
  },
  decorators: [
    (Story) => (
      <div className="w-[420px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SimulationPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Simulation in flight. */
export const Loading: Story = {
  args: { details: null, isLoading: true },
};

/** The simulation failed; the error text is shown verbatim. */
export const Error: Story = {
  args: {
    details: null,
    error:
      "HostError: Error(Contract, #4) — invoice is not in the Listed state",
  },
};

/** No data, but a fallback fee estimate is available. */
export const UnavailableFallback: Story = {
  args: { details: null, isFallback: true },
};

/** A successful simulation, ready to sign. */
export const ReadyToSign: Story = {
  args: { details: mockSimulation },
};

/** A successful simulation produced during a degraded RPC window. */
export const ReadyWithFallbackFlag: Story = {
  args: {
    details: { ...mockSimulation, functionName: "repay", footprintSize: 1 },
    isFallback: true,
  },
};

/** Nothing to show: the component renders nothing. */
export const Hidden: Story = {
  args: { details: null, error: null, isLoading: false, isFallback: false },
};
