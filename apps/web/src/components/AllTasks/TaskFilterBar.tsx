import {
  allProjectsSorted,
  allProjectSections,
  type ItemForDisplay,
} from "@will-be-done/slices/space";
import { useAsyncSelector } from "@will-be-done/hyperdb/react";
import { FilterChoices } from "./FilterChoices";
import { PlannedDayFilter } from "./PlannedDayFilter";
import { filterButtonClass } from "./filterStyles";
import { countTaskFilters, type TaskFilters } from "./taskFilters";

export function TaskFilterBar({
  items,
  filters,
  onChange,
  onReset,
  resultCount,
}: {
  items: ItemForDisplay[];
  filters: TaskFilters;
  onChange: (update: Partial<TaskFilters>) => void;
  onReset: () => void;
  resultCount: number;
}) {
  const { data: allProjects = [] } = useAsyncSelector({
    selector: allProjectsSorted,
    args: {},
  });
  const { data: allSections = [] } = useAsyncSelector({
    selector: allProjectSections,
    args: {},
  });
  const projects = allProjects.map((project) => ({
    value: project.id,
    label: project.title,
  }));
  const sections = allProjects.flatMap((project) =>
    allSections
      .filter(
        (section) =>
          section.projectId === project.id &&
          (!filters.projectIds.length ||
            filters.projectIds.includes(project.id) ||
            filters.sectionIds.includes(section.id)),
      )
      .sort((left, right) => left.orderToken.localeCompare(right.orderToken))
      .map((section) => ({
        value: section.id,
        label: `${project.title} / ${section.title}`,
      })),
  );
  const activeCount = countTaskFilters(filters);
  return (
    <div
      className="mx-auto w-full max-w-3xl px-4 pb-5"
      role="region"
      aria-label="Task filters"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Search task titles"
          placeholder="Search task titles..."
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
          className="min-w-0 flex-1 basis-48 rounded border border-content-tinted/20 bg-surface px-2 py-1.5 text-xs text-content outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <PlannedDayFilter
          value={filters.plannedDay}
          onChange={(plannedDay) => onChange({ plannedDay })}
        />
        <FilterChoices
          label="State"
          options={[
            { value: "todo", label: "To do" },
            { value: "done", label: "Done" },
          ]}
          selected={filters.states}
          onChange={(states) => onChange({ states })}
        />
        <FilterChoices
          label="Project"
          options={projects}
          selected={filters.projectIds}
          onChange={(projectIds) => onChange({ projectIds })}
        />
        <FilterChoices
          label="Column"
          options={sections}
          selected={filters.sectionIds}
          onChange={(sectionIds) => onChange({ sectionIds })}
        />
        {activeCount > 0 && (
          <button type="button" className={filterButtonClass} onClick={onReset}>
            Reset filters ({activeCount})
          </button>
        )}
      </div>
      <p role="status" className="mt-2 text-xs text-content-tinted">
        {resultCount} of {items.length} tasks
      </p>
    </div>
  );
}
