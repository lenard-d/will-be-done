import { z } from "zod";
import type {
  ItemForDisplay,
  ProjectSection,
} from "@will-be-done/slices/space";

function columnName(title: string) {
  return title.trim().toLowerCase();
}

export function columnFilterOptions(sections: readonly ProjectSection[]) {
  const labels = new Map<string, string>();
  for (const section of sections) {
    const value = columnName(section.title);
    if (!labels.has(value))
      labels.set(value, section.title.trim() || "Untitled");
  }
  return Array.from(labels, ([value, label]) => ({ value, label })).sort(
    (left, right) => left.label.localeCompare(right.label),
  );
}

export const plannedDayFilterSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("scheduled") }),
  z.object({ kind: z.literal("unscheduled") }),
  z.object({ kind: z.literal("on"), date: z.iso.date() }),
  z
    .object({
      kind: z.literal("range"),
      from: z.iso.date().nullable(),
      to: z.iso.date().nullable(),
    })
    .refine(({ from, to }) => !from || !to || from <= to),
]);

export const taskFiltersSchema = z.object({
  query: z.string(),
  states: z.array(z.enum(["todo", "done"])),
  projectIds: z.array(z.string()),
  columnNames: z.array(z.string().transform(columnName)).default([]),
  plannedDay: plannedDayFilterSchema,
});

export type TaskFilters = z.infer<typeof taskFiltersSchema>;
export type PlannedDayFilter = TaskFilters["plannedDay"];

export const emptyTaskFilters: TaskFilters = {
  query: "",
  states: [],
  projectIds: [],
  columnNames: [],
  plannedDay: { kind: "all" },
};

function matchesPlannedDay(date: string | undefined, filter: PlannedDayFilter) {
  switch (filter.kind) {
    case "all":
      return true;
    case "scheduled":
      return !!date;
    case "unscheduled":
      return !date;
    case "on":
      return date === filter.date;
    case "range":
      return (
        !!date &&
        (!filter.from || date >= filter.from) &&
        (!filter.to || date <= filter.to)
      );
  }
}

/** Match any selected value within a filter and every active filter together. */
export function filterTaskItems(
  items: readonly ItemForDisplay[],
  filters: TaskFilters,
  editingTaskId?: string,
) {
  const query = filters.query.trim().toLocaleLowerCase();
  return items.filter(
    ({ item, project, section, dailyList }) =>
      item.type === "task" &&
      (item.id === editingTaskId ||
        ((!query || item.title.toLocaleLowerCase().includes(query)) &&
          (!filters.states.length || filters.states.includes(item.state)) &&
          (!filters.projectIds.length ||
            filters.projectIds.includes(project.id)) &&
          (!filters.columnNames.length ||
            filters.columnNames.includes(columnName(section.title))) &&
          matchesPlannedDay(dailyList?.date, filters.plannedDay))),
  );
}

export function countTaskFilters(filters: TaskFilters) {
  return [
    !!filters.query.trim(),
    filters.states.length > 0,
    filters.projectIds.length > 0,
    filters.columnNames.length > 0,
    filters.plannedDay.kind !== "all",
  ].filter(Boolean).length;
}
