import type { Meta, StoryObj } from "@storybook/react";

import { ErrorBoundary } from "./ErrorBoundary";

/**
 * A render-error boundary. Its interesting state is the failure path, so the
 * stories include a deliberately throwing child to show both the default and a
 * custom fallback. The thrown error is expected and is logged by the boundary.
 */
const meta = {
  title: "Shared/ErrorBoundary",
  component: ErrorBoundary,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[420px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The happy path: children render untouched. */
export const RendersChildren: Story = {
  args: {
    children: (
      <p className="text-sm text-slate-300">Everything rendered fine.</p>
    ),
  },
};

/** A child that throws during render. */
function Boom(): never {
  throw new Error("Simulated render failure while loading the invoice feed.");
}

/** The default fallback, showing the error message and recovery buttons. */
export const DefaultFallback: Story = {
  args: { children: <Boom />, context: "InvoiceFeed" },
};

/** A caller-supplied fallback receives the error and a reset callback. */
export const CustomFallback: Story = {
  args: {
    children: <Boom />,
    context: "InvoiceCard",
    fallback: (error, reset) => (
      <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-sm font-semibold text-amber-300">
          Could not load this invoice
        </p>
        <p className="text-xs text-amber-200/70">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="rounded border border-amber-500/40 px-3 py-1 text-xs text-amber-200"
        >
          Retry
        </button>
      </div>
    ),
  },
};
