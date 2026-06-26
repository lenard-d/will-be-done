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
  projectCategoryId: v.string(),
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
  .index("byCategoryIdOrderStates", [
    "projectCategoryId",
    "state",
    "orderToken",
  ])
  .index("byCategoryIdStatesToggledAt", [
    "projectCategoryId",
    "state",
    "lastToggledAt",
  ])
  .index("byTemplateId", ["templateId"], { type: "hash" });
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
  projectCategoryId: v.string(),
  nature: v.optional(
    v.union(v.literal("red"), v.literal("green"), v.literal("unknown")),
  ),
})
  .index("byIds", ["id"])
  .index("byCategoryIdOrderStates", ["projectCategoryId", "orderToken"]);
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
  .index("byOrderToken", ["orderToken"])
  .index("byIsInbox", ["isInbox"], { type: "hash" });
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
  .index("byDate", ["date"], { type: "hash" });
registerSpaceSyncableTable(dailyListsTable, dailyListType);

export type DailyList = ExtractSchema<typeof dailyListsTable>;
export const isDailyList = isObjectType<DailyList>(dailyListType);

export const projectionType = "projection";
export const taskProjectionsTable = defineTable("task_projections", {
  type: v.literal(projectionType),
  id: v.string(),
  orderToken: v.string(),
  dailyListId: v.string(),
  createdAt: v.number(),
})
  .index("byIds", ["id"])
  .index("byDailyListId", ["dailyListId"], { type: "hash" })
  .index("byDailyListIdTokenOrdered", ["dailyListId", "orderToken"]);
registerSpaceSyncableTable(taskProjectionsTable, projectionType);

export type TaskProjection = ExtractSchema<typeof taskProjectionsTable>;
export const isTaskProjection = isObjectType<TaskProjection>(projectionType);

export const projectCategoryType = "projectCategory";
export const projectCategoriesTable = defineTable("project_categories", {
  type: v.literal(projectCategoryType),
  id: v.string(),
  orderToken: v.string(),
  title: v.string(),
  projectId: v.string(),
  createdAt: v.number(),
})
  .index("byIds", ["id"])
  .index("byProjectIdOrderToken", ["projectId", "orderToken"]);
registerSpaceSyncableTable(projectCategoriesTable, projectCategoryType);

export type ProjectCategory = ExtractSchema<typeof projectCategoriesTable>;
export const isProjectCategory =
  isObjectType<ProjectCategory>(projectCategoryType);

export const stashProjectionType = "stashProjection";
export const stashProjectionsTable = defineTable("stash_projections", {
  type: v.literal(stashProjectionType),
  id: v.string(),
  orderToken: v.string(),
  createdAt: v.number(),
})
  .index("byIds", ["id"])
  .index("byTokenOrdered", ["orderToken"]);
registerSpaceSyncableTable(stashProjectionsTable, stashProjectionType);

export type StashProjection = ExtractSchema<typeof stashProjectionsTable>;
export const isStashProjection =
  isObjectType<StashProjection>(stashProjectionType);

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

export type Card = Task | TaskTemplate;

export const cardWrapper = v.union(
  tasksTable.v(),
  taskTemplatesTable.v(),
  taskProjectionsTable.v(),
  stashProjectionsTable.v(),
);
export type CardWrapper = Infer<typeof cardWrapper>;
export type CardWrapperType = Infer<typeof cardWrapper>["type"];

export const cardWrapperType = v.union(
  v.literal(taskType),
  v.literal(taskTemplateType),
  v.literal(projectionType),
  v.literal(stashProjectionType),
);

export const possibleModel = v.union(
  tasksTable.v(),
  taskTemplatesTable.v(),
  projectsTable.v(),
  dailyListsTable.v(),
  projectCategoriesTable.v(),
  taskProjectionsTable.v(),
  stashProjectionsTable.v(),
  checklistItemsTable.v(),
);

export type AnyModel = Infer<typeof possibleModel>;
export type AnyModelType = AnyModel["type"] | "stash";
export type AnyTable =
  | typeof tasksTable
  | typeof taskTemplatesTable
  | typeof dailyListsTable
  | typeof projectsTable
  | typeof taskProjectionsTable
  | typeof projectCategoriesTable
  | typeof stashProjectionsTable
  | typeof checklistItemsTable;

export const possibleModelType = v.union(
  v.literal(taskType),
  v.literal(taskTemplateType),
  v.literal(projectType),
  v.literal(dailyListType),
  v.literal(projectCategoryType),
  v.literal(projectionType),
  v.literal(stashProjectionType),
  v.literal(checklistItemType),
  v.literal("stash"),
);
