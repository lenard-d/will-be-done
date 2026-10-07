import { describe, expect, it } from "vitest";
import {
  COMMAND_PALETTE_GROUPS,
  isCommandPaletteShortcut,
} from "./commandPaletteCatalog";

const keyboardEvent = (
  code: string,
  modifiers: Partial<
    Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey">
  > = {},
) => ({
  code,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});

describe("command palette", () => {
  it("offers the required navigation categories", () => {
    expect(COMMAND_PALETTE_GROUPS.map((group) => group.id)).toEqual([
      "actions",
      "tabs",
      "settings",
      "projects",
      "views",
    ]);
  });

  it("recognizes Cmd/Ctrl+K but leaves modified variants alone", () => {
    expect(
      isCommandPaletteShortcut(keyboardEvent("KeyK", { ctrlKey: true })),
    ).toBe(true);
    expect(
      isCommandPaletteShortcut(keyboardEvent("KeyK", { metaKey: true })),
    ).toBe(true);
    expect(
      isCommandPaletteShortcut(
        keyboardEvent("KeyK", { ctrlKey: true, shiftKey: true }),
      ),
    ).toBe(false);
    expect(
      isCommandPaletteShortcut(keyboardEvent("KeyJ", { ctrlKey: true })),
    ).toBe(false);
  });
});
