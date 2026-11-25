import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Hsl = [number, number, number];
type TokenMap = Record<string, Hsl>;

function parseThemeBlock(css: string, selector: string): TokenMap {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  if (!match) {
    throw new Error(`Could not find ${selector} block in globals.css`);
  }
  const tokens: TokenMap = {};
  const varRegex = /(--[a-z0-9-]+)\s*:\s*([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%\s*;/gi;
  let m: RegExpExecArray | null;
  while ((m = varRegex.exec(match[1])) !== null) {
    tokens[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return tokens;
}

function hslToRgb([h, s, l]: Hsl): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const linearize = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(a: Hsl, b: Hsl): number {
  const l1 = relativeLuminance(hslToRgb(a));
  const l2 = relativeLuminance(hslToRgb(b));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const css = readFileSync(path.resolve(__dirname, "globals.css"), "utf8");
const light = parseThemeBlock(css, ":root");
const dark = parseThemeBlock(css, ".dark");

const REQUIRED_AA_PAIRS: Array<[string, string]> = [
  ["--foreground", "--background"],
  ["--card-foreground", "--card"],
  ["--popover-foreground", "--popover"],
  ["--muted-foreground", "--background"],
  ["--muted-foreground", "--card"],
  ["--muted-foreground", "--muted"],
  ["--muted-foreground", "--popover"],
  ["--primary-foreground", "--primary"],
  ["--secondary-foreground", "--secondary"],
  ["--accent-foreground", "--accent"],
  ["--destructive-foreground", "--destructive"],
  ["--success-foreground", "--success"],
  ["--warning-foreground", "--warning"],
  ["--info-foreground", "--info"],
];

describe("globals.css WCAG AA theme contrast", () => {
  it.each(REQUIRED_AA_PAIRS)(
    "light theme %s on %s meets >= 4.5:1",
    (fg, bg) => {
      expect(light[fg]).toBeDefined();
      expect(light[bg]).toBeDefined();
      expect(contrastRatio(light[fg], light[bg])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(REQUIRED_AA_PAIRS)(
    "dark theme %s on %s meets >= 4.5:1",
    (fg, bg) => {
      expect(dark[fg]).toBeDefined();
      expect(dark[bg]).toBeDefined();
      expect(contrastRatio(dark[fg], dark[bg])).toBeGreaterThanOrEqual(4.5);
    },
  );
});
