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
});
