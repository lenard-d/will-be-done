import { isObjectType } from "../utils";
import {
  action,
  deleteRows,
  defineTable,
  type ExtractSchema,
  insert,
  selectFrom,
  selector,
  v,
} from "@will-be-done/hyperdb-lib";
import type { OrderableItem } from "./utils";
import { getDMY } from "./utils";
import { appById } from "./app";
import {
  addToDailyList,
  dailyProjectionChildrenIds,
  doneDailyProjectionChildrenIds,
  firstDailyProjectionChild,
  lastDailyProjectionChild,
} from "./dailyListsProjections";
import { createProjectTask } from "./projects";
import { deleteStashProjections } from "./stashProjections";
import { taskById, taskByIdOrDefault } from "./cardsTasks";
import { isTask, type Task } from "./cardsTasks";
import { isTaskProjection } from "./dailyListsProjections";
import { isStashProjection } from "./stashProjections";
import { AnyModelType } from "./maps";
import { registerSpaceSyncableTable } from "./syncMap";
import { registerModelSlice } from "./maps";
import { genUUIDV5 } from "../traits";

// Type definitions
export const dailyListType = "dailyList";

export const dailyListsTable = defineTable("daily_lists", {
  type: v.literal(dailyListType),
  id: v.string(),
  date: v.string(),
})
  .index("byIds", ["id"])
  .index("byDate", ["date"], { type: "hash" });
export type DailyList = ExtractSchema<typeof dailyListsTable>;

export const isDailyList = isObjectType<DailyList>(dailyListType);

export const defaultDailyList: DailyList = {
  type: dailyListType,
  id: "default-daily-list-id",
  date: "",
};

registerSpaceSyncableTable(dailyListsTable, dailyListType);

const orderPositionArg = v.union(
  v.literal("append"),
  v.literal("prepend"),
  v.array(v.union(v.object({ orderToken: v.string() }), v.null())),
);

type OrderPositionArg = "append" | "prepend" | (OrderableItem | null)[];

// Selectors and actions
export const dailyListAllIds = selector({
  name: "dailyListAllIds",
  args: {},
  handler: function* dailyListAllIds() {
  const dailyLists = yield* selectFrom(dailyListsTable, "byIds").where(
    (q) => q,
  );

  return dailyLists.map((p) => p.id);
}
});

export const dailyListById = selector({
  name: "dailyListById",
  args: { id: v.string() },
  handler: function* dailyListById({ id }: {
    id: string;
  }) {
  const dailyLists = yield* selectFrom(dailyListsTable, "byId")
    .where((q) => q.eq("id", id))
    .limit(1);
  return dailyLists[0] as DailyList | undefined;
}
});

export const dailyListsByIds = selector({
  name: "dailyListsByIds",
  args: { ids: v.array(v.string()) },
  handler: function* dailyListsByIds({ ids }: {
    ids: string[];
  }) {
  const dailyLists = yield* selectFrom(dailyListsTable, "byId").where((q) =>
    ids.map((id) => q.eq("id", id)),
  );
  return dailyLists as DailyList[];
}
});

export const dailyListByIdOrDefault = selector({
  name: "dailyListByIdOrDefault",
  args: { id: v.string() },
  handler: function* dailyListByIdOrDefault({ id }: {
    id: string;
  }) {
  return (yield* dailyListById({ id })) || defaultDailyList;
}
});

export const dailyListByDate = selector({
  name: "dailyListByDate",
  args: { date: v.string() },
  handler: function* dailyListByDate({ date }: {
    date: string;
  }) {
  const dailyLists = yield* selectFrom(dailyListsTable, "byDate")
    .where((q) => q.eq("date", date))
    .limit(1);
  return dailyLists[0] as DailyList | undefined;
}
});

export const dailyListChildrenIds = selector({
  name: "dailyListChildrenIds",
  args: { dailyListId: v.string() },
  handler: function* dailyListChildrenIds({ dailyListId }: {
    dailyListId: string;
  }): Generator<unknown, string[], unknown> {
  return yield* dailyProjectionChildrenIds({ dailyListId });
}
});

export const dailyListDoneChildrenIds = selector({
  name: "dailyListDoneChildrenIds",
  args: { dailyListId: v.string() },
  handler: function* dailyListDoneChildrenIds({ dailyListId }: {
    dailyListId: string;
  }): Generator<unknown, string[], unknown> {
    return yield* doneDailyProjectionChildrenIds({ dailyListId });
  }
});

export const dailyListTaskIds = selector({
  name: "dailyListTaskIds",
  args: { dailyListId: v.string() },
  handler: function* dailyListTaskIds({ dailyListId }: {
    dailyListId: string;
  }) {
  return yield* dailyListChildrenIds({ dailyListId });
}
});

export const dailyListAllTaskIds = selector({
  name: "dailyListAllTaskIds",
  args: { dailyListIds: v.array(v.string()) },
  handler: function* dailyListAllTaskIds({ dailyListIds }: {
    dailyListIds: string[];
  }) {
  const result = new Set<string>();

  for (const dailyListId of dailyListIds) {
    const ids = yield* dailyListTaskIds({ dailyListId });
    ids.forEach((id) => result.add(id));
  }

  return result;
}
});

export const dailyListDateIdsMap = selector({
  name: "dailyListDateIdsMap",
  args: {},
  handler: function* dailyListDateIdsMap() {
  const allDailyLists = yield* selectFrom(dailyListsTable, "byIds");
  return Object.fromEntries(allDailyLists.map((d) => [d.date, d.id])) as Record<
    string,
    string
  >;
}
});

export const dailyListIdsByDates = selector({
  name: "dailyListIdsByDates",
  args: { dates: v.array(v.number()) },
  handler: function* dailyListIdsByDates({ dates }: {
    dates: number[];
  }) {
  const map = yield* dailyListDateIdsMap({});
  return dates
    .map((timestamp) => {
      const date = new Date(timestamp);
      const dmy = getDMY(date);
      return map[dmy];
    })
    .filter((id) => id !== undefined) as string[];
}
});

export const firstDailyListChild = selector({
  name: "firstDailyListChild",
  args: { dailyListId: v.string() },
  handler: function* firstDailyListChild({ dailyListId }: {
    dailyListId: string;
  }): Generator<unknown, Task | undefined, unknown> {
  return yield* firstDailyProjectionChild({ dailyListId });
}
});

export const lastDailyListChild = selector({
  name: "lastDailyListChild",
  args: { dailyListId: v.string() },
  handler: function* lastDailyListChild({ dailyListId }: {
    dailyListId: string;
  }): Generator<unknown, Task | undefined, unknown> {
  return yield* lastDailyProjectionChild({ dailyListId });
}
});

export const dailyListCanDrop = selector({
  name: "dailyListCanDrop",
  args: {
    _dailyListId: v.string(),
    dropId: v.string(),
    dropModelType: v.union(v.literal("task"), v.literal("template"), v.literal("project"), v.literal("dailyList"), v.literal("projectCategory"), v.literal("projection"), v.literal("stashProjection"), v.literal("checklistItem"), v.literal("stash")),
  },
  handler: function* dailyListCanDrop({ _dailyListId, dropId, dropModelType }: {
    _dailyListId: string;
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

export const dailyListGetId = selector({
  name: "dailyListGetId",
  args: { date: v.string() },
  handler: function* dailyListGetId({ date }: {
    date: string;
  }) {
  return yield* genUUIDV5(dailyListType, date);
}
});

export const createDailyList = action({
  name: "createDailyList",
  args: {
    dailyList: v.object({
      date: v.string(),
    }),
  },
  handler: function* createDailyList({ dailyList }: {
    dailyList: ({
  date: string;
});
  }) {
  const id = yield* dailyListGetId({ date: dailyList.date });
  const newDailyList: DailyList = {
    type: dailyListType,
    id,
    date: dailyList.date,
  };

  yield* insert(dailyListsTable, [newDailyList]);
  return newDailyList;
}
});

export const createDailyListIfNotPresent = action({
  name: "createDailyListIfNotPresent",
  args: { date: v.string() },
  handler: function* createDailyListIfNotPresent({ date }: {
    date: string;
  }) {
    const existing = yield* dailyListByDate({ date });
    if (existing) {
      return existing;
    }

    return yield* createDailyList({ dailyList: { date } });
  }
});

export const createManyDailyListsIfNotPresent = action({
  name: "createManyDailyListsIfNotPresent",
  args: { dates: v.array(v.number()) },
  handler: function* createManyDailyListsIfNotPresent({ dates }: {
    dates: number[];
  }) {
    const results: DailyList[] = [];
    for (const timestamp of dates) {
      const date = new Date(timestamp);
      const dmy = getDMY(date);
      const dailyList = yield* createDailyListIfNotPresent({ date: dmy });
      results.push(dailyList);
    }
    return results;
  }
});

export const deleteDailyLists = action({
  name: "deleteDailyLists",
  args: { ids: v.array(v.string()) },
  handler: function* deleteDailyLists({ ids }: {
    ids: string[];
  }) {
  yield* deleteRows(dailyListsTable, ids);
}
});

export const createTaskInList = action({
  name: "createTaskInList",
  args: {
    dailyListId: v.string(),
    projectId: v.string(),
    listPosition: orderPositionArg,
    categoryPosition: orderPositionArg,
  },
  handler: function* createTaskInList({ dailyListId, projectId, listPosition, categoryPosition }: {
    dailyListId: string;
    projectId: string;
    listPosition: OrderPositionArg;
    categoryPosition: OrderPositionArg;
  }): Generator<unknown, Task, unknown> {
  const task = yield* createProjectTask({
  projectId,
  position: categoryPosition,
});

  yield* addToDailyList({
  taskId: task.id,
  dailyListId,
  position: listPosition,
});

  return yield* taskByIdOrDefault({ id: task.id });
}
});

export const dailyListHandleDrop = action({
  name: "dailyListHandleDrop",
  args: {
    dailyListId: v.string(),
    dropId: v.string(),
    dropModelType: v.union(v.literal("task"), v.literal("template"), v.literal("project"), v.literal("dailyList"), v.literal("projectCategory"), v.literal("projection"), v.literal("stashProjection"), v.literal("checklistItem"), v.literal("stash")),
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* dailyListHandleDrop({ dailyListId, dropId, dropModelType, edge }: {
    dailyListId: string;
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
  let shouldDeleteStashProjection = false;
  if (isTask(drop)) {
    taskId = drop.id;
  } else if (isTaskProjection(drop)) {
    taskId = drop.id; // projection.id is the same as task.id
  } else if (isStashProjection(drop)) {
    taskId = drop.id;
    shouldDeleteStashProjection = true;
  } else {
    return;
  }

  yield* addToDailyList({
  taskId,
  dailyListId,
  position: edge === "top" ? "prepend" : "append",
});

  if (shouldDeleteStashProjection) {
    yield* deleteStashProjections({ ids: [taskId] });
  }
}
});

// Local slice object for registerModelSlice (not exported)
const dailyListsSlice = {
  dailyListAllIds,
  byId: dailyListById,
  dailyListsByIds,
  dailyListByIdOrDefault,
  dailyListByDate,
  dailyListChildrenIds,
  dailyListDoneChildrenIds,
  dailyListTaskIds,
  dailyListAllTaskIds,
  dailyListDateIdsMap,
  dailyListIdsByDates,
  firstDailyListChild,
  lastDailyListChild,
  canDrop: dailyListCanDrop,
  dailyListGetId,
  createDailyList,
  createDailyListIfNotPresent,
  createManyDailyListsIfNotPresent,
  delete: deleteDailyLists,
  createTaskInList,
  handleDrop: dailyListHandleDrop,
};
registerModelSlice(dailyListsSlice, dailyListsTable, dailyListType);
