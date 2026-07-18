import { describe, expect, it } from "vitest";
import {
  getHabitRoutineSelection,
  getHabitShortcut,
  getRoutineMoveTarget,
  normalizeTargetTimeInput,
} from "./habitInteractions";

const key = (
  code: string,
  modifiers: Partial<
    Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "altKey">
  > = {},
) => ({
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers,
});

describe("habit keyboard shortcuts", () => {
  it("matches task navigation, edit, toggle, actions and delete conventions", () => {
    expect(getHabitShortcut(key("Space"))).toBe("toggle");
    expect(getHabitShortcut(key("Enter"))).toBe("edit");
    expect(getHabitShortcut(key("KeyI"))).toBe("edit");
    expect(getHabitShortcut(key("KeyA"))).toBe("actions");
    expect(getHabitShortcut(key("KeyV"))).toBe("details");
    expect(getHabitShortcut(key("KeyM"))).toBe("move-routine");
    expect(getHabitShortcut(key("KeyO"))).toBe("add-after");
    expect(getHabitShortcut(key("KeyO", { shiftKey: true }))).toBe(
      "add-before",
    );
    expect(getHabitShortcut(key("KeyD"))).toBe("delete");
    expect(getHabitShortcut(key("Escape"))).toBe("escape");
    expect(getHabitShortcut(key("KeyM", { shiftKey: true }))).toBeNull();
  });

  it("maps control + vim keys to persistent movement", () => {
    expect(getHabitShortcut(key("KeyK", { ctrlKey: true }))).toBe("move-up");
    expect(getHabitShortcut(key("KeyJ", { ctrlKey: true }))).toBe("move-down");
    expect(getHabitShortcut(key("KeyH", { ctrlKey: true }))).toBe("move-left");
    expect(getHabitShortcut(key("KeyL", { ctrlKey: true }))).toBe("move-right");
    expect(getHabitShortcut(key("KeyE", { metaKey: true }))).toBeNull();
  });
});

describe("habit target time input", () => {
  it("normalizes valid values and rejects invalid clock times", () => {
    expect(normalizeTargetTimeInput(" 08:30 ")).toBe("08:30");
    expect(normalizeTargetTimeInput("")).toBeNull();
    expect(normalizeTargetTimeInput("24:00")).toBeUndefined();
    expect(normalizeTargetTimeInput("8:30")).toBeUndefined();
  });
});

describe("habit details routine selection", () => {
  const routines = [
    { id: "active", archivedAt: null },
    { id: "archived", archivedAt: 1 },
  ];

  it("keeps active assignments and normalizes missing or archived ones", () => {
    expect(getHabitRoutineSelection("active", routines, "unassigned")).toBe(
      "active",
    );
    expect(getHabitRoutineSelection(null, routines, "unassigned")).toBe(
      "unassigned",
    );
    expect(getHabitRoutineSelection("missing", routines, "unassigned")).toBe(
      "unassigned",
    );
    expect(
      getHabitRoutineSelection("archived", routines, "unassigned"),
    ).toBe("unassigned");
  });
});

describe("routine movement", () => {
  const ids = ["morning", "afternoon", "evening"];

  it("places a routine around its adjacent sibling", () => {
    expect(getRoutineMoveTarget(ids, "afternoon", "left")).toEqual({
      targetId: "morning",
      edge: "top",
    });
    expect(getRoutineMoveTarget(ids, "afternoon", "right")).toEqual({
      targetId: "evening",
      edge: "bottom",
    });
  });

  it("returns null at board boundaries", () => {
    expect(getRoutineMoveTarget(ids, "morning", "left")).toBeNull();
    expect(getRoutineMoveTarget(ids, "evening", "right")).toBeNull();
  });
});
