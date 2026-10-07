import { describe, expect, it } from "vitest";
import {
  defaultTask,
  defaultProject,
  defaultProjectSection,
  defaultDailyList,
  type ItemForDisplay,
} from "@will-be-done/slices/space";
import {
  emptyTaskFilters,
  filterTaskItems,
  taskFiltersSchema,
  type PlannedDayFilter,
} from "./taskFilters";

function task({
  id,
  projectId = "inbox",
  sectionId = "inbox-column",
  state = "todo",
  date,
}: {
  id: string;
  projectId?: string;
  sectionId?: string;
  state?: "todo" | "done";
  date?: string;
}): ItemForDisplay {
  const item = { ...defaultTask, id, title: id, state };
  return {
    item,
    listItem: item,
    project: { ...defaultProject, id: projectId },
    section: { ...defaultProjectSection, id: sectionId, projectId },
    dailyList: date ? { ...defaultDailyList, date } : undefined,
    dateOfTask: undefined,
    lastScheduleTime: new Date("2026-10-08T12:00:00"),
    hasChecklist: false,
  };
}

const items = [
  task({ id: "before", date: "2026-10-07" }),
  task({ id: "start", date: "2026-10-08" }),
  task({
    id: "middle",
    projectId: "work",
    sectionId: "blocked",
    date: "2026-10-10",
    state: "done",
  }),
  task({
    id: "end",
    projectId: "work",
    sectionId: "blocked",
    date: "2026-10-12",
  }),
  task({ id: "after", date: "2026-10-13" }),
  task({ id: "unscheduled", projectId: "work", sectionId: "work-column" }),
];

describe("All tasks filters", () => {
  it("shows every task when no filters are set", () => {
    expect(filterTaskItems(items, emptyTaskFilters)).toEqual(items);
  });
  it("matches multiple projects and columns while requiring the selected state", () => {
    expect(
      filterTaskItems(items, {
        ...emptyTaskFilters,
        projectIds: ["inbox", "work"],
        sectionIds: ["inbox-column", "blocked"],
        states: ["todo"],
      }).map(({ item }) => item.id),
    ).toEqual(["before", "start", "end", "after"]);
  });
  it.each<{ filter: PlannedDayFilter; expected: string[] }>([
    {
      filter: { kind: "scheduled" },
      expected: ["before", "start", "middle", "end", "after"],
    },
    { filter: { kind: "unscheduled" }, expected: ["unscheduled"] },
    { filter: { kind: "on", date: "2026-10-08" }, expected: ["start"] },
    {
      filter: { kind: "range", from: "2026-10-08", to: "2026-10-12" },
      expected: ["start", "middle", "end"],
    },
    {
      filter: { kind: "range", from: "2026-10-12", to: null },
      expected: ["end", "after"],
    },
    {
      filter: { kind: "range", from: null, to: "2026-10-08" },
      expected: ["before", "start"],
    },
  ])(
    "matches $filter.kind using the current scheduled day",
    ({ filter, expected }) => {
      expect(
        filterTaskItems(items, { ...emptyTaskFilters, plannedDay: filter }).map(
          ({ item }) => item.id,
        ),
      ).toEqual(expected);
    },
  );
  it("combines the date range with project, column, state, and title search", () => {
    expect(
      filterTaskItems(items, {
        ...emptyTaskFilters,
        query: "  END  ",
        projectIds: ["work"],
        sectionIds: ["blocked"],
        states: ["todo"],
        plannedDay: { kind: "range", from: "2026-10-08", to: "2026-10-12" },
      }).map(({ item }) => item.id),
    ).toEqual(["end"]);
  });
  it("keeps a task visible during title editing even if it no longer matches", () => {
    expect(
      filterTaskItems(
        items,
        { ...emptyTaskFilters, query: "missing" },
        "start",
      ).map(({ item }) => item.id),
    ).toEqual(["start"]);
  });
  it("applies the title filter again when editing ends", () => {
    expect(
      filterTaskItems(items, { ...emptyTaskFilters, query: "missing" }),
    ).toEqual([]);
  });
  it.each([
    { kind: "on", date: "2026-02-30" },
    { kind: "range", from: "2026-10-12", to: "2026-10-08" },
    { kind: "old-mode" },
  ])("rejects invalid saved date filters: $kind", (plannedDay) => {
    expect(
      taskFiltersSchema.safeParse({ ...emptyTaskFilters, plannedDay }).success,
    ).toBe(false);
  });
});
