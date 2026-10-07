import { z } from "zod";

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
  columnNames: z
    .array(z.string().transform((title) => title.trim().toLowerCase()))
    .default([]),
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

export function normalizeTaskFiltersJson(filtersJson: string) {
  return JSON.stringify(taskFiltersSchema.parse(JSON.parse(filtersJson)));
}
