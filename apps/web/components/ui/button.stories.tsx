import type { Meta, StoryObj } from "@storybook/react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "./button";

/**
 * The base button primitive used across the app. Its look is driven entirely by
 * `variant` and `size` (class-variance-authority), so those two axes are what
 * the stories below sweep.
 */
const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
      ],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    disabled: { control: "boolean" },
    asChild: { table: { disable: true } },
  },
  args: {
    children: "Button",
    variant: "default",
    size: "default",
    disabled: false,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete invoice" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "Outline" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Fund invoice" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Ghost" },
};

export const Link: Story = {
  args: { variant: "link", children: "Learn more" },
};

export const Small: Story = { args: { size: "sm", children: "Small" } };

export const Large: Story = { args: { size: "lg", children: "Large" } };

export const Disabled: Story = {
  args: { disabled: true, children: "Disabled" },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus />
        New invoice
      </>
    ),
  },
};

export const IconOnly: Story = {
  args: {
    size: "icon",
    "aria-label": "Delete invoice",
    children: <Trash2 />,
  },
};

export const Loading: Story = {
  args: {
    disabled: true,
    children: (
      <>
        <Loader2 className="animate-spin" />
        Submitting…
      </>
    ),
  },
};

/** Every variant at the default size, for a quick visual diff. */
export const AllVariants: Story = {
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {(
        [
          "default",
          "destructive",
          "outline",
          "secondary",
          "ghost",
          "link",
        ] as const
      ).map((variant) => (
        <Button key={variant} {...args} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};

/** Every size, including the square icon size. */
export const AllSizes: Story = {
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {(["sm", "default", "lg", "icon"] as const).map((size) => (
        <Button key={size} {...args} size={size}>
          {size === "icon" ? <Plus /> : size}
        </Button>
      ))}
    </div>
  ),
};
