import "vitest";
import "vitest-axe/extend-expect";

// vitest-axe/extend-expect augments the global Vi namespace.
// This ensures the matcher types are available when importing expect from vitest.
declare module "vitest" {
  interface Assertion<T = any> {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
