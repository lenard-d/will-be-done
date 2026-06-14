import { defineTable, v } from "@will-be-done/hyperdb-lib";

export const possibleModelType = v.union(
  v.literal("task"),
  v.literal("template"),
  v.literal("project"),
  v.literal("dailyList"),
  v.literal("projectCategory"),
  v.literal("projection"),
  v.literal("stashProjection"),
  v.literal("checklistItem"),
  v.literal("stash"),
);

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
  .index("byTemplateId", ["templateId"], { type: "hash" });

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

export const dailyListType = "dailyList";
export const dailyListsTable = defineTable("daily_lists", {
  type: v.literal(dailyListType),
  id: v.string(),
  date: v.string(),
})
  .index("byIds", ["id"])
  .index("byDate", ["date"], { type: "hash" });

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

export const stashProjectionType = "stashProjection";
export const stashProjectionsTable = defineTable("stash_projections", {
  type: v.literal(stashProjectionType),
  id: v.string(),
  orderToken: v.string(),
  createdAt: v.number(),
})
  .index("byIds", ["id"])
  .index("byTokenOrdered", ["orderToken"]);

export const checklistItemType = "checklistItem";
export const checklistItemsTable = defineTable("checklist_items", {
  type: v.literal(checklistItemType),
  id: v.string(),
  parentId: v.string(),
  parentType: v.union(v.literal("task"), v.literal("template")),
  orderToken: v.string(),
  state: v.union(v.literal("todo"), v.literal("done")),
  content: v.string(),
  createdAt: v.number(),
  checkedAt: v.union(v.number(), v.null()),
})
  .index("byIds", ["id"])
  .index("byParentOrder", ["parentType", "parentId", "orderToken"]);
