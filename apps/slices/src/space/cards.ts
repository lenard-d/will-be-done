import { action, selector, v } from "@will-be-done/hyperdb-lib";
import { assertUnreachable } from "./utils";
import {
  createDailyProjectionSibling,
  deleteDailyProjections,
  taskProjectionsTable,
} from "./dailyListsProjections";
import { createSiblingTask } from "./projectsCategoriesCards";
import {
  createStashProjectionSibling,
  deleteStashProjections,
  stashProjectionsTable,
} from "./stashProjections";
import {
  deleteTasksByIds,
  taskById,
  type Task,
  defaultTask,
  isTask,
  taskType,
  tasksTable,
} from "./cardsTasks";
import {
  deleteTemplates,
  taskTemplateById,
  taskTemplatesTable,
} from "./cardsTaskTemplates";
import { type TaskTemplate, isTaskTemplate } from "./cardsTaskTemplates";
import { AnyModel, appTypeSlicesMap } from "./maps";
import { isTaskProjection, TaskProjection } from "./dailyListsProjections";
import { isStashProjection, StashProjection } from "./stashProjections";
import { projectsTable } from "./projects";
import { dailyListsTable } from "./dailyLists";
import { checklistItemsTable } from "./checklistItems";

export type CardWrapper =
  | Task
  | TaskTemplate
  | TaskProjection
  | StashProjection;
export type CardWrapperType = CardWrapper["type"];

const cardWrapperType = v.union(
  v.literal(taskType),
  v.literal("template"),
  v.literal("projection"),
  v.literal("stashProjection"),
);

export const cardById = selector({
  name: "cardById",
  args: { id: v.string() },
  handler: function* cardById({ id }) {
    const tasks = yield* taskById({ id });
    if (tasks) return tasks;

    const templates = yield* taskTemplateById({ id });
    if (templates) return templates;

    return undefined as CardWrapper | undefined;
  },
});

export const cardExists = selector({
  name: "cardExists",
  args: { id: v.string() },
  handler: function* cardExists({ id }) {
    return !!(yield* cardById({ id }));
  },
});

export const createSiblingCard = action({
  name: "createSiblingCard",
  args: {
    taskBox: v.union(
      tasksTable.v(),
      taskTemplatesTable.v(),
      taskProjectionsTable.v(),
      stashProjectionsTable.v(),
    ),
    position: v.union(v.literal("before"), v.literal("after")),
    taskParams: v.optional(
      // TODO: use v.partial(tasksTable.v()),
      v.object({
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
    ),
  },
  handler: function* createSiblingCard({ taskBox, position, taskParams }) {
    if (isTaskProjection(taskBox)) {
      return yield* createDailyProjectionSibling({
        taskId: taskBox.id,
        position,
        taskParams,
      });
    } else if (isStashProjection(taskBox)) {
      return yield* createStashProjectionSibling({
        taskId: taskBox.id,
        position,
        taskParams,
      });
    } else if (isTask(taskBox) || isTaskTemplate(taskBox)) {
      return yield* createSiblingTask({
        cardId: taskBox.id,
        position,
        taskParams,
      });
    } else {
      assertUnreachable(taskBox);
    }
  },
});

export const cardWrapperId = selector({
  name: "cardWrapperId",
  args: {
    id: v.string(),
    modelType: cardWrapperType,
  },
  handler: function* cardWrapperId({ id, modelType }) {
    const slice = appTypeSlicesMap[modelType];
    if (!slice) throw new Error(`Unknown model type: ${modelType}`);

    return (yield* slice.byId(id)) as CardWrapper;
  },
});

export const cardWrapperIdOrDefault = selector({
  name: "cardWrapperIdOrDefault",
  args: {
    id: v.string(),
    modelType: cardWrapperType,
  },
  handler: function* cardWrapperIdOrDefault({ id, modelType }) {
    const entity = yield* cardWrapperId({
      id,
      modelType,
    });
    if (!entity) {
      return defaultTask as CardWrapper;
    }

    return entity;
  },
});

export const taskOfModel = selector({
  name: "taskOfModel",
  args: {
    model: v.union(
      tasksTable.v(),
      taskTemplatesTable.v(),
      projectsTable.v(),
      dailyListsTable.v(),
      taskProjectionsTable.v(),
      stashProjectionsTable.v(),
      checklistItemsTable.v(),
    ),
  },
  handler: function* taskOfModel({ model }: { model: AnyModel }) {
    if (isTaskProjection(model)) {
      return yield* taskById({ id: model.id });
    }

    if (isStashProjection(model)) {
      return yield* taskById({ id: model.id });
    }

    if (isTask(model)) {
      return model as Task;
    }

    return undefined as Task | undefined;
  },
});

export const deleteCardsByIds = action({
  name: "deleteCardsByIds",
  args: { ids: v.array(v.string()) },
  handler: function* deleteCardsByIds({ ids }: { ids: string[] }) {
    yield* deleteTasksByIds({ ids });
    yield* deleteTemplates({ taskTemplateIds: ids });
    yield* deleteDailyProjections({ ids });
    yield* deleteStashProjections({ ids });
  },
});
