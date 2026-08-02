import {
  defineTable,
  ExtractSchema,
  type Infer,
  v,
} from "@will-be-done/hyperdb";
import { registerSpaceSyncableTable } from "./syncMap";
import { isObjectType } from "..";

export const taskType = "task";
export const tasksTable = defineTable("tasks", {
  type: v.literal(taskType),
  id: v.string(),
  title: v.string(),
  content: v.optional(v.string()),
  state: v.union(v.literal("todo"), v.literal("done")),
  projectSectionId: v.string(),
  orderToken: v.string(),
  lastToggledAt: v.number(),
  nature: v.optional(
    v.union(v.literal("red"), v.literal("green"), v.literal("unknown")),
  ),
  createdAt: v.number(),
  templateId: v.union(v.string(), v.null()),
  templateDate: v.union(v.number(), v.null()),
})
  .index("byIds", ["id"])
  .index("byProjectSectionIdOrderStates", [
    "projectSectionId",
    "state",
    "orderToken",
  ])
  .index("byProjectSectionIdStatesToggledAt", [
    "projectSectionId",
    "state",
    "lastToggledAt",
  ])
  .index("byTemplateId", ["templateId"]);
registerSpaceSyncableTable(tasksTable, taskType);

export type Task = ExtractSchema<typeof tasksTable>;
export type TaskNature = Task["nature"];
export const isTask = isObjectType<Task>(taskType);

export const taskTemplateType = "template";
export const taskTemplatesTable = defineTable("task_templates", {
  type: v.literal(taskTemplateType),
  id: v.string(),
  title: v.string(),
  content: v.optional(v.string()),
  orderToken: v.string(),
  repeatRule: v.string(),
  repeatRuleDtStart: v.number(),
  createdAt: v.number(),
  lastGeneratedAt: v.number(),
  projectSectionId: v.string(),
  nature: v.optional(
    v.union(v.literal("red"), v.literal("green"), v.literal("unknown")),
  ),
})
  .index("byIds", ["id"])
  .index("byProjectSectionIdOrderStates", ["projectSectionId", "orderToken"]);
registerSpaceSyncableTable(taskTemplatesTable, taskTemplateType);
export type TaskTemplate = ExtractSchema<typeof taskTemplatesTable>;
export const isTaskTemplate = isObjectType<TaskTemplate>(taskTemplateType);

export const projectType = "project";
export const projectsTable = defineTable("projects", {
  type: v.literal(projectType),
  id: v.string(),
  title: v.string(),
  icon: v.string(),
  isInbox: v.boolean(),
  orderToken: v.string(),
  createdAt: v.number(),
})
  .index("byIds", ["id"])
  .index("byOrderToken", ["orderToken"]);
registerSpaceSyncableTable(projectsTable, projectType);
export type Project = ExtractSchema<typeof projectsTable>;
export const isProject = isObjectType<Project>(projectType);

export const dailyListType = "dailyList";
export const dailyListsTable = defineTable("daily_lists", {
  type: v.literal(dailyListType),
  id: v.string(),
  date: v.string(),
})
  .index("byIds", ["id"])
  .index("byDate", ["date"], { type: "uniqhash" });
registerSpaceSyncableTable(dailyListsTable, dailyListType);

export type DailyList = ExtractSchema<typeof dailyListsTable>;
export const isDailyList = isObjectType<DailyList>(dailyListType);

export const dailyEntryType = "dailyEntry";
export const dailyEntriesTable = defineTable("daily_entries", {
  type: v.literal(dailyEntryType),
  id: v.string(),
  orderToken: v.string(),
  dailyListId: v.string(),
  createdAt: v.number(),
})
  .index("byIds", ["id"])
  .index("byDailyListIdTokenOrdered", ["dailyListId", "orderToken"]);
registerSpaceSyncableTable(dailyEntriesTable, dailyEntryType);

export type DailyEntry = ExtractSchema<typeof dailyEntriesTable>;
export const isDailyEntry = isObjectType<DailyEntry>(dailyEntryType);

export const projectSectionType = "projectSection";
export const projectSectionsTable = defineTable("project_sections", {
  type: v.literal(projectSectionType),
  id: v.string(),
  orderToken: v.string(),
  title: v.string(),
  projectId: v.string(),
  createdAt: v.number(),
})
  .index("byIds", ["id"])
  .index("byProjectIdOrderToken", ["projectId", "orderToken"]);
registerSpaceSyncableTable(projectSectionsTable, projectSectionType);

export type ProjectSection = ExtractSchema<typeof projectSectionsTable>;
export const isProjectSection =
  isObjectType<ProjectSection>(projectSectionType);

export const projectSectionTaskStatsTable = defineTable(
  "project_section_task_stats",
  {
    id: v.string(),
    total: v.number(),
    todo: v.number(),
    done: v.number(),
  },
).index("byIds", ["id"]);
export type ProjectSectionTaskStats = ExtractSchema<
  typeof projectSectionTaskStatsTable
>;

export const scheduledTodoTasksTable = defineTable("scheduled_todo_tasks", {
  id: v.string(),
  scheduledAt: v.number(),
  projectSectionId: v.string(),
})
  .index("byIds", ["id"])
  .index("byScheduledAt", ["scheduledAt"])
  .index("byProjectSectionId", ["projectSectionId"]);
export type ScheduledTodoTask = ExtractSchema<typeof scheduledTodoTasksTable>;

export const spaceMigrationsTable = defineTable("space_migrations", {
  id: v.string(),
  appliedAt: v.number(),
}).index("byIds", ["id"]);
export type SpaceMigration = ExtractSchema<typeof spaceMigrationsTable>;

export const stashEntryType = "stashEntry";
export const stashEntriesTable = defineTable("stash_entries", {
  type: v.literal(stashEntryType),
  id: v.string(),
  orderToken: v.string(),
  createdAt: v.number(),
})
  .index("byIds", ["id"])
  .index("byTokenOrdered", ["orderToken"]);
registerSpaceSyncableTable(stashEntriesTable, stashEntryType);

export type StashEntry = ExtractSchema<typeof stashEntriesTable>;
export const isStashEntry = isObjectType<StashEntry>(stashEntryType);

export const checklistItemType = "checklistItem";
export const checklistParentType = v.union(
  v.literal(taskType),
  v.literal(taskTemplateType),
);
export const checklistItemsTable = defineTable("checklist_items", {
  type: v.literal(checklistItemType),
  id: v.string(),
  parentId: v.string(),
  parentType: checklistParentType,
  orderToken: v.string(),
  state: v.union(v.literal("todo"), v.literal("done")),
  content: v.string(),
  createdAt: v.number(),
  checkedAt: v.union(v.number(), v.null()),
})
  .index("byIds", ["id"])
  .index("byParentOrder", ["parentType", "parentId", "orderToken"]);
registerSpaceSyncableTable(checklistItemsTable, checklistItemType);

export type ChecklistParentType = Infer<typeof checklistParentType>;
export type ChecklistItem = ExtractSchema<typeof checklistItemsTable>;
export const isChecklistItem = isObjectType<ChecklistItem>(checklistItemType);
export function isChecklistParentType(
  modelType: string,
): modelType is ChecklistParentType {
  return modelType === taskType || modelType === taskTemplateType;
}

export const habitType = "habit";
export const habitsTable = defineTable("habits", {
  type: v.literal(habitType),
  id: v.string(),
  title: v.string(),
  // Legacy persisted habits may omit these fields. Domain selectors normalize
  // both omissions to explicit nulls.
  routineId: v.optional(v.union(v.string(), v.null())),
  orderToken: v.string(),
  targetTime: v.optional(v.union(v.string(), v.null())),
  createdAt: v.number(),
  archivedAt: v.union(v.number(), v.null()),
})
  .index("byIds", ["id"])
  .index("byOrder", ["orderToken"])
  .index("byRoutineOrder", ["routineId", "orderToken"]);
registerSpaceSyncableTable(habitsTable, habitType);
export type HabitRecord = ExtractSchema<typeof habitsTable>;
export type Habit = Omit<HabitRecord, "routineId" | "targetTime"> & {
  routineId: string | null;
  targetTime: string | null;
};
export const isHabitRecord = isObjectType<HabitRecord>(habitType);
export const isHabit = (value: unknown): value is Habit =>
  isHabitRecord(value) &&
  "routineId" in value &&
  (typeof value.routineId === "string" || value.routineId === null) &&
  "targetTime" in value &&
  (typeof value.targetTime === "string" || value.targetTime === null);

export const routineType = "routine";
export const routinesTable = defineTable("routines", {
  type: v.literal(routineType),
  id: v.string(),
  title: v.string(),
  orderToken: v.string(),
  createdAt: v.number(),
  archivedAt: v.union(v.number(), v.null()),
})
  .index("byIds", ["id"])
  .index("byOrder", ["orderToken"]);
registerSpaceSyncableTable(routinesTable, routineType);
export type Routine = ExtractSchema<typeof routinesTable>;
export const isRoutine = isObjectType<Routine>(routineType);

// Keep the legacy discriminator so existing synchronized rows remain valid.
export const habitCompletionType = "habit_completion";
export const habitCompletionsTable = defineTable("habit_completions", {
  type: v.literal(habitCompletionType),
  id: v.string(),
  habitId: v.string(),
  completedAt: v.number(),
})
  .index("byIds", ["id"])
  .index("byHabitCompletedAt", ["habitId", "completedAt"])
  .index("byCompletedAt", ["completedAt"]);
registerSpaceSyncableTable(habitCompletionsTable, habitCompletionType);
export type HabitCompletion = ExtractSchema<typeof habitCompletionsTable>;
export const isHabitCompletion =
  isObjectType<HabitCompletion>(habitCompletionType);

export const item = v.union(tasksTable.v(), taskTemplatesTable.v());
export type Item = Infer<typeof item>;
export type ItemType = Item["type"];

export const itemType = v.union(
  v.literal(taskType),
  v.literal(taskTemplateType),
);

export const entry = v.union(dailyEntriesTable.v(), stashEntriesTable.v());
export type Entry = Infer<typeof entry>;
export type EntryType = Entry["type"];

export const entryType = v.union(
  v.literal(dailyEntryType),
  v.literal(stashEntryType),
);

export const listItem = v.union(
  tasksTable.v(),
  taskTemplatesTable.v(),
  dailyEntriesTable.v(),
  stashEntriesTable.v(),
);
export type ListItem = Infer<typeof listItem>;
export type ListItemType = ListItem["type"];

export const listItemType = v.union(
  v.literal(taskType),
  v.literal(taskTemplateType),
  v.literal(dailyEntryType),
  v.literal(stashEntryType),
);

export const possibleModel = v.union(
  tasksTable.v(),
  taskTemplatesTable.v(),
  projectsTable.v(),
  dailyListsTable.v(),
  projectSectionsTable.v(),
  dailyEntriesTable.v(),
  stashEntriesTable.v(),
  checklistItemsTable.v(),
  habitsTable.v(),
  routinesTable.v(),
  habitCompletionsTable.v(),
);

type AnyModelRecord = Infer<typeof possibleModel>;
export type AnyModel =
  | Exclude<AnyModelRecord, { type: typeof habitType }>
  | Habit;
export type AnyModelType = AnyModel["type"] | "stash";
export type AnyTable =
  | typeof tasksTable
  | typeof taskTemplatesTable
  | typeof dailyListsTable
  | typeof projectsTable
  | typeof dailyEntriesTable
  | typeof projectSectionsTable
  | typeof stashEntriesTable
  | typeof checklistItemsTable
  | typeof habitsTable
  | typeof routinesTable
  | typeof habitCompletionsTable;

export const possibleModelType = v.union(
  v.literal(taskType),
  v.literal(taskTemplateType),
  v.literal(projectType),
  v.literal(dailyListType),
  v.literal(projectSectionType),
  v.literal(dailyEntryType),
  v.literal(stashEntryType),
  v.literal(checklistItemType),
  v.literal(habitType),
  v.literal(routineType),
  v.literal(habitCompletionType),
  v.literal("stash"),
);
