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
  upsert as upsertRows,
  v,
} from "@will-be-done/hyperdb-lib";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { generateKeyPositionedBetween } from "./utils";
import { registerSpaceSyncableTable } from "./syncMap";
import { registerModelSlice, AnyModelType } from "./maps";
import { appById } from "./app";
import { createProjectTask } from "./projects";
import { createSiblingTask } from "./projectsCategoriesCards";
import { deleteDailyProjections } from "./dailyListsProjections";
import { taskById, taskByIdOrDefault, taskType } from "./cardsTasks";
import { isTask, type Task } from "./cardsTasks";
import { isTaskProjection } from "./dailyListsProjections";
import type { OrderableItem } from "./utils";

// Type definitions
// stashProjection.id = task.id (1:1 relationship)
export const stashProjectionType = "stashProjection";

export const stashProjectionsTable = defineTable("stash_projections", {
  type: v.literal(stashProjectionType),
  id: v.string(),
  orderToken: v.string(),
  createdAt: v.number(),
})
  .index("byIds", ["id"])
  .index("byTokenOrdered", ["orderToken"]);
export type StashProjection = ExtractSchema<typeof stashProjectionsTable>;

export const isStashProjection =
  isObjectType<StashProjection>(stashProjectionType);

export const defaultStashProjection: StashProjection = {
  type: stashProjectionType,
  id: "default-stash-projection-id",
  orderToken: "",
  createdAt: 0,
};

registerSpaceSyncableTable(stashProjectionsTable, stashProjectionType);

const orderPositionArg = v.union(
  v.literal("append"),
  v.literal("prepend"),
  v.array(v.union(v.object({ orderToken: v.string() }), v.null())),
);

type OrderPositionArg =
  | "append"
  | "prepend"
  | (OrderableItem | null)[];

const normalizeOrderPosition = <T extends OrderableItem>(
  position: OrderPositionArg,
): "append" | "prepend" | [T | undefined, T | undefined] => {
  if (position === "append" || position === "prepend") return position;
  return [position[0] ?? undefined, position[1] ?? undefined] as [
    T | undefined,
    T | undefined,
  ];
};

// Selectors and actions
export const stashProjectionAllIds = selector({
  name: "stashProjectionAllIds",
  args: {},
  handler: function* stashProjectionAllIds() {
    const projections = yield* selectFrom(stashProjectionsTable, "byIds").where(
      (q) => q,
    );
    return projections.map((p) => p.id);
  }
});

export const stashProjectionAllTaskIds = selector({
  name: "stashProjectionAllTaskIds",
  args: {},
  handler: function* stashProjectionAllTaskIds() {
    return new Set(yield* stashProjectionAllIds({}));
  }
});

export const stashProjectionById = selector({
  name: "stashProjectionById",
  args: { id: v.string() },
  handler: function* stashProjectionById({ id }: {
    id: string;
  }) {
  const projections = yield* selectFrom(stashProjectionsTable, "byId")
    .where((q) => q.eq("id", id))
    .limit(1);
  return projections[0] as StashProjection | undefined;
}
});

export const stashProjectionsByIds = selector({
  name: "stashProjectionsByIds",
  args: { ids: v.array(v.string()) },
  handler: function* stashProjectionsByIds({ ids }: {
    ids: string[];
  }) {
  const projections = yield* selectFrom(stashProjectionsTable, "byId").where(
    (q) => ids.map((id) => q.eq("id", id)),
  );
  return projections as StashProjection[];
}
});

export const stashProjectionByIdOrDefault = selector({
  name: "stashProjectionByIdOrDefault",
  args: { id: v.string() },
  handler: function* stashProjectionByIdOrDefault({ id }: {
    id: string;
  }) {
    return (yield* stashProjectionById({ id })) || defaultStashProjection;
  }
});

// Get all stash projections ordered by token
export const allStashProjectionsOrdered = selector({
  name: "allStashProjectionsOrdered",
  args: {},
  handler: function* allStashProjectionsOrdered() {
    return (yield* selectFrom(stashProjectionsTable, "byTokenOrdered").where(
      (q) => q,
    )) as StashProjection[];
  }
});

// Check if a task is in the stash
export const stashHasProjection = selector({
  name: "stashHasProjection",
  args: { taskId: v.string() },
  handler: function* stashHasProjection({ taskId }: {
    taskId: string;
  }) {
  const projection = yield* stashProjectionById({ id: taskId });
  return projection !== undefined;
}
});

// Get all task ids in stash (non-done, ordered)
export const stashProjectionChildrenIds = selector({
  name: "stashProjectionChildrenIds",
  args: {},
  handler: function* stashProjectionChildrenIds(): Generator<
    unknown,
    string[],
    unknown
  > {
    const projections = yield* allStashProjectionsOrdered({});

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

// Get all done task ids in stash (sorted by lastToggledAt)
export const doneStashProjectionChildrenIds = selector({
  name: "doneStashProjectionChildrenIds",
  args: {},
  handler: function* doneStashProjectionChildrenIds(): Generator<
    unknown,
    string[],
    unknown
  > {
    const projections = yield* allStashProjectionsOrdered({});

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

// Get first task in stash
export const firstStashProjectionChild = selector({
  name: "firstStashProjectionChild",
  args: {},
  handler: function* firstStashProjectionChild(): Generator<
    unknown,
    Task | undefined,
    unknown
  > {
    const ids = yield* stashProjectionChildrenIds({});
    const firstChildId = ids[0];
    return firstChildId
      ? yield* taskById({ id: firstChildId })
      : (undefined as Task | undefined);
  }
});

// Get last task in stash
export const lastStashProjectionChild = selector({
  name: "lastStashProjectionChild",
  args: {},
  handler: function* lastStashProjectionChild(): Generator<
    unknown,
    Task | undefined,
    unknown
  > {
    const ids = yield* stashProjectionChildrenIds({});
    const lastChildId = ids[ids.length - 1];
    return lastChildId
      ? yield* taskById({ id: lastChildId })
      : (undefined as Task | undefined);
  }
});

// Get siblings of a task within the stash
export const stashProjectionSiblings = selector({
  name: "stashProjectionSiblings",
  args: { taskId: v.string() },
  handler: function* stashProjectionSiblings({ taskId }: {
    taskId: string;
  }) {
    const projection = yield* stashProjectionById({ id: taskId });
    if (!projection)
      return [undefined, undefined] as [
        StashProjection | undefined,
        StashProjection | undefined,
      ];

    const sortedProjections = yield* allStashProjectionsOrdered({});

    const index = sortedProjections.findIndex((p) => p.id === taskId);

    const before = index > 0 ? sortedProjections[index - 1] : undefined;
    const after =
      index < sortedProjections.length - 1
        ? sortedProjections[index + 1]
        : undefined;

    return [before, after] as [
      StashProjection | undefined,
      StashProjection | undefined,
    ];
  }
});

// Check if a stash projection can accept another model being dropped
export const stashProjectionCanDrop = selector({
  name: "stashProjectionCanDrop",
  args: {
    projectionId: v.string(),
    dropId: v.string(),
    dropModelType: v.union(v.literal("task"), v.literal("template"), v.literal("project"), v.literal("dailyList"), v.literal("projectCategory"), v.literal("projection"), v.literal("stashProjection"), v.literal("checklistItem"), v.literal("stash")),
  },
  handler: function* stashProjectionCanDrop({ projectionId, dropId, dropModelType }: {
    projectionId: string;
    dropId: string;
    dropModelType: AnyModelType;
  }): Generator<unknown, boolean, unknown> {
  const model = yield* appById({
  id: dropId,
  modelType: dropModelType,
});
  if (!model) return false;

  const projection = yield* stashProjectionById({ id: projectionId });
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
export const stashProjectionHandleDrop = action({
  name: "stashProjectionHandleDrop",
  args: {
    projectionId: v.string(),
    dropId: v.string(),
    dropModelType: v.union(v.literal("task"), v.literal("template"), v.literal("project"), v.literal("dailyList"), v.literal("projectCategory"), v.literal("projection"), v.literal("stashProjection"), v.literal("checklistItem"), v.literal("stash")),
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* stashProjectionHandleDrop({ projectionId, dropId, dropModelType, edge }: {
    projectionId: string;
    dropId: string;
    dropModelType: AnyModelType;
    edge: "top" | "bottom";
  }): Generator<unknown, void, unknown> {
    const canDropResult = yield* stashProjectionCanDrop({
  projectionId,
  dropId,
  dropModelType,
});
    if (!canDropResult) return;

    const projection = yield* stashProjectionById({ id: projectionId });
    if (!projection) return;

    const dropItem = yield* appById({
  id: dropId,
  modelType: dropModelType,
});
    if (!dropItem) return;

    const [up, down] = yield* stashProjectionSiblings({ taskId: projection.id });

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
      yield* upsertStashProjection({ projection: {
        id: dropItem.id,
        orderToken,
      } });
    } else if (isTaskProjection(dropItem)) {
      yield* upsertStashProjection({ projection: {
        id: dropItem.id,
        orderToken,
      } });
      yield* deleteDailyProjections({ ids: [dropItem.id] });
    } else if (isStashProjection(dropItem)) {
      yield* upsertStashProjection({ projection: {
        id: dropItem.id,
        orderToken,
      } });
    } else {
      shouldNeverHappen("unknown drop item type", dropItem);
    }
  }
});

export const deleteStashProjections = action({
  name: "deleteStashProjections",
  args: { ids: v.array(v.string()) },
  handler: function* deleteStashProjections({ ids }: {
    ids: string[];
  }) {
  yield* deleteRows(stashProjectionsTable, ids);
}
});

export const createStashProjection = action({
  name: "createStashProjection",
  args: {
    projection: v.object({
      id: v.string(),
      orderToken: v.string(),
    }),
  },
  handler: function* createStashProjection({ projection }: {
    projection: ({
    id: string; // This should be the task.id
    orderToken: string;
  });
  }) {
    const newProjection: StashProjection = {
      type: stashProjectionType,
      id: projection.id,
      orderToken: projection.orderToken,
      createdAt: Date.now(),
    };

    yield* insert(stashProjectionsTable, [newProjection]);
    return newProjection;
  }
});

export const updateStashProjection = action({
  name: "updateStashProjection",
  args: {
    id: v.string(),
    projection: v.object({
      type: v.optional(v.literal(stashProjectionType)),
      id: v.optional(v.string()),
      orderToken: v.optional(v.string()),
      createdAt: v.optional(v.number()),
    }),
  },
  handler: function* updateStashProjection({ id, projection }: {
    id: string;
    projection: Partial<StashProjection>;
  }): Generator<unknown, void, unknown> {
  const projInState = yield* stashProjectionById({ id });
  if (!projInState) throw new Error("Stash projection not found");

  yield* upsertRows(stashProjectionsTable, [{ ...projInState, ...projection }]);
}
});

// Create or update stash projection for a task
export const upsertStashProjection = action({
  name: "upsertStashProjection",
  args: {
    projection: v.object({
      id: v.string(),
      orderToken: v.string(),
    }),
  },
  handler: function* upsertStashProjection({ projection }: {
    projection: ({
    id: string;
    orderToken: string;
  });
  }) {
    const existing = yield* stashProjectionById({ id: projection.id });

    if (existing) {
      yield* updateStashProjection({
  id: projection.id,
  projection: {
        orderToken: projection.orderToken,
      },
});
      return yield* stashProjectionByIdOrDefault({ id: projection.id });
    }

    return yield* createStashProjection({ projection });
  }
});

// Create a sibling task in the stash
export const createStashProjectionSibling = action({
  name: "createStashProjectionSibling",
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
  handler: function* createStashProjectionSibling({ taskId, position, taskParams }: {
    taskId: string;
    position: "before" | "after";
    taskParams?: Partial<Task>;
  }) {
    const task = yield* taskById({ id: taskId });
    if (!task) throw new Error("Task not found");

    const projection = yield* stashProjectionById({ id: taskId });
    if (!projection) throw new Error("Task not in stash");

    // Create task in project first
    const newTask = yield* createSiblingTask({
  cardId: taskId,
  position,
  taskParams,
});

    // Add to stash with proper ordering
    const sibs = yield* stashProjectionSiblings({ taskId });
    const stashOrderToken = generateKeyPositionedBetween(
      projection,
      sibs,
      position,
    );

    return yield* createStashProjection({ projection: {
      id: newTask.id,
      orderToken: stashOrderToken,
    } });
  }
});

// Remove task from stash
export const removeFromStash = action({
  name: "removeFromStash",
  args: { taskId: v.string() },
  handler: function* removeFromStash({ taskId }: {
    taskId: string;
  }) {
  yield* deleteStashProjections({ ids: [taskId] });
}
});

// Add task to stash
export const addToStash = action({
  name: "addToStash",
  args: {
    taskId: v.string(),
    position: orderPositionArg,
  },
  handler: function* addToStash({ taskId, position }: {
    taskId: string;
    position: OrderPositionArg;
  }): Generator<unknown, void, unknown> {
  const task = yield* taskById({ id: taskId });
  if (!task) throw new Error("Task not found");

  let orderToken: string;

  if (position === "append") {
    const projections = yield* allStashProjectionsOrdered({});
    const lastToken =
      projections.length > 0
        ? projections[projections.length - 1].orderToken
        : null;
    orderToken = generateJitteredKeyBetween(lastToken, null);
  } else if (position === "prepend") {
    const projections = yield* allStashProjectionsOrdered({});
    const firstToken =
      projections.length > 0 ? projections[0].orderToken : null;
    orderToken = generateJitteredKeyBetween(null, firstToken);
  } else {
    const siblings = [position[0] ?? undefined, position[1] ?? undefined] as [
      StashProjection | undefined,
      StashProjection | undefined,
    ];
    orderToken = generateJitteredKeyBetween(
      siblings[0]?.orderToken || null,
      siblings[1]?.orderToken || null,
    );
  }

  yield* upsertStashProjection({ projection: {
    id: taskId,
    orderToken,
  } });
}
});

registerModelSlice(
  {
    byId: stashProjectionById,
    delete: deleteStashProjections,
    canDrop: stashProjectionCanDrop,
    handleDrop: stashProjectionHandleDrop,
  },
  stashProjectionsTable,
  stashProjectionType,
);

// --- Column-level "stash" model type ---
// Used as columnModelType in TasksColumn for dropping onto the stash column header.
// No separate table/entity needed — the stash is a singleton concept.

export const stashType = "stash" as const;
export const STASH_ID = "stash-singleton";

// Column-level canDrop: any todo task/projection can be dropped onto the stash column
const stashColumnCanDrop = selector({
  name: "stashColumnCanDrop",
  args: {
    _stashId: v.string(),
    dropId: v.string(),
    dropModelType: v.union(v.literal("task"), v.literal("template"), v.literal("project"), v.literal("dailyList"), v.literal("projectCategory"), v.literal("projection"), v.literal("stashProjection"), v.literal("checklistItem"), v.literal("stash")),
  },
  handler: function* stashColumnCanDrop({ _stashId, dropId, dropModelType }: {
    _stashId: string;
    dropId: string;
    dropModelType: AnyModelType;
  }): Generator<unknown, boolean, unknown> {
  const model = yield* appById({
  id: dropId,
  modelType: dropModelType,
});
  if (!model) return false;

  if (isTask(model)) {
    return model.state === "todo";
  }

  if (isTaskProjection(model)) {
    const task = yield* taskById({ id: model.id });
    return task !== undefined && task.state === "todo";
  }

  if (isStashProjection(model)) {
    const task = yield* taskById({ id: model.id });
    return task !== undefined && task.state === "todo";
  }

  return false;
}
});

// Column-level handleDrop: add dropped task to stash (prepend/append based on edge)
const stashColumnHandleDrop = action({
  name: "stashColumnHandleDrop",
  args: {
    _stashId: v.string(),
    dropId: v.string(),
    dropModelType: v.union(v.literal("task"), v.literal("template"), v.literal("project"), v.literal("dailyList"), v.literal("projectCategory"), v.literal("projection"), v.literal("stashProjection"), v.literal("checklistItem"), v.literal("stash")),
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* stashColumnHandleDrop({ _stashId, dropId, dropModelType, edge }: {
    _stashId: string;
    dropId: string;
    dropModelType: AnyModelType;
    edge: "top" | "bottom";
  }): Generator<unknown, void, unknown> {
  const drop = yield* appById({
  id: dropId,
  modelType: dropModelType,
});
  if (!drop) return;

  let taskId: string;
  let shouldDeleteProjection = false;
  if (isTask(drop)) {
    taskId = drop.id;
  } else if (isTaskProjection(drop)) {
    taskId = drop.id;
    shouldDeleteProjection = true;
  } else if (isStashProjection(drop)) {
    taskId = drop.id;
  } else {
    return;
  }

  yield* addToStash({
  taskId,
  position: edge === "top" ? "prepend" : "append",
});

  if (shouldDeleteProjection) {
    yield* deleteStashProjections({ ids: [taskId] });
  }
}
});

// Column-level byId: returns the stash projection if it exists, for the column model lookup
const stashColumnById = selector({
  name: "stashColumnById",
  args: { _id: v.string() },
  handler: function* stashColumnById({ _id }: {
    _id: string;
  }) {
  return undefined as StashProjection | undefined;
}
});

const stashColumnDelete = action({
  name: "stashColumnDelete",
  args: { _ids: v.array(v.string()) },
  handler: function* stashColumnDelete({ _ids }: {
    _ids: string[];
  }) {
  // No-op: stash is a virtual singleton, nothing to delete
}
});

// Create a task directly in the stash
export const createTaskInStash = action({
  name: "createTaskInStash",
  args: {
    projectId: v.string(),
    position: orderPositionArg,
    categoryPosition: orderPositionArg,
  },
  handler: function* createTaskInStash({ projectId, position, categoryPosition }: {
    projectId: string;
    position: OrderPositionArg;
    categoryPosition: OrderPositionArg;
  }): Generator<unknown, Task, unknown> {
  const task = yield* createProjectTask({
  projectId,
  position: categoryPosition,
});

  yield* addToStash({
  taskId: task.id,
  position,
});

  return yield* taskByIdOrDefault({ id: task.id });
}
});

registerModelSlice(
  {
    byId: stashColumnById,
    delete: stashColumnDelete,
    canDrop: stashColumnCanDrop,
    handleDrop: stashColumnHandleDrop,
  },
  stashProjectionsTable,
  stashType,
);
