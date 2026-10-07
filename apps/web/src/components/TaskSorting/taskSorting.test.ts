import { describe, expect, it } from "vitest";
import {
  defaultTask,
  defaultProject,
  defaultProjectSection,
  defaultDailyList,
  type ItemForDisplay,
} from "@will-be-done/slices/space";
import { keepTaskInsertionPosition, sortTaskItems } from "./taskSorting";

function task({
  id,
  title = id,
  date,
  dayOrder = "a0",
}: {
  id: string;
  title?: string;
  date?: string;
  dayOrder?: string;
}): ItemForDisplay {
  const item = { ...defaultTask, id, title };
  return {
    item,
    listItem: item,
    project: defaultProject,
    section: defaultProjectSection,
    dailyList: date ? { ...defaultDailyList, id: date, date } : undefined,
    dailyEntry: date
      ? {
          id,
          type: "dailyEntry",
          dailyListId: date,
          orderToken: dayOrder,
          createdAt: 0,
        }
      : undefined,
    dateOfTask: date ? new Date(date) : undefined,
    lastScheduleTime: date ? new Date(date) : undefined,
    hasChecklist: false,
  };
}

const mondayA = task({ id: "A", date: "2026-10-05", dayOrder: "a1" });
const mondayB = task({ id: "B", date: "2026-10-05", dayOrder: "a0" });

describe("task sorting", () => {
  it.each(["before", "after"] as const)(
    "keeps an editing task %s its selected task despite title changes",
    (position) => {
      const anchor = task({ id: "anchor", title: "Middle" });
      const inserted = task({ id: "inserted", title: "Zulu" });
      const items = sortTaskItems({
        items: [inserted, anchor, task({ id: "first", title: "Alpha" })],
        mode: "alphabetical",
      });
      expect(
        keepTaskInsertionPosition(items, {
          taskId: "inserted",
          anchorTaskId: "anchor",
          position,
          focusKey: "task^^inserted",
        }).map((item) => item.item.id),
      ).toEqual(
        position === "before"
          ? ["first", "inserted", "anchor"]
          : ["first", "anchor", "inserted"],
      );
    },
  );

  it("keeps normal sorting when the insertion anchor is removed", () => {
    const items = [task({ id: "inserted" }), mondayA];
    expect(
      keepTaskInsertionPosition(items, {
        taskId: "inserted",
        anchorTaskId: "removed",
        position: "before",
        focusKey: "task^^inserted",
      }),
    ).toEqual(items);
  });

  it("uses saved day order after switching from alphabetical to date", () => {
    const alphabetical = sortTaskItems({
      items: [mondayB, mondayA],
      mode: "alphabetical",
    });
    expect(
      sortTaskItems({ items: alphabetical, mode: "date" }).map(
        (item) => item.item.id,
      ),
    ).toEqual(["B", "A"]);
  });

  it("sorts planned dates first and keeps unscheduled manual order stable", () => {
    const items = [
      task({ id: "unscheduled Z" }),
      task({ id: "Tuesday", date: "2026-10-06" }),
      mondayA,
      task({ id: "unscheduled A" }),
      mondayB,
    ];
    expect(
      sortTaskItems({ items, mode: "date" }).map((item) => item.item.id),
    ).toEqual(["B", "A", "Tuesday", "unscheduled Z", "unscheduled A"]);
  });

  it("preserves the source array and project tokens for display sorts", () => {
    const items = [mondayA, mondayB];
    const before = structuredClone(items);
    sortTaskItems({ items, mode: "date" });
    sortTaskItems({ items, mode: "alphabetical" });
    expect(items).toEqual(before);
  });

  it("returns the existing order for manual mode", () => {
    expect(
      sortTaskItems({ items: [mondayA, mondayB], mode: "manual" }).map(
        (item) => item.item.id,
      ),
    ).toEqual(["A", "B"]);
  });
});
