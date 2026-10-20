import { NextResponse, type NextRequest } from "next/server";
import {
  NONCE_HEADER,
  buildContentSecurityPolicy,
  cspHeaderName,
  isCspEnforced,
  resolveConnectUrls,
} from "./lib/security-headers.mjs";

/**
 * Sets a per-request Content-Security-Policy with a fresh script nonce.
 *
 * Next reads the nonce from the CSP request header and adds it to its own
 * inline scripts; `app/layout.tsx` reads {@link NONCE_HEADER} for the theme
 * bootstrap script. See docs/developer-guide/security-headers.md.
 */
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const enforce = isCspEnforced(process.env);
  const headerName = cspHeaderName(enforce);
  const policy = buildContentSecurityPolicy({
    nonce,
    isDevelopment: process.env.NODE_ENV === "development",
    enforce,
    connectUrls: resolveConnectUrls(process.env),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(headerName, policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(headerName, policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Documents only: static assets, image optimisation and public files
      // never execute page scripts, so they need no nonce.
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webmanifest)$).*)",
      // Router prefetches are not rendered as documents.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
