import { describe, expect, it } from "vitest";
import { sortedTaskDrop } from "./sortedTaskDrop";

const target = {
  modelId: "A",
  taskSortMode: "date",
  taskSortDailyListId: "Monday",
};

describe("sorted row drop", () => {
  it("dispatches day reorder for same-day project rows", () => {
    expect(
      sortedTaskDrop({
        sourceId: "B",
        sourceDailyListId: "Monday",
        target,
        edge: "top",
      }).action,
    ).toBeDefined();
  });

  it("blocks cross-day drops in project and all tasks lists", () => {
    expect(
      sortedTaskDrop({
        sourceId: "B",
        sourceDailyListId: "Tuesday",
        target,
        edge: "top",
      }),
    ).toEqual({ handled: true });
  });

  it("keeps calendar cross-day scheduling available", () => {
    expect(
      sortedTaskDrop({
        sourceId: "B",
        sourceDailyListId: "Tuesday",
        target: { ...target, taskSortCalendar: true },
        edge: "top",
      }),
    ).toEqual({ handled: false });
  });

  it("blocks alphabetical day reorder without rewriting project tokens", () => {
    expect(
      sortedTaskDrop({
        sourceId: "B",
        sourceDailyListId: "Monday",
        target: { ...target, taskSortMode: "alphabetical" },
        edge: "top",
      }),
    ).toEqual({ handled: true });
  });
});
