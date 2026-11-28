import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  keyboardShortcutsEnabled: boolean;
  setKeyboardShortcutsEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      keyboardShortcutsEnabled: true,
      setKeyboardShortcutsEnabled: (enabled: boolean) =>
        set({ keyboardShortcutsEnabled: enabled }),
    }),
    {
      name: "trusttrove-settings",
    }
  ),
);
