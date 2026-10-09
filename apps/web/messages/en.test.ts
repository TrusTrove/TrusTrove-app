import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import messages from "./en.json";

// Typed messages are not configured, so a mistyped key would only surface at
// runtime. This test statically checks each migrated file against en.json:
// every `t("…")` / `t.rich("…")` key must resolve to a string in the file's
// namespace, and every string in that namespace must be used by the file.
// Keys must be string literals so the check stays complete.
//
// When migrating another surface with static keys, add it here.
const MIGRATED_FILES = ["app/dashboard/page.tsx", "app/marketplace/page.tsx"];

const WEB_ROOT = path.resolve(__dirname, "..");

type MessageTree = { [key: string]: string | MessageTree };

function resolve(tree: MessageTree, keyPath: string): unknown {
  return keyPath
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === "object"
          ? (node as MessageTree)[segment]
          : undefined,
      tree,
    );
}

function leafKeys(tree: MessageTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [`${prefix}${key}`]
      : leafKeys(value, `${prefix}${key}.`),
  );
}

describe.each(MIGRATED_FILES)("messages used by %s", (file) => {
  const source = fs.readFileSync(path.join(WEB_ROOT, file), "utf8");
  const namespaces = [
    ...source.matchAll(/useTranslations\(\s*"([^"]+)"\s*\)/g),
  ].map((match) => match[1]);
  const namespace = namespaces[0];
  const keys = new Set(
    [...source.matchAll(/\bt(?:\.rich)?\(\s*"([^"]+)"/g)].map(
      (match) => match[1],
    ),
  );

  it("reads a single namespace that exists in en.json", () => {
    expect(namespaces).toHaveLength(1);
    expect(resolve(messages, namespace)).toBeTypeOf("object");
  });

  it("only passes string-literal keys to t()", () => {
    const firstArgs = [...source.matchAll(/\bt(?:\.rich)?\(\s*(\S)/g)].map(
      (match) => match[1],
    );
    expect(firstArgs.length).toBeGreaterThan(0);
    expect(firstArgs.every((char) => char === '"')).toBe(true);
  });

  it("uses only keys that exist in en.json", () => {
    const missing = [...keys].filter(
      (key) => typeof resolve(messages, `${namespace}.${key}`) !== "string",
    );
    expect(missing).toEqual([]);
  });

  it("leaves no unused keys in its namespace", () => {
    const tree = resolve(messages, namespace) as MessageTree;
    const unused = leafKeys(tree).filter((key) => !keys.has(key));
    expect(unused).toEqual([]);
  });
});
