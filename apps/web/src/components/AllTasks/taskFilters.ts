import type { TaskFilters, PlannedDayFilter } from "@will-be-done/slices/space";
export {
  plannedDayFilterSchema,
  taskFiltersSchema,
  emptyTaskFilters,
  type TaskFilters,
  type PlannedDayFilter,
} from "@will-be-done/slices/space";
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
