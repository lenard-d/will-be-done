import {
  action,
  deleteRows,
  insert,
  selectFrom,
  selector,
  v,
} from "@will-be-done/hyperdb-lib";
import { getDMY, orderPositionArg } from "./utils";
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
import { registerModelSlice } from "./maps";
import { genUUIDV5 } from "../traits";
import {
  dailyListType,
  dailyListsTable,
  Task,
  isTask,
  possibleModelType,
  DailyList,
  isTaskProjection,
  isStashProjection,
} from "./tables";

export const defaultDailyList: DailyList = {
  type: dailyListType,
  id: "default-daily-list-id",
  date: "",
};

export const dailyListAllIds = selector({
  name: "dailyListAllIds",
  args: {},
  handler: function* dailyListAllIds() {
    const dailyLists = yield* selectFrom(dailyListsTable, "byIds").where(
      (q) => q,
    );

    return dailyLists.map((p) => p.id);
  },
});

export const dailyListById = selector({
  name: "dailyListById",
  args: { id: v.string() },
  handler: function* dailyListById({ id }) {
    const dailyLists = yield* selectFrom(dailyListsTable, "byId")
      .where((q) => q.eq("id", id))
      .limit(1);
    return dailyLists[0] as DailyList | undefined;
  },
});

export const dailyListsByIds = selector({
  name: "dailyListsByIds",
  args: { ids: v.array(v.string()) },
  handler: function* dailyListsByIds({ ids }) {
    const dailyLists = yield* selectFrom(dailyListsTable, "byId").where((q) =>
      ids.map((id) => q.eq("id", id)),
    );
    return dailyLists as DailyList[];
  },
});

export const dailyListByIdOrDefault = selector({
  name: "dailyListByIdOrDefault",
  args: { id: v.string() },
  handler: function* dailyListByIdOrDefault({ id }) {
    return (yield* dailyListById({ id })) || defaultDailyList;
  },
});

export const dailyListByDate = selector({
  name: "dailyListByDate",
  args: { date: v.string() },
  handler: function* dailyListByDate({ date }) {
    const dailyLists = yield* selectFrom(dailyListsTable, "byDate")
      .where((q) => q.eq("date", date))
      .limit(1);
    return dailyLists[0] as DailyList | undefined;
  },
});

export const dailyListChildrenIds = selector({
  name: "dailyListChildrenIds",
  args: { dailyListId: v.string() },
  handler: function* dailyListChildrenIds({
    dailyListId,
  }): Generator<unknown, string[], unknown> {
    return yield* dailyProjectionChildrenIds({ dailyListId });
  },
});

export const dailyListDoneChildrenIds = selector({
  name: "dailyListDoneChildrenIds",
  args: { dailyListId: v.string() },
  handler: function* dailyListDoneChildrenIds({
    dailyListId,
  }): Generator<unknown, string[], unknown> {
    return yield* doneDailyProjectionChildrenIds({ dailyListId });
  },
});

export const dailyListTaskIds = selector({
  name: "dailyListTaskIds",
  args: { dailyListId: v.string() },
  handler: function* dailyListTaskIds({ dailyListId }) {
    return yield* dailyListChildrenIds({ dailyListId });
  },
});

export const dailyListAllTaskIds = selector({
  name: "dailyListAllTaskIds",
  args: { dailyListIds: v.array(v.string()) },
  handler: function* dailyListAllTaskIds({ dailyListIds }) {
    const result = new Set<string>();

    for (const dailyListId of dailyListIds) {
      const ids = yield* dailyListTaskIds({ dailyListId });
      ids.forEach((id) => result.add(id));
    }

    return result;
  },
});

export const dailyListDateIdsMap = selector({
  name: "dailyListDateIdsMap",
  args: {},
  handler: function* dailyListDateIdsMap() {
    const allDailyLists = yield* selectFrom(dailyListsTable, "byIds");
    return Object.fromEntries(
      allDailyLists.map((d) => [d.date, d.id]),
    ) as Record<string, string>;
  },
});

export const dailyListIdsByDates = selector({
  name: "dailyListIdsByDates",
  args: { dates: v.array(v.number()) },
  handler: function* dailyListIdsByDates({ dates }) {
    const map = yield* dailyListDateIdsMap({});
    return dates
      .map((timestamp) => {
        const date = new Date(timestamp);
        const dmy = getDMY(date);
        return map[dmy];
      })
      .filter((id) => id !== undefined) as string[];
  },
});

export const firstDailyListChild = selector({
  name: "firstDailyListChild",
  args: { dailyListId: v.string() },
  handler: function* firstDailyListChild({
    dailyListId,
  }): Generator<unknown, Task | undefined, unknown> {
    return yield* firstDailyProjectionChild({ dailyListId });
  },
});

export const lastDailyListChild = selector({
  name: "lastDailyListChild",
  args: { dailyListId: v.string() },
  handler: function* lastDailyListChild({
    dailyListId,
  }): Generator<unknown, Task | undefined, unknown> {
    return yield* lastDailyProjectionChild({ dailyListId });
  },
});

export const dailyListCanDrop = selector({
  name: "dailyListCanDrop",
  args: {
    _dailyListId: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
  },
  handler: function* dailyListCanDrop({
    _dailyListId,
    dropId,
    dropModelType,
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
  },
});

export const dailyListGetId = selector({
  name: "dailyListGetId",
  args: { date: v.string() },
  handler: function* dailyListGetId({ date }) {
    return yield* genUUIDV5(dailyListType, date);
  },
});

export const createDailyList = action({
  name: "createDailyList",
  args: {
    dailyList: v.required(v.partial(dailyListsTable.v()), ["date"]),
  },
  handler: function* createDailyList({ dailyList }) {
    const id = yield* dailyListGetId({ date: dailyList.date });
    const newDailyList: DailyList = {
      type: dailyListType,
      id,
      date: dailyList.date,
    };

    yield* insert(dailyListsTable, [newDailyList]);
    return newDailyList;
  },
});

export const createDailyListIfNotPresent = action({
  name: "createDailyListIfNotPresent",
  args: { date: v.string() },
  handler: function* createDailyListIfNotPresent({ date }) {
    const existing = yield* dailyListByDate({ date });
    if (existing) {
      return existing;
    }

    return yield* createDailyList({ dailyList: { date } });
  },
});

export const createManyDailyListsIfNotPresent = action({
  name: "createManyDailyListsIfNotPresent",
  args: { dates: v.array(v.number()) },
  handler: function* createManyDailyListsIfNotPresent({ dates }) {
    const results: DailyList[] = [];
    for (const timestamp of dates) {
      const date = new Date(timestamp);
      const dmy = getDMY(date);
      const dailyList = yield* createDailyListIfNotPresent({ date: dmy });
      results.push(dailyList);
    }
    return results;
  },
});

export const deleteDailyLists = action({
  name: "deleteDailyLists",
  args: { ids: v.array(v.string()) },
  handler: function* deleteDailyLists({ ids }) {
    yield* deleteRows(dailyListsTable, ids);
  },
});

export const createTaskInList = action({
  name: "createTaskInList",
  args: {
    dailyListId: v.string(),
    projectId: v.string(),
    listPosition: orderPositionArg,
    categoryPosition: orderPositionArg,
  },
  handler: function* createTaskInList({
    dailyListId,
    projectId,
    listPosition,
    categoryPosition,
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
  },
});

export const dailyListHandleDrop = action({
  name: "dailyListHandleDrop",
  args: {
    dailyListId: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* dailyListHandleDrop({
    dailyListId,
    dropId,
    dropModelType,
    edge,
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
  },
});

const dailyListsSlice = {
  byId: dailyListById,
  delete: deleteDailyLists,
  handleDrop: dailyListHandleDrop,
  canDrop: dailyListCanDrop,
};
registerModelSlice(dailyListsSlice, dailyListsTable, dailyListType);
