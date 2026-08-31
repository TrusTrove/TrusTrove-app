import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerificationBadge } from "./VerificationBadge";

describe("VerificationBadge", () => {
  it("renders 'Unverified' when state is unverified", () => {
    render(<VerificationBadge state="unverified" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Unverified");
    expect(badge).toHaveAttribute("aria-label", "Verification: Unverified");
  });

  it("renders 'Verified · risk score N%' when state is verified with a risk score", () => {
    render(<VerificationBadge state="verified" riskScoreBps={2500} />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Verified · risk score 25.0%");
    expect(badge).toHaveAttribute(
      "aria-label",
      "Verification: verified, risk score 25.0 percent",
    );
  });

  it("renders 'Verified' when state is verified without a risk score", () => {
    render(<VerificationBadge state="verified" riskScoreBps={null} />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Verified");
    expect(badge).toHaveAttribute("aria-label", "Verification: Verified");
  });

  it("renders 'Verification failed' when state is failed", () => {
    render(<VerificationBadge state="failed" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Verification failed");
    expect(badge).toHaveAttribute(
      "aria-label",
      "Verification: Verification failed",
    );
  });

  it("formats risk score as percentage with one decimal", () => {
    render(<VerificationBadge state="verified" riskScoreBps={3333} />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Verified · risk score 33.3%");
  });
});
