import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";

import { STORY_BUYER } from "../../.storybook/mockData";
import { profileSeeds, withStoryProviders } from "../../.storybook/decorators";

import { InvoiceForm } from "./InvoiceForm";

/**
 * The two-step invoice creation form. Step one collects terms (buyer, face
 * value, asset, due date, discount), step two reviews the payout before the
 * on-chain create/list calls. The stories below cover the idle terms step, a
 * filled-in terms step, the validation error path, and the disconnected-wallet
 * case. Nothing here touches the network — the on-chain mutations only run on
 * submit.
 */
const meta = {
  title: "Invoice/InvoiceForm",
  component: InvoiceForm,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { onSuccess: fn() },
  decorators: [
    (Story) => (
      <div className="w-[520px] rounded-lg border border-border bg-card p-5">
        <Story />
      </div>
    ),
    withStoryProviders({
      wallet: { role: "issuer" },
      query: profileSeeds(),
    }),
  ],
} satisfies Meta<typeof InvoiceForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The empty terms step, as `Create Invoice` opens. */
export const TermsStep: Story = {};

/** Terms filled in, still on step one. */
export const TermsFilled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(
      canvas.getByPlaceholderText(/Stellar Public Key/i),
      STORY_BUYER,
    );
    await userEvent.type(canvas.getByLabelText(/Face Value/i), "50000");

    await expect(canvas.getByLabelText(/Face Value/i)).toHaveValue("50000");
  },
};

/**
 * Submitting with no due date surfaces the inline validation error instead of
 * advancing to step two.
 */
export const ValidationError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(
      canvas.getByPlaceholderText(/Stellar Public Key/i),
      STORY_BUYER,
    );
    await userEvent.type(canvas.getByLabelText(/Face Value/i), "50000");
    await userEvent.click(
      canvas.getByRole("button", { name: /review financing terms/i }),
    );

    await expect(
      await canvas.findByText(/due date|Stellar public key/i),
    ).toBeInTheDocument();
  },
};

/** No wallet connected — the form still renders and validates. */
export const DisconnectedWallet: Story = {
  decorators: [
    withStoryProviders({ wallet: null, query: profileSeeds(undefined, false) }),
  ],
};
