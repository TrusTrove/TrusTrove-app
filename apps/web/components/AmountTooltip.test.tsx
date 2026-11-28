import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AmountTooltip } from "./AmountTooltip";

describe("AmountTooltip", () => {
  it("renders expected path with USDC amount and tooltip details", () => {
    const { container } = render(<AmountTooltip amount={100000000n} asset="USDC" />);
    const span = container.querySelector("span");
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe("10.00 USDC");
    const title = span?.getAttribute("title") || "";
    expect(title).toContain("Asset Code: USDC");
    expect(title).toContain("Issuer:");
    expect(title).toContain("Network:");
    expect(title).toContain("Decimals: 7");
  });

  it("handles empty or undefined amount gracefully", () => {
    const { container } = render(<AmountTooltip amount={undefined} asset="USDC" />);
    const span = container.querySelector("span");
    expect(span?.textContent).toBe("0.00 USDC");
  });

  it("handles invalid or fallback asset boundary safely", () => {
    const { container } = render(<AmountTooltip amount={50000000n} asset={"UNKNOWN" as any} />);
    const span = container.querySelector("span");
    expect(span).not.toBeNull();
    const title = span?.getAttribute("title") || "";
    expect(title).toContain("Asset Code: USDC");
  });
});
