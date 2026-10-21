/// <reference types="vite/client" />
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

/**
 * Guards the `*.stories.tsx` files against the placeholder-stub failure mode: a
 * story that hand-rolls raw HTML instead of importing the component it claims
 * to document. Storybook itself is not part of the workspace install, so this
 * is the gate that keeps `pnpm --filter web test` honest about story coverage.
 */

type StoryMeta = {
  title?: unknown;
  component?: unknown;
  decorators?: unknown;
};

type StoryModule = { default?: StoryMeta } & Record<string, unknown>;

const storyModules = import.meta.glob("./**/*.stories.tsx", {
  eager: true,
}) as Record<string, StoryModule>;

const storyEntries = Object.entries(storyModules);

function isRenderableComponent(value: unknown): boolean {
  return (
    typeof value === "function" ||
    (typeof value === "object" && value !== null && "$$typeof" in value)
  );
}

/** The element a story produces, from either the function or CSF3 object form. */
function storyElement(story: unknown): React.ReactElement | null {
  if (typeof story === "function") {
    return (story as (args: Record<string, unknown>) => React.ReactElement)({});
  }
  if (typeof story === "object" && story !== null) {
    const objectStory = story as {
      render?: (args: Record<string, unknown>) => React.ReactElement;
      args?: Record<string, unknown>;
    };
    if (typeof objectStory.render === "function") {
      return objectStory.render(objectStory.args ?? {});
    }
  }
  return null;
}

/** Whether `component` is actually created anywhere in the element tree. */
function treeUsesComponent(node: React.ReactNode, component: unknown): boolean {
  if (Array.isArray(node)) {
    return node.some((child) => treeUsesComponent(child, component));
  }
  if (typeof node !== "object" || node === null) return false;
  const element = node as React.ReactElement<{ children?: React.ReactNode }>;
  if (element.type === component) return true;
  return treeUsesComponent(element.props?.children, component);
}

function applyDecorators(
  element: React.ReactElement,
  decorators: unknown,
): React.ReactElement {
  const list = Array.isArray(decorators) ? decorators : [];
  return list.reduce(
    (wrapped, decorate) =>
      (decorate as (story: () => React.ReactElement) => React.ReactElement)(
        () => wrapped,
      ),
    element,
  );
}

it("finds stories in the directory Storybook is configured to load", () => {
  expect(storyEntries.length).toBeGreaterThan(0);
});

describe.each(storyEntries)("%s", (filePath, module) => {
  const meta = module.default;
  const storyNames = Object.keys(module).filter(
    (name) => name !== "default" && name !== "meta",
  );

  it("declares a title and the component under documentation", () => {
    expect(meta, `${filePath} has no default meta export`).toBeDefined();
    expect(typeof meta?.title).toBe("string");
    expect(meta?.title).not.toBe("");
    if (!isRenderableComponent(meta?.component)) {
      throw new Error(
        `${filePath}: meta.component must be the imported component, so a placeholder story cannot stand in for it`,
      );
    }
  });

  it("exports at least one story", () => {
    expect(storyNames.length).toBeGreaterThan(0);
  });

  describe.each(storyNames)(`%s`, (storyName) => {
    it("renders the documented component rather than hand-written markup", () => {
      const element = storyElement(module[storyName]);
      if (!element) {
        throw new Error(
          `${filePath} > ${storyName}: expected a story function or a CSF3 object with render()`,
        );
      }
      if (!treeUsesComponent(element, meta?.component)) {
        throw new Error(
          `${filePath} > ${storyName}: does not create the component named by meta.component`,
        );
      }

      const mounted = render(applyDecorators(element, meta?.decorators));
      expect(mounted.container.firstChild).not.toBeNull();
    });
  });
});
