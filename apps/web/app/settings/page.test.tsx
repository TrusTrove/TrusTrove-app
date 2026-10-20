import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "@/app/settings/page";
import { notificationHistoryKey } from "@/lib/storage";
import { prefsStorageKey } from "@/lib/notification-preferences";

const ADDRESS = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";

vi.mock("@/store/wallet", () => ({
  useWalletStore: vi.fn((selector?: (state: any) => unknown) => {
    const state = { connected: true, address: ADDRESS };
    return selector ? selector(state) : state;
  }),
}));

// The page's chrome is not under test here, and PageLayout pulls in the
// navigation/intl tree that the rest of the suite mocks out the same way.
vi.mock("@/components/shared/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock("@/components/shared/ThemeToggle", () => ({
  ThemeToggle: () => null,
}));

function seedLocalStorage() {
  localStorage.clear();
  localStorage.setItem("trusttrove:theme", "dark");
  localStorage.setItem("trusttrove:display", '{"density":"compact"}');
  localStorage.setItem("trusttrove:marketplace:filters", "{}");
  localStorage.setItem("trusttrove:marketplace:presets", "[]");
  localStorage.setItem(prefsStorageKey(ADDRESS), '{"Invoice Listed":false}');
  localStorage.setItem(notificationHistoryKey(ADDRESS), '[{"id":"n1"}]');
  localStorage.setItem("not-ours:key", "keep me");
}

describe("Settings — Clear All Local Data", () => {
  let confirmMock: ReturnType<typeof vi.spyOn>;
  let alertMock: ReturnType<typeof vi.spyOn>;
  let reloadMock: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    seedLocalStorage();
    confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true);
    alertMock = vi.spyOn(window, "alert").mockImplementation(() => {});
    reloadMock = vi.fn();
    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  const clickClear = () => {
    render(<SettingsPage />);
    fireEvent.click(
      screen.getByRole("button", { name: /clear all local data/i }),
    );
  };

  it("removes the per-wallet notification keys, not only the colon-prefixed settings", () => {
    clickClear();

    // Regression for #1110: the sweep used to match "trusttrove:" only, so the
    // underscore-style notification keys survived and the button silently
    // kept every preference and the whole notification history.
    expect(localStorage.getItem(prefsStorageKey(ADDRESS))).toBeNull();
    expect(localStorage.getItem(notificationHistoryKey(ADDRESS))).toBeNull();
  });

  it("still removes the theme, display, filter and preset keys", () => {
    clickClear();

    expect(localStorage.getItem("trusttrove:theme")).toBeNull();
    expect(localStorage.getItem("trusttrove:display")).toBeNull();
    expect(localStorage.getItem("trusttrove:marketplace:filters")).toBeNull();
    expect(localStorage.getItem("trusttrove:marketplace:presets")).toBeNull();
  });

  it("leaves keys this app does not own in place", () => {
    clickClear();

    expect(localStorage.getItem("not-ours:key")).toBe("keep me");
  });

  it("clears nothing until the user confirms, then reloads", () => {
    confirmMock.mockReturnValue(false);
    render(<SettingsPage />);
    fireEvent.click(
      screen.getByRole("button", { name: /clear all local data/i }),
    );

    expect(localStorage.getItem(prefsStorageKey(ADDRESS))).not.toBeNull();
    expect(reloadMock).not.toHaveBeenCalled();

    confirmMock.mockReturnValue(true);
    fireEvent.click(
      screen.getByRole("button", { name: /clear all local data/i }),
    );
    expect(reloadMock).toHaveBeenCalledOnce();
    expect(alertMock).toHaveBeenCalledWith(
      expect.stringContaining("Local data cleared"),
    );
  });

  it("warns in the confirmation prompt that notification data is included", () => {
    clickClear();

    expect(confirmMock).toHaveBeenCalledWith(
      expect.stringContaining("notification"),
    );
  });
});
