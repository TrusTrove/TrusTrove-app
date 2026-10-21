import React from "react";
import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import DocsPage from "@/app/docs/page";
import DocsLoading from "@/app/docs/loading";
import NotFound from "@/app/not-found";
import RootError from "@/app/error";
import GlobalError from "@/app/global-error";

// The docs page boots a terminal animation and redirects after ~2s; keeping
// timers fake leaves the page mounted so its landmarks can be asserted.
beforeAll(() => {
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a>,
}));

vi.mock("@/components/shared/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/shared/TopStatusBar", () => ({
  TopStatusBar: () => null,
}));

function expectSingleLandmarks() {
  expect(screen.getAllByRole("main")).toHaveLength(1);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
}

describe("route landmarks (#1006)", () => {
  it("gives /docs one main skip target and one h1", () => {
    render(<DocsPage />);

    expectSingleLandmarks();
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(
      screen.getByRole("heading", { level: 1, name: /TrusTrove GitBook/i }),
    ).toBeInTheDocument();
  });

  it("renders the docs external actions as real links", () => {
    render(<DocsPage />);

    for (const name of [/Access Docs/i, /Skip to Docs/i]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute(
        "href",
        "https://k1ngd4vid.gitbook.io/trustrove/",
      );
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("gives the docs loading state the main skip target", () => {
    render(<DocsLoading />);

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("gives the 404 route one main skip target and one h1", () => {
    render(<NotFound />);

    expectSingleLandmarks();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(
      screen.getByRole("heading", { level: 1, name: "404" }),
    ).toBeInTheDocument();
  });

  it("gives the route error boundary one main skip target and one h1", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<RootError error={new Error("boom")} reset={() => {}} />);

    expectSingleLandmarks();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong.",
    );
  });

  it("gives the global error boundary one main skip target and one h1", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GlobalError error={new Error("boom")} reset={() => {}} />);

    expectSingleLandmarks();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("alert")).toHaveTextContent("The app crashed.");
  });
});
