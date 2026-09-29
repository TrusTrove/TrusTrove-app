import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";
import Providers from "./providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { cn } from "@/lib/utils";
import enMessages from "../messages/en.json";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "TrusTrove | Decentralized Trade Finance Operations Terminal",
  description:
    "Tokenize unpaid trade invoices as Stellar assets and receive immediate USDC funding. Yield opportunities for liquidity providers.",
  // PWA installability: the manifest and icons live in `public/`.
  manifest: "/manifest.webmanifest",
  applicationName: "TrusTrove",
  appleWebApp: {
    capable: true,
    title: "TrusTrove",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// Next 14 moved `themeColor` from `metadata` to the `viewport` export.
// Matches the dark `--background` token and the manifest's `theme_color`.
export const viewport: Viewport = {
  themeColor: "#080c10",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `suppressHydrationWarning` is required because the bootstrap script below
    // may swap the `dark` class before React hydrates (see lib/theme.ts).
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          // Runs before first paint so a saved (or system) light preference is
          // applied without a flash of the server-rendered dark theme.
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground font-sans min-h-screen`}
      >
        <a
          href="#main-content"
          className={cn(
            "sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100]",
            "focus:px-4 focus:py-2 focus:bg-primary focus:text-black focus:font-bold focus:text-sm focus:rounded",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
          )}
        >
          Skip to main content
        </a>
        <Providers>
          <NextIntlClientProvider locale="en" messages={enMessages}>
            {children}
          </NextIntlClientProvider>
          <SpeedInsights />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
