import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Metadata } from "next";
import { metadata as helpMetadata } from "@/app/help/layout";
import { metadata as settingsMetadata } from "@/app/settings/layout";
import { metadata as dashboardMetadata } from "@/app/dashboard/layout";

// #1117: /help and /settings are client components, so a `metadata` export in
// their page.tsx would be ignored by Next and both routes inherited the root
// landing-page title/description. The route `layout.tsx` is the metadata
// source, mirroring the pattern app/dashboard/layout.tsx already used.

const APP_ROOT = path.resolve(__dirname, ".");

function titleOf(metadata: Metadata): string {
  expect(typeof metadata.title).toBe("string");
  return metadata.title as string;
}

function descriptionOf(metadata: Metadata): string {
  expect(typeof metadata.description).toBe("string");
  return metadata.description as string;
}

describe("route metadata", () => {
  it.each([
    ["help", helpMetadata],
    ["settings", settingsMetadata],
  ])("%s/layout.tsx exports a title and a description", (_route, metadata) => {
    expect(titleOf(metadata)).toMatch(/TrusTrove$/);
    expect(descriptionOf(metadata).length).toBeGreaterThan(40);
  });

  it("gives each route a distinct title instead of the shared landing copy", () => {
    const titles = [
      titleOf(helpMetadata),
      titleOf(settingsMetadata),
      titleOf(dashboardMetadata),
    ];
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("gives each route a distinct description", () => {
    const descriptions = [
      descriptionOf(helpMetadata),
      descriptionOf(settingsMetadata),
    ];
    expect(new Set(descriptions).size).toBe(2);
  });

  // The pages stay client components (accordion state, localStorage prefs), so
  // this pins down WHY the layouts exist: metadata cannot be exported from
  // them. If a page is ever converted to a server component, move the export
  // there and delete this guard.
  it.each(["help", "settings"])(
    "/%s/page.tsx stays a client component, so its layout owns the metadata",
    (route) => {
      const source = fs.readFileSync(
        path.join(APP_ROOT, route, "page.tsx"),
        "utf8",
      );
      expect(source.startsWith('"use client";')).toBe(true);
      expect(source).not.toMatch(/^export const metadata/m);
    },
  );
});
