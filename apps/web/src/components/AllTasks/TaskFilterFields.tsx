import {
  allProjectsSorted,
  allProjectSections,
} from "@will-be-done/slices/space";
import { useAsyncSelector } from "@will-be-done/hyperdb/react";
import { FilterChoices } from "./FilterChoices";
import { PlannedDayFilter } from "./PlannedDayFilter";
import { filterButtonClass } from "./filterStyles";
import {
  columnFilterOptions,
  countTaskFilters,
  type TaskFilters,
} from "./taskFilters";
import { useDebouncedPersistedDraft } from "@/hooks/useDebouncedPersistedDraft";

export function TaskFilterFields({
  filters,
  onChange,
  onReset,
  needsReset = false,
}: {
  filters: TaskFilters;
  onChange: (update: Partial<TaskFilters>) => Promise<void>;
  onReset: () => void;
  needsReset?: boolean;
}) {
  const { data: projects = [] } = useAsyncSelector({
    selector: allProjectsSorted,
    args: {},
  });
  const { data: sections = [] } = useAsyncSelector({
    selector: allProjectSections,
    args: {},
  });
  const activeCount = countTaskFilters(filters);
  const titleFilter = useDebouncedPersistedDraft({
    value: filters.query,
    persist: (query) => onChange({ query }),
  });
  return (
    <>
      <p className="mb-2 text-sm font-semibold">Filters</p>
      <div className="flex flex-col items-stretch gap-2 [&>button]:min-h-10 [&>button]:justify-between">
        <PlannedDayFilter
          value={filters.plannedDay}
          onChange={(plannedDay) => void onChange({ plannedDay })}
        />
        <FilterChoices
          label="State"
          options={[
            { value: "todo", label: "To do" },
            { value: "done", label: "Done" },
          ]}
          selected={filters.states}
          onChange={(states) => void onChange({ states })}
        />
        <FilterChoices
          label="Project"
          options={projects.map((project) => ({
            value: project.id,
            label: project.title,
          }))}
          selected={filters.projectIds}
          onChange={(projectIds) => void onChange({ projectIds })}
        />
        <FilterChoices
          label="Column"
          options={columnFilterOptions(sections)}
          selected={filters.columnNames}
          onChange={(columnNames) => void onChange({ columnNames })}
        />
        <label className="mt-1 text-xs text-content-tinted">
          Title contains
          <input
            aria-label="Filter task titles"
            placeholder="Any title"
            value={titleFilter.draft}
            onChange={(event) => titleFilter.setDraft(event.target.value)}
            onBlur={titleFilter.flush}
            className="mt-1 min-h-9 w-full rounded border border-content-tinted/20 bg-surface px-2 py-1.5 text-xs text-content outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
        {(activeCount > 0 || needsReset) && (
          <button type="button" className={filterButtonClass} onClick={onReset}>
            Reset filters ({activeCount})
          </button>
        )}
      </div>
    </>
  );
}
