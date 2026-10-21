import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PageLayout } from "./PageLayout";

// Mock the Navbar component since it might have complex internal state or routing dependencies
vi.mock("./Navbar", () => ({
  Navbar: () => <nav data-testid="mock-navbar">Mocked Navbar</nav>,
}));

describe("PageLayout", () => {
  it("should render children correctly inside the main content area", () => {
    render(
      <PageLayout>
        <div data-testid="child-content">Test Child Content</div>
      </PageLayout>,
    );

    const mainContent = document.getElementById("main-content");
    expect(mainContent).toBeInTheDocument();

    const child = screen.getByTestId("child-content");
    expect(child).toBeInTheDocument();
    expect(child).toHaveTextContent("Test Child Content");
  });

  it("should render the Navbar component", () => {
    render(
      <PageLayout>
        <div>Content</div>
      </PageLayout>,
    );

    const navbar = screen.getByTestId("mock-navbar");
    expect(navbar).toBeInTheDocument();
  });

  it("should render the footer with the current year", () => {
    render(
      <PageLayout>
        <div>Content</div>
      </PageLayout>,
    );

    const currentYear = new Date().getFullYear();
    const footerText = screen.getByText(
      new RegExp(`© ${currentYear} TrusTrove`, "i"),
    );
    expect(footerText).toBeInTheDocument();
  });

  // #1008: the shell used to hard-code bg-slate-950 text-slate-100, so every
  // PageLayout route stayed dark (and its white-on-white text unreadable)
  // while the light theme was selected. The root and footer must use tokens.
  it("paints the shell with theme tokens instead of a hard-coded palette", () => {
    const { container } = render(
      <PageLayout>
        <div>Content</div>
      </PageLayout>,
    );

    const root = container.firstElementChild;
    expect(root).toHaveClass("bg-background", "text-foreground");
    expect(root).not.toHaveClass("bg-slate-950");
    expect(root).not.toHaveClass("text-slate-100");

    const footer = screen.getByText(/Built on Stellar/i).closest("footer");
    expect(footer).toHaveClass("border-border");
    expect(footer).toHaveClass("text-muted-foreground");
    expect(footer).not.toHaveClass("border-slate-900/80");
    expect(footer).not.toHaveClass("text-slate-500");
  });
});
