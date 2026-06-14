import { isObjectType } from "../utils";
import { shouldNeverHappen } from "../utils";
import {
  action,
  deleteRows,
  type ExtractSchema,
  insert,
  selectFrom,
  selector,
  upsert as upsertRows,
  v,
} from "@will-be-done/hyperdb-lib";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import {
  dailyDateFormat,
  generateKeyPositionedBetween,
  type OrderableItem,
} from "./utils";
import { registerSpaceSyncableTable } from "./syncMap";
import { registerModelSlice, AnyModelType } from "./maps";
import { appById } from "./app";
import { dailyListById, createDailyListIfNotPresent } from "./dailyLists";
import {
  createSiblingTask,
  projectCategoryCardsForDisplay,
  type CardForDisplay,
} from "./projectsCategoriesCards";
import { deleteStashProjections } from "./stashProjections";
import { taskById } from "./cardsTasks";
import { isTask, type Task } from "./cardsTasks";
import { isStashProjection } from "./stashProjections";
import { parse } from "date-fns";
import { projectionType, taskProjectionsTable, tasksTable, taskType } from "./tables";

export { projectionType, taskProjectionsTable };

export type TaskProjection = ExtractSchema<typeof taskProjectionsTable>;

export const isTaskProjection = isObjectType<TaskProjection>(projectionType);

export const defaultTaskProjection: TaskProjection = {
  type: projectionType,
  id: "default-projection-id",
  orderToken: "",
  dailyListId: "",
  createdAt: 0,
};

registerSpaceSyncableTable(taskProjectionsTable, projectionType);

const orderPositionArg = v.union(
  v.literal("append"),
  v.literal("prepend"),
  v.array(v.union(v.object({ orderToken: v.string() }), v.null())),
);

type OrderPositionArg =
  | "append"
  | "prepend"
  | (OrderableItem | null)[];

const normalizeOrderPosition = (
  position: OrderPositionArg,
): "append" | "prepend" | [TaskProjection | undefined, TaskProjection | undefined] => {
  if (position === "append" || position === "prepend") return position;
  return [position[0] ?? undefined, position[1] ?? undefined] as [
    TaskProjection | undefined,
    TaskProjection | undefined,
  ];
};

// Selectors and actions
export const dailyProjectionAllIds = selector({
  name: "dailyProjectionAllIds",
  args: {},
  handler: function* dailyProjectionAllIds() {
    const projections = yield* selectFrom(taskProjectionsTable, "byIds").where(
      (q) => q,
    );
    return projections.map((p) => p.id);
  }
});

export const dailyProjectionById = selector({
  name: "dailyProjectionById",
  args: { id: v.string() },
  handler: function* dailyProjectionById({ id }: {
    id: string;
  }) {
  const projections = yield* selectFrom(taskProjectionsTable, "byId")
    .where((q) => q.eq("id", id))
    .limit(1);
  return projections[0] as TaskProjection | undefined;
}
});

export const dailyProjectionsByIds = selector({
  name: "dailyProjectionsByIds",
  args: { ids: v.array(v.string()) },
  handler: function* dailyProjectionsByIds({ ids }: {
    ids: string[];
  }) {
  const projections = yield* selectFrom(taskProjectionsTable, "byId").where(
    (q) => ids.map((id) => q.eq("id", id)),
  );
  return projections as TaskProjection[];
}
});

export const dailyProjectionByIdOrDefault = selector({
  name: "dailyProjectionByIdOrDefault",
  args: { id: v.string() },
  handler: function* dailyProjectionByIdOrDefault({ id }: {
    id: string;
  }) {
    return (yield* dailyProjectionById({ id })) || defaultTaskProjection;
  }
});

// Get projection for a task (since id = taskId, this is the same as byId)
export const dailyProjectionByTaskId = selector({
  name: "dailyProjectionByTaskId",
  args: { taskId: v.string() },
  handler: function* dailyProjectionByTaskId({ taskId }: {
    taskId: string;
  }) {
    return yield* dailyProjectionById({ id: taskId });
  }
});

// Check if a task has a projection (is in a daily list)
export const dailyListHasProjection = selector({
  name: "dailyListHasProjection",
  args: { taskId: v.string() },
  handler: function* dailyListHasProjection({ taskId }: {
    taskId: string;
  }) {
  const projection = yield* dailyProjectionById({ id: taskId });
  return projection !== undefined;
}
});

// Get all projections for a daily list
export const dailyProjectionsByDailyListId = selector({
  name: "dailyProjectionsByDailyListId",
  args: { dailyListId: v.string() },
  handler: function* dailyProjectionsByDailyListId({ dailyListId }: {
    dailyListId: string;
  }) {
    return (yield* selectFrom(
      taskProjectionsTable,
      "byDailyListIdTokenOrdered",
    ).where((q) => q.eq("dailyListId", dailyListId))) as TaskProjection[];
  }
});

// Get all task ids in a specific daily list (non-done, ordered)
export const dailyProjectionChildrenIds = selector({
  name: "dailyProjectionChildrenIds",
  args: { dailyListId: v.string() },
  handler: function* dailyProjectionChildrenIds({ dailyListId }: {
    dailyListId: string;
  }): Generator<unknown, string[], unknown> {
    const projections = yield* dailyProjectionsByDailyListId({ dailyListId });

    const result: string[] = [];
    for (const proj of projections) {
      const task = yield* taskById({ id: proj.id });
      if (task && task.state === "todo") {
        result.push(proj.id);
      }
    }

    return result;
  }
});

export const dailyProjectionChildrenForDisplay = selector({
  name: "dailyProjectionChildrenForDisplay",
  args: { dailyListId: v.string() },
  handler: function* dailyProjectionChildrenForDisplay({ dailyListId }: {
    dailyListId: string;
  }): Generator<unknown, CardForDisplay[], unknown> {
    const projections = yield* dailyProjectionsByDailyListId({ dailyListId });
    const projectionIds = projections.map((projection) => projection.id);
    const tasks = projectionIds.length
      ? yield* selectFrom(tasksTable, "byId").where((q) =>
          projectionIds.map((id) => q.eq("id", id)),
        )
      : [];
    const taskMap = new Map((tasks as Task[]).map((task) => [task.id, task]));

    const cards: Task[] = [];
    const cardWrappers: TaskProjection[] = [];
    for (const projection of projections) {
      const task = taskMap.get(projection.id);
      if (task && task.state === "todo") {
        cards.push(task);
        cardWrappers.push(projection);
      }
    }

    return yield* projectCategoryCardsForDisplay({
  cards,
  cardWrappers,
});
  }
});

export const dailyProjectionDateOfTask = selector({
  name: "dailyProjectionDateOfTask",
  args: { taskId: v.string() },
  handler: function* dailyProjectionDateOfTask({ taskId }: {
    taskId: string;
  }): Generator<unknown, Date | undefined, unknown> {
    const projection = yield* dailyProjectionByTaskId({ taskId });
    if (!projection) return undefined as Date | undefined;

    const list = yield* dailyListById({ id: projection.dailyListId });
    if (!list) return undefined as Date | undefined;

    return parse(list.date, dailyDateFormat, new Date());
  }
});

// Get all done task ids in a daily list (sorted by lastToggledAt)
export const doneDailyProjectionChildrenIds = selector({
  name: "doneDailyProjectionChildrenIds",
  args: { dailyListId: v.string() },
  handler: function* doneDailyProjectionChildrenIds({ dailyListId }: {
    dailyListId: string;
  }): Generator<unknown, string[], unknown> {
    const projections = yield* dailyProjectionsByDailyListId({ dailyListId });

    const doneTasks: { id: string; lastToggledAt: number }[] = [];
    for (const proj of projections) {
      const task = yield* taskById({ id: proj.id });
      if (task && task.state === "done") {
        doneTasks.push({ id: proj.id, lastToggledAt: task.lastToggledAt });
      }
    }

    return doneTasks
      .sort((a, b) => b.lastToggledAt - a.lastToggledAt)
      .map((t) => t.id);
  }
});

export const doneDailyProjectionChildrenForDisplay = selector({
  name: "doneDailyProjectionChildrenForDisplay",
  args: { dailyListId: v.string() },
  handler: function* doneDailyProjectionChildrenForDisplay({ dailyListId }: {
    dailyListId: string;
  }): Generator<unknown, CardForDisplay[], unknown> {
    const projections = yield* dailyProjectionsByDailyListId({ dailyListId });
    const projectionIds = projections.map((projection) => projection.id);
    const tasks = projectionIds.length
      ? yield* selectFrom(tasksTable, "byId").where((q) =>
          projectionIds.map((id) => q.eq("id", id)),
        )
      : [];
    const taskMap = new Map((tasks as Task[]).map((task) => [task.id, task]));

    const cardsWithProjections: {
      card: Task;
      cardWrapper: TaskProjection;
    }[] = [];
    for (const projection of projections) {
      const task = taskMap.get(projection.id);
      if (task && task.state === "done") {
        cardsWithProjections.push({ card: task, cardWrapper: projection });
      }
    }

    cardsWithProjections.sort(
      (a, b) => b.card.lastToggledAt - a.card.lastToggledAt,
    );

    return yield* projectCategoryCardsForDisplay({
  cards: cardsWithProjections.map(({ card }) => card),
  cardWrappers: cardsWithProjections.map(({ cardWrapper }) => cardWrapper),
});
  }
});

// Get first task in daily list
export const firstDailyProjectionChild = selector({
  name: "firstDailyProjectionChild",
  args: { dailyListId: v.string() },
  handler: function* firstDailyProjectionChild({ dailyListId }: {
    dailyListId: string;
  }): Generator<unknown, Task | undefined, unknown> {
    const ids = yield* dailyProjectionChildrenIds({ dailyListId });
    const firstChildId = ids[0];
    return firstChildId
      ? yield* taskById({ id: firstChildId })
      : (undefined as Task | undefined);
  }
});

// Get last task in daily list
export const lastDailyProjectionChild = selector({
  name: "lastDailyProjectionChild",
  args: { dailyListId: v.string() },
  handler: function* lastDailyProjectionChild({ dailyListId }: {
    dailyListId: string;
  }): Generator<unknown, Task | undefined, unknown> {
    const ids = yield* dailyProjectionChildrenIds({ dailyListId });
    const lastChildId = ids[ids.length - 1];
    return lastChildId
      ? yield* taskById({ id: lastChildId })
      : (undefined as Task | undefined);
  }
});

// Get siblings of a task within its daily list
export const dailyProjectionSiblings = selector({
  name: "dailyProjectionSiblings",
  args: { taskId: v.string() },
  handler: function* dailyProjectionSiblings({ taskId }: {
    taskId: string;
  }) {
    const projection = yield* dailyProjectionByTaskId({ taskId });
    if (!projection)
      return [undefined, undefined] as [
        TaskProjection | undefined,
        TaskProjection | undefined,
      ];

    const sortedProjections = yield* dailyProjectionsByDailyListId({ dailyListId: projection.dailyListId });

    const index = sortedProjections.findIndex((p) => p.id === taskId);

    const before = index > 0 ? sortedProjections[index - 1] : undefined;
    const after =
      index < sortedProjections.length - 1
        ? sortedProjections[index + 1]
        : undefined;

    return [before, after] as [
      TaskProjection | undefined,
      TaskProjection | undefined,
    ];
  }
});

// Check if a projection can accept another model being dropped
export const dailyProjectionCanDrop = selector({
  name: "dailyProjectionCanDrop",
  args: {
    projectionId: v.string(),
    dropId: v.string(),
    dropModelType: v.union(v.literal("task"), v.literal("template"), v.literal("project"), v.literal("dailyList"), v.literal("projectCategory"), v.literal("projection"), v.literal("stashProjection"), v.literal("checklistItem"), v.literal("stash")),
  },
  handler: function* dailyProjectionCanDrop({ projectionId, dropId, dropModelType }: {
    projectionId: string;
    dropId: string;
    dropModelType: AnyModelType;
  }): Generator<unknown, boolean, unknown> {
  const model = yield* appById({
  id: dropId,
  modelType: dropModelType,
});
  if (!model) return false;

  const projection = yield* dailyProjectionById({ id: projectionId });
  if (!projection) return false;

  const task = yield* taskById({ id: projection.id });
  if (!task) return false;

  // Only allow dropping todo tasks
  if (task.state === "done") return false;

  // Check if dropping a task directly
  if (isTask(model)) {
    return model.state === "todo";
  }

  // Check if dropping a projection (task in daily list)
  if (isTaskProjection(model)) {
    const droppedTask = yield* taskById({ id: model.id });
    return droppedTask !== undefined && droppedTask.state === "todo";
  }

  // Check if dropping a stash projection
  if (isStashProjection(model)) {
    const droppedTask = yield* taskById({ id: model.id });
    return droppedTask !== undefined && droppedTask.state === "todo";
  }

  return false;
}
});

// Handle drop operations
export const dailyProjectionHandleDrop = action({
  name: "dailyProjectionHandleDrop",
  args: {
    projectionId: v.string(),
    dropId: v.string(),
    dropModelType: v.union(v.literal("task"), v.literal("template"), v.literal("project"), v.literal("dailyList"), v.literal("projectCategory"), v.literal("projection"), v.literal("stashProjection"), v.literal("checklistItem"), v.literal("stash")),
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* dailyProjectionHandleDrop({ projectionId, dropId, dropModelType, edge }: {
    projectionId: string;
    dropId: string;
    dropModelType: AnyModelType;
    edge: "top" | "bottom";
  }): Generator<unknown, void, unknown> {
    const canDropResult = yield* dailyProjectionCanDrop({
  projectionId,
  dropId,
  dropModelType,
});
    if (!canDropResult) return;

    const projection = yield* dailyProjectionById({ id: projectionId });
    if (!projection) return;

    const dropItem = yield* appById({
  id: dropId,
  modelType: dropModelType,
});
    if (!dropItem) return;

    const [up, down] = yield* dailyProjectionSiblings({ taskId: projection.id });

    let between: [string | undefined, string | undefined] = [
      projection.orderToken,
      down?.orderToken,
    ];

    if (edge === "top") {
      between = [up?.orderToken, projection.orderToken];
    }

    const orderToken = generateJitteredKeyBetween(
      between[0] || null,
      between[1] || null,
    );

    if (isTask(dropItem)) {
      yield* upsertDailyProjection({ projection: {
        id: dropItem.id,
        dailyListId: projection.dailyListId,
        orderToken,
      } });
    } else if (isTaskProjection(dropItem)) {
      yield* upsertDailyProjection({ projection: {
        id: dropItem.id, // projection.id is the same as task.id
        dailyListId: projection.dailyListId,
        orderToken,
      } });
    } else if (isStashProjection(dropItem)) {
      yield* upsertDailyProjection({ projection: {
        id: dropItem.id,
        dailyListId: projection.dailyListId,
        orderToken,
      } });
      yield* deleteStashProjections({ ids: [dropItem.id] });
    } else {
      shouldNeverHappen("unknown drop item type", dropItem);
    }
  }
});

export const deleteDailyProjections = action({
  name: "deleteDailyProjections",
  args: { ids: v.array(v.string()) },
  handler: function* deleteDailyProjections({ ids }: {
    ids: string[];
  }) {
  yield* deleteRows(taskProjectionsTable, ids);
}
});

export const createDailyProjection = action({
  name: "createDailyProjection",
  args: {
    projection: v.object({
      id: v.string(),
      dailyListId: v.string(),
      orderToken: v.string(),
    }),
  },
  handler: function* createDailyProjection({ projection }: {
    projection: ({
    id: string; // This should be the task.id
    dailyListId: string;
    orderToken: string;
  });
  }) {
    const newProjection: TaskProjection = {
      type: projectionType,
      id: projection.id,
      dailyListId: projection.dailyListId,
      orderToken: projection.orderToken,
      createdAt: Date.now(),
    };

    yield* insert(taskProjectionsTable, [newProjection]);
    return newProjection;
  }
});

export const updateDailyProjection = action({
  name: "updateDailyProjection",
  args: {
    id: v.string(),
    projection: v.object({
      type: v.optional(v.literal(projectionType)),
      id: v.optional(v.string()),
      orderToken: v.optional(v.string()),
      dailyListId: v.optional(v.string()),
      createdAt: v.optional(v.number()),
    }),
  },
  handler: function* updateDailyProjection({ id, projection }: {
    id: string;
    projection: Partial<TaskProjection>;
  }): Generator<unknown, void, unknown> {
  const projInState = yield* dailyProjectionById({ id });
  if (!projInState) throw new Error("Projection not found");

  yield* upsertRows(taskProjectionsTable, [{ ...projInState, ...projection }]);
}
});

// Create or update projection for a task
export const upsertDailyProjection = action({
  name: "upsertDailyProjection",
  args: {
    projection: v.object({
      id: v.string(),
      dailyListId: v.string(),
      orderToken: v.string(),
    }),
  },
  handler: function* upsertDailyProjection({ projection }: {
    projection: ({
    id: string;
    dailyListId: string;
    orderToken: string;
  });
  }) {
    const existing = yield* dailyProjectionById({ id: projection.id });

    if (existing) {
      yield* updateDailyProjection({
  id: projection.id,
  projection: {
        dailyListId: projection.dailyListId,
        orderToken: projection.orderToken,
      },
});
      return yield* dailyProjectionByIdOrDefault({ id: projection.id });
    }

    return yield* createDailyProjection({ projection });
  }
});

// Create a sibling task in the daily list
export const createDailyProjectionSibling = action({
  name: "createDailyProjectionSibling",
  args: {
    taskId: v.string(),
    position: v.union(v.literal("before"), v.literal("after")),
    taskParams: v.optional(
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
  handler: function* createDailyProjectionSibling({ taskId, position, taskParams }: {
    taskId: string;
    position: "before" | "after";
    taskParams?: Partial<Task>;
  }) {
    const task = yield* taskById({ id: taskId });
    if (!task) throw new Error("Task not found");

    const projection = yield* dailyProjectionByTaskId({ taskId });
    if (!projection) throw new Error("Task not in daily list");

    // Create task in project first
    const newTask = yield* createSiblingTask({
  cardId: taskId,
  position,
  taskParams,
});

    // Add to daily list with proper ordering
    const sibs = yield* dailyProjectionSiblings({ taskId });
    const dailyListOrderToken = generateKeyPositionedBetween(
      projection,
      sibs,
      position,
    );

    return yield* createDailyProjection({ projection: {
      id: newTask.id,
      dailyListId: projection.dailyListId,
      orderToken: dailyListOrderToken,
    } });
  }
});

// Remove task from daily list
export const removeFromDailyList = action({
  name: "removeFromDailyList",
  args: { taskId: v.string() },
  handler: function* removeFromDailyList({ taskId }: {
    taskId: string;
  }) {
  yield* deleteDailyProjections({ ids: [taskId] });
}
});

// Create projection at the top of a daily list (ensures daily list exists)
export const createProjectionInDailyList = action({
  name: "createProjectionInDailyList",
  args: {
    taskId: v.string(),
    date: v.string(),
  },
  handler: function* createProjectionInDailyList({ taskId, date }: {
    taskId: string;
    date: string;
  }) {
    const dailyList = yield* createDailyListIfNotPresent({ date });

    const projections = yield* dailyProjectionsByDailyListId({ dailyListId: dailyList.id });
    const firstToken =
      projections.length > 0 ? projections[0].orderToken : null;
    const orderToken = generateJitteredKeyBetween(null, firstToken);

    return yield* createDailyProjection({ projection: {
      id: taskId,
      dailyListId: dailyList.id,
      orderToken,
    } });
  }
});

// Add task to daily list
export const addToDailyList = action({
  name: "addToDailyList",
  args: {
    taskId: v.string(),
    dailyListId: v.string(),
    position: orderPositionArg,
  },
  handler: function* addToDailyList({ taskId, dailyListId, position }: {
    taskId: string;
    dailyListId: string;
    position: OrderPositionArg;
  }): Generator<unknown, void, unknown> {
  const task = yield* taskById({ id: taskId });
  if (!task) throw new Error("Task not found");

  let orderToken: string;

  if (position === "append") {
    const projections = yield* dailyProjectionsByDailyListId({ dailyListId });
    const lastToken =
      projections.length > 0
        ? projections[projections.length - 1].orderToken
        : null;
    orderToken = generateJitteredKeyBetween(lastToken, null);
  } else if (position === "prepend") {
    const projections = yield* dailyProjectionsByDailyListId({ dailyListId });
    const firstToken =
      projections.length > 0 ? projections[0].orderToken : null;
    orderToken = generateJitteredKeyBetween(null, firstToken);
  } else {
    const siblings = normalizeOrderPosition(position) as [
      TaskProjection | undefined,
      TaskProjection | undefined,
    ];
    orderToken = generateJitteredKeyBetween(
      siblings[0]?.orderToken || null,
      siblings[1]?.orderToken || null,
    );
  }

  yield* upsertDailyProjection({ projection: {
    id: taskId,
    dailyListId,
    orderToken,
  } });
}
});

registerModelSlice(
  {
    byId: dailyProjectionById,
    delete: deleteDailyProjections,
    canDrop: dailyProjectionCanDrop,
    handleDrop: dailyProjectionHandleDrop,
  },
  taskProjectionsTable,
  projectionType,
);
