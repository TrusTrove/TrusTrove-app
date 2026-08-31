import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("concatenates multiple class names into a single string", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("returns an empty string when no arguments are provided", () => {
    expect(cn()).toBe("");
  });

  it("strips falsy values and only keeps truthy class names", () => {
    expect(cn(false, null, undefined, 0, "", "active", "hidden")).toBe(
      "active hidden",
    );
  });

  it("resolves conflicting Tailwind utility classes in favour of the last value", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-lg", "text-xl")).toBe("text-xl");
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });

  it("accepts clsx-style conditional objects and arrays", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
    expect(cn(["text-sm", "font-bold"], "text-lg")).toBe("font-bold text-lg");
  });
});
