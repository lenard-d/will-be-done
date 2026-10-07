import { z } from "zod";
import { emptyTaskFilters, taskFiltersSchema } from "./taskFilters";

const savedFiltersSchema = z.object({
  state: z.object({
    filtersBySpace: z.record(z.string(), taskFiltersSchema),
  }),
});

/** Keep the former device filters when the first saved column is created. */
export function readLegacyTaskFilters(spaceId: string) {
  try {
    const saved = localStorage.getItem("will-be-done:all-task-filters");
    const parsed = savedFiltersSchema.safeParse(
      saved ? JSON.parse(saved) : null,
    );
    return parsed.success
      ? (parsed.data.state.filtersBySpace[spaceId] ?? emptyTaskFilters)
      : emptyTaskFilters;
  } catch {
    return emptyTaskFilters;
  }
}
