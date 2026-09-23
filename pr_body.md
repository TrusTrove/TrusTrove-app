This PR resolves the following performance and testing issues assigned to this repository.

- closes #662
- closes #304
- closes #303

## Changes

- **Issue 662**: Refactored `DiscountCalculator`'s child components (`SmeCalculator` and `LpCalculator`). Memoized all derived mathematical values using `useMemo` and bound the slider `onChange` handlers via `useCallback`. This breaks the cycle where keystrokes on one slider triggered redundant re-renders and re-initialized `AnimatedValue` requestAnimationFrame loops for unrelated components.
- **Issue 304**: Added `useFocusTrap.test.tsx` verifying keyboard entrapment semantics, Tab/Shift-Tab key propagation boundaries, and Escape key dismissal workflows inside `useFocusTrap` via `vitest` and `@testing-library/react`.
- **Issue 303**: Implemented `Navbar.test.tsx` providing testing coverage for the primary top-bar navigation component, including verifying the mobile toggle logic and component rendering states using mocked routing and wallet endpoints.
