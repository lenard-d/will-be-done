import { z } from "zod";
import type { ItemForDisplay } from "@will-be-done/slices/space";

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
  sectionIds: z.array(z.string()),
  plannedDay: plannedDayFilterSchema,
});

export type TaskFilters = z.infer<typeof taskFiltersSchema>;
export type PlannedDayFilter = TaskFilters["plannedDay"];

export const emptyTaskFilters: TaskFilters = {
  query: "",
  states: [],
  projectIds: [],
  sectionIds: [],
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
          (!filters.sectionIds.length ||
            filters.sectionIds.includes(section.id)) &&
          matchesPlannedDay(dailyList?.date, filters.plannedDay))),
  );
}

export function countTaskFilters(filters: TaskFilters) {
  return [
    !!filters.query.trim(),
    filters.states.length > 0,
    filters.projectIds.length > 0,
    filters.sectionIds.length > 0,
    filters.plannedDay.kind !== "all",
  ].filter(Boolean).length;
}
