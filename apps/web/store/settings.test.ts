import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "./settings";

describe("useSettingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState({ keyboardShortcutsEnabled: true });
  });

  it("defaults keyboardShortcutsEnabled to true", () => {
    expect(useSettingsStore.getState().keyboardShortcutsEnabled).toBe(true);
  });

  it("updates keyboardShortcutsEnabled correctly", () => {
    useSettingsStore.getState().setKeyboardShortcutsEnabled(false);
    expect(useSettingsStore.getState().keyboardShortcutsEnabled).toBe(false);
  });
});
