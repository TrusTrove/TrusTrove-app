import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RootError from "./error";
import GlobalError from "./global-error";

// Both boundaries log to console.error on mount; silence it so the assertions
// below are the only output.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("route-level error boundaries", () => {
  it("announces the route error through a live alert region (error.tsx)", () => {
    render(
      <RootError error={new Error("indexer unreachable")} reset={() => {}} />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("Something went wrong.");
    expect(alert).toHaveTextContent("indexer unreachable");
  });

  it("falls back to a generic message but still announces it (error.tsx)", () => {
    render(<RootError error={new Error("")} reset={() => {}} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "An unexpected error occurred while loading this page.",
    );
  });

  it("announces the crash through a live alert region (global-error.tsx)", () => {
    render(
      <GlobalError error={new Error("hydration failed")} reset={() => {}} />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("The app crashed.");
    expect(alert).toHaveTextContent("hydration failed");
  });
});
