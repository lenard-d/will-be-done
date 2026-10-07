import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";
import {
  emptyTaskFilters,
  taskFiltersSchema,
  type TaskFilters,
} from "./taskFilters";

const savedFiltersSchema = z.object({
  filtersBySpace: z.record(z.string(), taskFiltersSchema),
});

type FilterStore = {
  filtersBySpace: Record<string, TaskFilters>;
  updateFilters: (spaceId: string, update: Partial<TaskFilters>) => void;
  resetFilters: (spaceId: string) => void;
};

const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      filtersBySpace: {},
      updateFilters: (spaceId, update) =>
        set((state) => ({
          filtersBySpace: {
            ...state.filtersBySpace,
            [spaceId]: {
              ...(state.filtersBySpace[spaceId] ?? emptyTaskFilters),
              ...update,
            },
          },
        })),
      resetFilters: (spaceId) =>
        set((state) => ({
          filtersBySpace: {
            ...state.filtersBySpace,
            [spaceId]: emptyTaskFilters,
          },
        })),
    }),
    {
      name: "will-be-done:all-task-filters",
      partialize: ({ filtersBySpace }) => ({ filtersBySpace }),
      merge: (saved, current) => {
        const parsed = savedFiltersSchema.safeParse(saved);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

export function useTaskFilters(spaceId: string) {
  const filters = useFilterStore(
    (state) => state.filtersBySpace[spaceId] ?? emptyTaskFilters,
  );
  const updateFilters = useFilterStore((state) => state.updateFilters);
  const resetFilters = useFilterStore((state) => state.resetFilters);
  return {
    filters,
    updateFilters: (update: Partial<TaskFilters>) =>
      updateFilters(spaceId, update),
    resetFilters: () => resetFilters(spaceId),
  };
}
