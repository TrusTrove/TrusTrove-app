import React from "react";
import { Button } from "@/components/ui/button";

/**
 * Storybook is not part of the workspace install, so these stories stay in
 * dependency-free CSF3: a plain `meta` object plus story objects carrying
 * `args`/`render`. `src/components/stories.test.tsx` asserts every story here
 * renders the imported component rather than a hand-written placeholder, which
 * is what a `storyBuilder` build would otherwise catch.
 */
const meta = {
  title: "UI/Button",
  component: Button,
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
  },
};

export default meta;

type Story = {
  render: (args: React.ComponentProps<typeof Button>) => React.ReactElement;
  args: React.ComponentProps<typeof Button>;
};

export const Primary: Story = {
  render: (args) => <Button {...args} />,
  args: { children: "Primary Button" },
};

export const Secondary: Story = {
  render: (args) => <Button {...args} />,
  args: { variant: "secondary", children: "Secondary Button" },
};

export const Outline: Story = {
  render: (args) => <Button {...args} />,
  args: { variant: "outline", children: "Outline Button" },
};

export const Destructive: Story = {
  render: (args) => <Button {...args} />,
  args: { variant: "destructive", children: "Destructive Button" },
};

export const Ghost: Story = {
  render: (args) => <Button {...args} />,
  args: { variant: "ghost", children: "Ghost Button" },
};

export const Link: Story = {
  render: (args) => <Button {...args} />,
  args: { variant: "link", children: "Link Button" },
};

export const Small: Story = {
  render: (args) => <Button {...args} />,
  args: { size: "sm", children: "Small" },
};

export const Large: Story = {
  render: (args) => <Button {...args} />,
  args: { size: "lg", children: "Large" },
};

export const IconOnly: Story = {
  render: (args) => <Button {...args} />,
  args: { size: "icon", "aria-label": "Refresh", children: "↻" },
};

export const Disabled: Story = {
  render: (args) => <Button {...args} />,
  args: { disabled: true, children: "Disabled" },
};
