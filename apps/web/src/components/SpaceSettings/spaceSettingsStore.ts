import { create } from "zustand";

export type SettingsSection = "general" | "data" | "import" | "shortcuts";

type SpaceSettingsStore = {
  open: boolean;
  spaceName: string;
  activeSection: SettingsSection;
  setActiveSection: (section: SettingsSection) => void;
  openSettings: (spaceName: string) => void;
  openShortcuts: (spaceName: string) => void;
  closeSettings: () => void;
};

export const useSpaceSettingsStore = create<SpaceSettingsStore>((set) => ({
  open: false,
  spaceName: "",
  activeSection: "general",
  setActiveSection: (activeSection) => set({ activeSection }),
  closeSettings: () => set({ open: false, spaceName: "" }),
  openSettings: (spaceName) =>
    set({ open: true, spaceName, activeSection: "general" }),
  openShortcuts: (spaceName) =>
    set({ open: true, spaceName, activeSection: "shortcuts" }),
}));
