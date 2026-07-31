---
name: TrusTrove Terminal Design System
description: Bloomberg Terminal meets Stellar — Enterprise Trade Finance Operations Terminal
colors:
  primary: "#00d4aa"
  primary-hover: "#00b38f"
  accent-active: "#3b82f6"
  accent-status-indigo: "#818cf8"
  accent-status-sky: "#0ea5e9"
  accent-success: "#10b981"
  accent-warning: "#f59e0b"
  neutral-bg: "#080c10"
  neutral-card: "#0d131a"
  border: "#1a2330"
  ink-primary: "#f1f5f9"
  ink-muted: "#64748b"
typography:
  display:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "var(--font-sans), sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  mono:
    fontFamily: "var(--font-mono), monospace"
    fontSize: "0.9rem"
    fontWeight: 500
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#080c10"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  card-container:
    backgroundColor: "{colors.neutral-card}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: TrusTrove Terminal

## 1. Overview

**Creative North Star: "The Operations Terminal"**

The TrusTrove interface is modeled on professional financial execution environments (Bloomberg Terminal, Reuters Eikon). It avoids consumer-grade DeFi trends in favor of high-density data, sharp typography contrast, and immediate functional feedback. Surfaces use a dark navy-black void background (`#080c10`) with thin slate borders (`#1a2330`) to establish a clear architectural grid.

Colors represent system state and financial health, allowing operators to assess trade statuses in under one second.

**Key Characteristics:**

- Deep space backgrounds (`#080c10`) with flat containers (`#0d131a`).
- High text-density tables, stats rolls, and timeline tracking.
- Inter for UI controls and labels; JetBrains Mono for monetary values, addresses, and hashes.
- Hover states project a bright teal glow (`0 0 24px rgba(0,212,170,0.15)`) representing active liquidity.

## 2. Colors

A structured, state-driven color palette using colors specifically mapped to invoice states.

### Primary & Brand

- **Electric Teal** (`#00d4aa`): Represents liquidity, trust, and the protocol core. Used for brand highlights, active buttons, and "Listed" state.

### State Accent Colors

- **Ocean Blue** (`#3b82f6`): Represents funded invoices currently in progress.
- **Active Status Indigo** (`#818cf8`): Represents active invoice status.
- **Confirmed Sky** (`#0ea5e9`): Represents delivery confirmed by the buyer.
- **Success Emerald** (`#10b981`): Represents fully settled/repaid invoices and positive yields.
- **Risk Amber** (`#f59e0b`): Represents overdue obligations, defaults, or risk warnings.

### Neutrals

- **Void Background** (`#080c10`): Foundational dark layer.
- **Terminal Card** (`#0d131a`): Container backdrop.
- **Grid Border** (`#1a2330`): Slate outlines separating fields.
- **White Ink** (`#f1f5f9`): High contrast readability.
- **Muted Ink** (`#64748b`): Labels and descriptions.

**The State Map Rule.** The INVOICE STATUS COLOR MAP must be implemented uniformly:

- Created: Gray (`#6b7280`)
- Listed: Teal (`#00d4aa`)
- Funded: Blue (`#3b82f6`)
- Active: Indigo (`#818cf8`)
- Confirmed: Sky (`#0ea5e9`)
- Repaid: Emerald (`#10b981`)
- Defaulted: Amber (`#f59e0b`)

## 3. Typography

**Display Font:** Inter (Sans-serif)
**Body Font:** Inter (Sans-serif)
**Monospace Font:** JetBrains Mono

All monetary amounts, address hashes, dates, and invoice IDs must be rendered in `JetBrains Mono` to emphasize mathematical precision and blockchain record integrity.

### Hierarchy

- **Display** (ExtraBold (800), `clamp(2rem, 4vw, 3.5rem)`, 1.2): Section headings and hero metrics.
- **Headline** (Bold (700), `1.5rem` (24px), 1.3): Page headers.
- **Title** (Bold (600), `1.125rem` (18px), 1.3): Cards and tables.
- **Body** (Regular (400), `0.95rem` (15px), 1.5): Descriptions and form controls.
- **Label** (Medium (500), `0.75rem` (12px), 1.4): Table headers and details.

## 4. Elevation

The interface rejects layered 3D shadows. Depth is indicated by border transitions and active glowing borders.

### Shadow Vocabulary

- **Teal Glow Hover** (`box-shadow: 0 0 24px rgba(0,212,170,0.15)`): Applied to cards when hovered.
- **Focus Ring** (`box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.2)`): Glowing input ring on active cursor focus.

**The Flat Grid Rule.** Surfaces are flat and share the same visual plane. Hover states do not raise cards; they activate the teal border and emit a glowing aura to denote active liquidity.

## 5. Components

### Buttons

- **Shape:** Sharp, minimal rounding (`8px` radius).
- **Primary:** Solid Electric Teal background (`#00d4aa`) with dark text (`#080c10`).
- **Secondary:** Border-only with teal hover.

### Cards / Containers

- **Corner Style:** Rounded-lg (`12px` radius).
- **Background:** Solid dark gray (`#0d131a`).
- **Border:** Thin border (`border-slate-800` or `#1a2330`).
- **Internal Padding:** `20px` (`p-5`).

### Navigation

- **Style:** Thin status bar at the top displaying testnet state and recent transactions ticker. Fixed navigation bar below.

## 6. Do's and Don'ts

### Do:

- **Do** format all financial figures in `JetBrains Mono` with comma separators and the `USDC` suffix (e.g. `50,000.00 USDC`).
- **Do** display address strings in monospace, truncated in the middle with a copy-to-clipboard control.
- **Do** implement skeleton shimmers instead of loading spinners to prevent layout shifts.
- **Do** optimize dashboard cards and status timelines for responsive, thumb-reachable triggers on mobile screens (375px+).

### Don't:

- **Don't** use generic rounded buttons or card shadows.
- **Don't** show playful illustrations, mascot graphics, or neon-gradient SaaS bubbles.
- **Don't** hide fees or display calculated yield ranges without displaying the utilization-based formula.
- **Don't** animate elements inside cards on hover; animate the card border and glow instead.
