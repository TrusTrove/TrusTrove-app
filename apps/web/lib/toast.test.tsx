import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

const successMock = vi.fn();
const errorMock = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: successMock,
    error: errorMock,
  },
}));

describe("toast accessibility", () => {
  beforeEach(() => {
    successMock.mockClear();
    errorMock.mockClear();
  });

  it("marks success toast content atomic and adds a screen-reader prefix", () => {
    showSuccessToast("Deposit Complete", "abc123");

    expect(successMock).toHaveBeenCalledTimes(1);

    const [content, options] = successMock.mock.calls[0];
    render(<>{content}</>);

    const text = screen.getByText("Deposit Complete").closest("div");
    expect(text).toHaveAttribute("aria-atomic", "true");
    expect(screen.getByText("Success: ", { selector: ".sr-only" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on stellar expert/i })).toHaveAttribute(
      "href",
      "https://stellar.expert/explorer/testnet/tx/abc123",
    );
    expect(options).toMatchObject({ duration: 5000 });
  });

  it("marks error toast content atomic and adds a screen-reader prefix", () => {
    showErrorToast("Withdrawal Failed", new Error("Insufficient balance"));

    expect(errorMock).toHaveBeenCalledTimes(1);

    const [content, options] = errorMock.mock.calls[0];
    render(<>{content}</>);

    const text = screen.getByText("Withdrawal Failed").closest("div");
    expect(text).toHaveAttribute("aria-atomic", "true");
    expect(screen.getByText("Error: ", { selector: ".sr-only" })).toBeInTheDocument();
    expect(screen.getByText("Insufficient balance")).toBeInTheDocument();
    expect(options).toMatchObject({ duration: 6000 });
  });
});