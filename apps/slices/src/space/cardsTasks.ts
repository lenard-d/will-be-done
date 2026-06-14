import { isObjectType } from "../utils";
import { shouldNeverHappen } from "../utils";
import {
  action,
  deleteRows,
  defineTable,
  type ExtractSchema,
  insert,
  selectFrom,
  selector,
  upsert,
  v,
} from "@will-be-done/hyperdb-lib";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { uuidv7 } from "uuidv7";
import { appById, appDeleteModel, possibleModelType } from "./app";
import {
  checklistItemCanDropOnParent,
  checklistItemHandleDropOnParent,
  copyItems,
  deleteForParents,
} from "./checklistItems";
import { deleteDailyProjections } from "./dailyListsProjections";
import { firstProjectCategoryChild } from "./projectsCategories";
import { projectCategoryCardSiblings } from "./projectsCategoriesCards";
import { taskTemplatesTable, updateTemplate } from "./cardsTaskTemplates";
import { isTaskTemplate } from "./cardsTaskTemplates";
import { registerSpaceSyncableTable } from "./syncMap";
import { registerModelSlice } from "./maps";
import { isTaskProjection } from "./dailyListsProjections";

// Type definitions
export const taskType = "task";

export type TaskNature = "red" | "green" | "unknown";

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
export type Task = ExtractSchema<typeof tasksTable>;

export const isTask = isObjectType<Task>(taskType);

export const defaultTask: Task = {
  type: taskType,
  projectCategoryId: "abeee7aa-8bf4-4a5f-9167-ce42ad6187b6",
  id: "17748950-3b32-4893-8fa8-ccdb269f7c52",
  title: "default task",
  state: "todo",
  orderToken: "",
  lastToggledAt: 0,
  createdAt: 0,
  nature: "unknown",
  templateId: null,
  templateDate: null,
};

registerSpaceSyncableTable(tasksTable, taskType);

// Selectors and actions
export const taskById = selector({
  name: "taskById",
  args: { id: v.string() },
  handler: function* taskById({ id }) {
    const tasks = yield* selectFrom(tasksTable, "byId")
      .where((q) => q.eq("id", id))
      .limit(1);

    return tasks[0] as Task | undefined;
  },
});

export const taskExists = selector({
  name: "taskExists",
  args: { id: v.string() },
  handler: function* taskExists({ id }) {
    return !!(yield* taskById({ id }));
  },
});

export const taskByIdOrDefault = selector({
  name: "taskByIdOrDefault",
  args: { id: v.string() },
  handler: function* taskByIdOrDefault({ id }) {
    return (yield* taskById({ id })) || defaultTask;
  },
});

export const taskIdsOfTemplateId = selector({
  name: "taskIdsOfTemplateId",
  args: { ids: v.array(v.string()) },
  handler: function* taskIdsOfTemplateId({ ids }) {
    const tasks = yield* selectFrom(tasksTable, "byTemplateId").where((q) =>
      ids.map((id) => q.eq("templateId", id)),
    );

    return tasks.map((t) => t.id);
  },
});

export const allTasks = selector({
  name: "allTasks",
  args: {},
  handler: function* allTasks() {
    const tasks = yield* selectFrom(tasksTable, "byCategoryIdOrderStates");
    return tasks;
  },
});

export const deleteTasks = action({
  name: "deleteTasks",
  args: { ids: v.array(v.string()) },
  handler: function* deleteTasks({ ids }): Generator<unknown, void, unknown> {
    yield* deleteForParents({
      parentIds: ids,
      parentType: taskType,
    });
    yield* deleteRows(tasksTable, ids);
    yield* deleteDailyProjections({ ids });
  },
});

export const updateTask = action({
  name: "updateTask",
  args: {
    id: v.string(),
    // TODO: use v.partial(tasksTable.v()),
    task: v.object({
      type: v.optional(v.literal(taskType)),
      id: v.optional(v.string()),
      title: v.optional(v.string()),
      content: v.optional(v.string()),
      state: v.optional(v.union(v.literal("todo"), v.literal("done"))),
      projectCategoryId: v.optional(v.string()),
      orderToken: v.optional(v.string()),
      lastToggledAt: v.optional(v.number()),
      nature: v.optional(
        v.union(v.literal("red"), v.literal("green"), v.literal("unknown")),
      ),
      createdAt: v.optional(v.number()),
      templateId: v.optional(v.union(v.string(), v.null())),
      templateDate: v.optional(v.union(v.number(), v.null())),
    }),
  },
  handler: function* updateTask({ id, task }) {
    const taskInState = yield* taskById({ id });
    if (!taskInState) throw new Error("Task not found");

    yield* upsert(tasksTable, [{ ...taskInState, ...task }]);
  },
});

export const createTask = action({
  name: "createTask",
  args: {
    // TODO: make v.required(v.partial(tasksTable.v()), ['orderToken', 'projectCategoryId']),
    task: v.object({
      type: v.optional(v.literal(taskType)),
      id: v.optional(v.string()),
      title: v.optional(v.string()),
      content: v.optional(v.string()),
      state: v.optional(v.union(v.literal("todo"), v.literal("done"))),
      projectCategoryId: v.string(),
      orderToken: v.string(),
      lastToggledAt: v.optional(v.number()),
      nature: v.optional(
        v.union(v.literal("red"), v.literal("green"), v.literal("unknown")),
      ),
      createdAt: v.optional(v.number()),
      templateId: v.optional(v.union(v.string(), v.null())),
      templateDate: v.optional(v.union(v.number(), v.null())),
    }),
  },
  handler: function* createTask({ task }) {
    const id = task.id || uuidv7();

    const newTask: Task = {
      type: taskType,
      id,
      title: "",
      state: "todo",
      lastToggledAt: Date.now(),
      createdAt: Date.now(),
      templateId: null,
      templateDate: null,
      ...task,
      nature: task.nature ?? "unknown",
    };

    yield* insert(tasksTable, [newTask]);

    return newTask;
  },
});

export const taskCanDrop = selector({
  name: "taskCanDrop",
  args: {
    taskId: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
  },
  handler: function* taskCanDrop({ taskId, dropId, dropModelType }) {
    const model = yield* appById({
      id: dropId,
      modelType: dropModelType,
    });
    if (!model) return false;

    const task = yield* taskById({ id: taskId });
    if (!task) return false;

    if (task.state === "done") {
      return false;
    }

    if (isTask(model) && model.state === "done") {
      return false;
    }

    if (isTaskProjection(model)) {
      const droppedTask = yield* taskById({ id: model.id });
      return droppedTask !== undefined && droppedTask.state === "todo";
    }

    if (
      yield* checklistItemCanDropOnParent({
        parentId: taskId,
        parentType: taskType,
        dropId,
        dropModelType,
      })
    ) {
      return true;
    }

    return isTask(model) || isTaskTemplate(model);
  },
});

export const taskHandleDrop = action({
  name: "taskHandleDrop",
  args: {
    taskId: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* taskHandleDrop({
    taskId,
    dropId,
    dropModelType,
    edge,
  }): Generator<unknown, void, unknown> {
    if (
      !(yield* taskCanDrop({
        taskId,
        dropId,
        dropModelType,
      }))
    )
      return;

    const task = yield* taskById({ id: taskId });
    if (!task) return shouldNeverHappen("task not found");

    const dropItem = yield* appById({
      id: dropId,
      modelType: dropModelType,
    });
    if (!dropItem) return shouldNeverHappen("drop item not found");

    const [up, down] = yield* projectCategoryCardSiblings({ cardId: taskId });

    let between: [string | undefined, string | undefined] = [
      task.orderToken,
      down?.orderToken,
    ];

    if (edge == "top") {
      between = [up?.orderToken, task.orderToken];
    }

    const orderToken = generateJitteredKeyBetween(
      between[0] || null,
      between[1] || null,
    );

    if (isTask(dropItem)) {
      yield* updateTask({
        id: dropItem.id,
        task: {
          projectCategoryId: task.projectCategoryId,
          orderToken: orderToken,
        },
      });
    } else if (isTaskTemplate(dropItem)) {
      yield* updateTemplate({
        id: dropItem.id,
        template: {
          projectCategoryId: task.projectCategoryId,
          orderToken: orderToken,
        },
      });
    } else if (isTaskProjection(dropItem)) {
      // When dropping a projection onto a task, move the underlying task
      const droppedTask = yield* taskById({ id: dropItem.id });
      if (droppedTask) {
        yield* updateTask({
          id: droppedTask.id,
          task: {
            projectCategoryId: task.projectCategoryId,
            orderToken: orderToken,
          },
        });
        // Keep the projection in the daily list
      }
    } else if (
      yield* checklistItemCanDropOnParent({
        parentId: taskId,
        parentType: taskType,
        dropId,
        dropModelType,
      })
    ) {
      yield* checklistItemHandleDropOnParent({
        parentId: taskId,
        parentType: taskType,
        dropId,
        dropModelType,
        edge,
      });
    } else {
      shouldNeverHappen("unknown drop item type", dropItem);
    }
  },
});

export const moveTaskToProject = action({
  name: "moveTaskToProject",
  args: {
    taskId: v.string(),
    projectId: v.string(),
  },
  handler: function* moveTaskToProject({
    taskId,
    projectId,
  }): Generator<unknown, void, unknown> {
    const task = yield* taskById({ id: taskId });
    if (!task) throw new Error("Task not found");

    const firstCategory = yield* firstProjectCategoryChild({ projectId });
    if (!firstCategory) throw new Error("No categories found");

    yield* upsert(tasksTable, [
      {
        ...task,
        projectCategoryId: firstCategory.id,
      },
    ]);
  },
});

export const toggleTaskState = action({
  name: "toggleTaskState",
  args: { taskId: v.string() },
  handler: function* toggleTaskState({ taskId }: { taskId: string }) {
    const task = yield* taskById({ id: taskId });
    if (!task) throw new Error("Task not found");

    yield* upsert(tasksTable, [
      {
        ...task,
        state: task.state === "todo" ? "done" : "todo",
        lastToggledAt: Date.now(),
      },
    ]);
  },
});

export const createTaskFromTemplate = action({
  name: "createTaskFromTemplate",
  args: { taskTemplate: taskTemplatesTable.v() },
  handler: function* createTaskFromTemplate({ taskTemplate }) {
    const newId = uuidv7();
    yield* copyItems({
      fromParentId: taskTemplate.id,
      fromParentType: "template",
      toParentId: newId,
      toParentType: taskType,
    });
    yield* appDeleteModel({
      id: taskTemplate.id,
      modelType: taskTemplate.type,
    });

    const newTask: Task = {
      id: newId,
      title: taskTemplate.title,
      state: "todo",
      projectCategoryId: taskTemplate.projectCategoryId,
      type: taskType,
      orderToken: taskTemplate.orderToken,
      lastToggledAt: Date.now(),
      nature: taskTemplate.nature ?? "unknown",
      createdAt: taskTemplate.createdAt,
      content: taskTemplate.content,
      templateId: null,
      templateDate: null,
    };
    yield* insert(tasksTable, [newTask]);

    return newTask;
  },
});

export const deleteTasksByIds = action({
  name: "deleteTasksByIds",
  args: { ids: v.array(v.string()) },
  handler: function* deleteTasksByIds({ ids }) {
    yield* deleteTasks({ ids });
  },
});

export const deleteTaskById = action({
  name: "deleteTaskById",
  args: { id: v.string() },
  handler: function* deleteTaskById({ id }) {
    yield* deleteTasks({ ids: [id] });
  },
});

// Local slice object for registerModelSlice (not exported)
const cardsTasksSlice = {
  byId: taskById,
  taskExists,
  taskByIdOrDefault,
  taskIdsOfTemplateId,
  allTasks,
  delete: deleteTasks,
  update: updateTask,
  createTask,
  canDrop: taskCanDrop,
  handleDrop: taskHandleDrop,
  moveTaskToProject,
  toggleTaskState,
  createTaskFromTemplate,
  deleteTasksByIds,
  deleteTaskById,
};
registerModelSlice(cardsTasksSlice, tasksTable, taskType);
