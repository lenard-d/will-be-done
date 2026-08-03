import { describe, expect, it } from "vitest";
import { SHORTCUT_GROUPS } from "./shortcutCatalog";

const shortcuts = SHORTCUT_GROUPS.flatMap((group) => group.shortcuts);

describe("shortcut catalog", () => {
  it("has unique, nonempty group and shortcut metadata", () => {
    const groupIds = SHORTCUT_GROUPS.map((group) => group.id);
    const shortcutIds = shortcuts.map((shortcut) => shortcut.id);

    expect(new Set(groupIds).size).toBe(groupIds.length);
    expect(new Set(shortcutIds).size).toBe(shortcutIds.length);

    for (const group of SHORTCUT_GROUPS) {
      expect(group.id.trim()).not.toBe("");
      expect(group.label.trim()).not.toBe("");
      expect(group.description.trim()).not.toBe("");
      expect(group.shortcuts.length).toBeGreaterThan(0);

      for (const shortcut of group.shortcuts) {
        expect(shortcut.id.trim()).not.toBe("");
        expect(shortcut.label.trim()).not.toBe("");
        expect(shortcut.keys.length).toBeGreaterThan(0);

        for (const chord of shortcut.keys) {
          expect(chord.length).toBeGreaterThan(0);
          expect(chord.every((key) => key.trim().length > 0)).toBe(true);
        }
      }
    }
  });

  it("contains the canonical navigation, task, view, and desktop shortcuts", () => {
    const byId = new Map(shortcuts.map((shortcut) => [shortcut.id, shortcut]));

    expect(byId.get("focus-next-item")?.keys).toEqual([["Arrow Down"], ["J"]]);
    expect(byId.get("task-toggle-state")?.keys).toEqual([["Space"]]);
    expect(byId.get("task-add-before")?.keys).toEqual([["Shift", "O"]]);
    expect(byId.get("sidebar-toggle")?.keys).toEqual([["Ctrl/Cmd", "B"]]);
    expect(byId.get("desktop-quick-add")?.keys).toEqual([
      ["Ctrl/Cmd", "Shift", "A"],
    ]);
    expect(byId.get("move-dialog-next")?.keys).toEqual([
      ["Arrow Down"],
      ["Ctrl", "J"],
    ]);
  });
});
