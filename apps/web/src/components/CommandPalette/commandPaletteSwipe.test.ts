import { describe, expect, it } from "vitest";
import { getCommandPaletteSwipeProgress } from "./commandPaletteSwipe";

const start = { x: 180, y: 40, time: 100 };

describe("command palette swipe", () => {
  it.each([
    { name: "short pull", x: 180, y: 95, time: 300, result: "pending" },
    { name: "threshold pull", x: 180, y: 96, time: 300, result: "ready" },
    {
      name: "small sideways drift",
      x: 204,
      y: 100,
      time: 300,
      result: "ready",
    },
    { name: "sideways pull", x: 205, y: 100, time: 300, result: "cancelled" },
    {
      name: "early sideways direction",
      x: 190,
      y: 45,
      time: 150,
      result: "cancelled",
    },
    { name: "upward pull", x: 180, y: 31, time: 300, result: "cancelled" },
    {
      name: "small finger movement",
      x: 183,
      y: 37,
      time: 150,
      result: "pending",
    },
    { name: "duration limit", x: 180, y: 100, time: 850, result: "ready" },
    { name: "long hold", x: 180, y: 100, time: 851, result: "cancelled" },
  ])("handles $name", ({ name: _name, result, ...current }) => {
    expect(getCommandPaletteSwipeProgress(start, current)).toBe(result);
  });
});
