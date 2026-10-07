import { describe, expect, it } from "vitest";
import {
  defaultTask,
  defaultProject,
  defaultProjectSection,
  defaultDailyList,
  type ItemForDisplay,
} from "@will-be-done/slices/space";
import {
  columnFilterOptions,
  emptyTaskFilters,
  filterTaskItems,
  taskFiltersSchema,
  type PlannedDayFilter,
} from "./taskFilters";

function task({
  id,
  projectId = "inbox",
  sectionId = "inbox-column",
  columnTitle = "Week",
  state = "todo",
  date,
}: {
  id: string;
  projectId?: string;
  sectionId?: string;
  columnTitle?: string;
  state?: "todo" | "done";
  date?: string;
}): ItemForDisplay {
  const item = { ...defaultTask, id, title: id, state };
  return {
    item,
    listItem: item,
    project: { ...defaultProject, id: projectId },
    section: {
      ...defaultProjectSection,
      id: sectionId,
      projectId,
      title: columnTitle,
    },
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
    columnTitle: "Blocked",
    date: "2026-10-10",
    state: "done",
  }),
  task({
    id: "end",
    projectId: "work",
    sectionId: "blocked",
    columnTitle: "Blocked",
    date: "2026-10-12",
  }),
  task({ id: "after", date: "2026-10-13" }),
  task({
    id: "unscheduled",
    projectId: "work",
    sectionId: "work-column",
    columnTitle: "Later",
  }),
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
        columnNames: ["week", "blocked"],
        states: ["todo"],
      }).map(({ item }) => item.id),
    ).toEqual(["before", "start", "end", "after"]);
  });
  it("matches columns with the same name across projects and different IDs", () => {
    const tasks = [
      task({
        id: "home",
        projectId: "home",
        sectionId: "home-blocked",
        columnTitle: "Blocked",
      }),
      task({
        id: "work",
        projectId: "work",
        sectionId: "work-blocked",
        columnTitle: " blocked ",
      }),
      task({ id: "other", projectId: "work", columnTitle: "Week" }),
    ];
    expect(
      filterTaskItems(tasks, {
        ...emptyTaskFilters,
        columnNames: ["blocked"],
      }).map(({ item }) => item.id),
    ).toEqual(["home", "work"]);
  });
  it("can narrow shared columns with the project filter", () => {
    const tasks = [
      task({ id: "home", projectId: "home", columnTitle: "Blocked" }),
      task({ id: "work", projectId: "work", columnTitle: "Blocked" }),
    ];
    expect(
      filterTaskItems(tasks, {
        ...emptyTaskFilters,
        columnNames: ["blocked"],
        projectIds: ["work"],
      }).map(({ item }) => item.id),
    ).toEqual(["work"]);
  });
  it("offers each column name once in alphabetical order", () => {
    const sections = [
      { ...defaultProjectSection, id: "a", title: "Week" },
      { ...defaultProjectSection, id: "b", title: "Blocked" },
      { ...defaultProjectSection, id: "c", title: " blocked " },
    ];
    expect(columnFilterOptions(sections)).toEqual([
      { value: "blocked", label: "Blocked" },
      { value: "week", label: "Week" },
    ]);
  });
  it("retains other saved filters when replacing legacy column IDs", () => {
    const { columnNames: _columnNames, ...legacy } = emptyTaskFilters;
    expect(
      taskFiltersSchema.parse({
        ...legacy,
        query: "keep",
        sectionIds: ["old-column"],
      }),
    ).toEqual({ ...emptyTaskFilters, query: "keep" });
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
        columnNames: ["blocked"],
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
