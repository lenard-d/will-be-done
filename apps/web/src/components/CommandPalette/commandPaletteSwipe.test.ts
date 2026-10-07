import { describe, expect, it } from "vitest";
import { getCommandPaletteSwipeProgress } from "./commandPaletteSwipe";

const start = { x: 180, y: 40 };

describe("command palette pull", () => {
  it.each([
    { name: "tiny movement", x: 182, y: 44, phase: "pending" },
    { name: "upward movement", x: 180, y: 32, phase: "cancelled" },
    { name: "sideways intent", x: 210, y: 48, phase: "pending" },
    { name: "downward intent", x: 184, y: 48, phase: "dragging", distance: 8 },
  ])(
    "recognizes $name before claiming the touch",
    ({ name: _name, x, y, ...result }) => {
      expect(
        getCommandPaletteSwipeProgress({
          start,
          current: { x, y },
          pulling: false,
        }),
      ).toEqual(result);
    },
  );

  it.each([
    { name: "sideways drift", x: 360, y: 130, distance: 90 },
    { name: "retraction", x: 220, y: 65, distance: 25 },
    { name: "return above the start", x: 180, y: 10, distance: 0 },
    { name: "continued downward movement", x: 200, y: 260, distance: 220 },
  ])(
    "uses vertical distance for $name after claiming",
    ({ name: _name, x, y, distance }) => {
      expect(
        getCommandPaletteSwipeProgress({
          start,
          current: { x, y },
          pulling: true,
        }),
      ).toEqual({ phase: "dragging", distance });
    },
  );
});
