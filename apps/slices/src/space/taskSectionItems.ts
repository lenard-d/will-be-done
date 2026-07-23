import { selectFrom, v } from "@will-be-done/hyperdb";
import { action, selector } from "../builders";
import { dailyDateFormat, generateKeyPositionedBetween } from "./utils";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { createTask, taskById, defaultTask } from "./tasks";
import { taskTemplateById } from "./taskTemplates";
import { parse } from "date-fns";
import {
  tasksTable,
  taskTemplatesTable,
  dailyEntriesTable,
  taskSectionsTable,
  projectsTable,
  dailyListsTable,
  checklistItemsTable,
  listItem,
  dailyEntryType,
  stashEntryType,
  type ListItem,
  type Task,
  type TaskTemplate,
  type Project,
  type TaskSection,
  type DailyList,
  type DailyEntry,
  Item,
} from "./tables";

export type ItemForDisplay = {
  item: Item;
  section: TaskSection;
  listItem: ListItem;
  project: Project;
  dailyList: DailyList | undefined;
  dateOfTask: Date | undefined;
  lastScheduleTime: Date | undefined;
  hasChecklist: boolean;
};

// TODO: check if all items renamed to item

export const firstTaskSectionItem = selector({
  name: "firstTaskSectionItem",
  args: { taskSectionId: v.string() },
  handler: function* firstTaskSectionItem({
    taskSectionId,
  }): Generator<unknown, Item, unknown> {
    const ids = yield* taskSectionItemIds({ taskSectionId });
    if (ids.length === 0) return defaultTask;

    return yield* taskSectionItemByIdOrDefault({ id: ids[0] });
  },
});

export const lastTaskSectionItem = selector({
  name: "lastTaskSectionItem",
  args: { taskSectionId: v.string() },
  handler: function* lastTaskSectionItem({
    taskSectionId,
  }): Generator<unknown, Item, unknown> {
    const ids = yield* taskSectionItemIds({ taskSectionId });
    if (ids.length === 0) return defaultTask;

    return yield* taskSectionItemByIdOrDefault({ id: ids[ids.length - 1] });
  },
});

export const taskSectionItems = selector({
  name: "taskSectionItems",
  args: { taskSectionId: v.string() },
  memoization: { selfChild: true },
  handler: function* ({ taskSectionId }) {
    // TODO: make separate table that will maintain list
    // of all items in a project section
    // or you merge sort
    const tasks = yield* selectFrom(
      tasksTable,
      "byTaskSectionIdOrderStates",
    ).where((q) => q.eq("taskSectionId", taskSectionId).eq("state", "todo"));

    const templates = yield* selectFrom(
      taskTemplatesTable,
      "byTaskSectionIdOrderStates",
    ).where((q) => q.eq("taskSectionId", taskSectionId));

    const allItems = [...tasks, ...templates];

    return allItems.sort((a, b) => {
      if (a.orderToken > b.orderToken) {
        return 1;
      }
      if (a.orderToken < b.orderToken) {
        return -1;
      }

      return 0;
    }) as (Task | TaskTemplate)[];
  },
});

export const taskSectionItemsForDisplay = selector({
  name: "taskSectionItemsForDisplay",
  args: {
    items: v.array(v.union(tasksTable.v(), taskTemplatesTable.v())),
    listItems: v.array(listItem),
  },
  handler: function* taskSectionItemsForDisplay({
    items,
    listItems,
  }): Generator<unknown, ItemForDisplay[], unknown> {
    const taskSectionIds = [
      ...new Set(items.map((item) => item.taskSectionId)),
    ];
    const sections = taskSectionIds.length
      ? yield* selectFrom(taskSectionsTable, "byId").where((q) =>
          taskSectionIds.map((id) => q.eq("id", id)),
        )
      : [];
    const sectionMap = new Map(
      (sections as TaskSection[]).map((section) => [section.id, section]),
    );

    const projectIds = [
      ...new Set((sections as TaskSection[]).map((c) => c.projectId)),
    ];
    const projects = projectIds.length
      ? yield* selectFrom(projectsTable, "byId").where((q) =>
          projectIds.map((id) => q.eq("id", id)),
        )
      : [];
    const projectMap = new Map(
      (projects as Project[]).map((project) => [project.id, project]),
    );

    const itemIds = items.map((item) => item.id);
    const entries = itemIds.length
      ? yield* selectFrom(dailyEntriesTable, "byId").where((q) =>
          itemIds.map((id) => q.eq("id", id)),
        )
      : [];
    const dailyEntryMap = new Map(
      (entries as DailyEntry[]).map((entry) => [entry.id, entry]),
    );

    const dailyListIds = [
      ...new Set((entries as DailyEntry[]).map((entry) => entry.dailyListId)),
    ];
    const dailyLists = dailyListIds.length
      ? yield* selectFrom(dailyListsTable, "byId").where((q) =>
          dailyListIds.map((id) => q.eq("id", id)),
        )
      : [];
    const dailyListMap = new Map(
      (dailyLists as DailyList[]).map((dailyList) => [dailyList.id, dailyList]),
    );
    const listItemMap = new Map(
      listItems.map((listItem) => [
        `${listItem.type}:${listItem.id}`,
        listItem,
      ]),
    );

    const checklistItems = items.length
      ? yield* selectFrom(checklistItemsTable, "byParentOrder").where((q) =>
          items.map((item) =>
            q.eq("parentType", item.type).eq("parentId", item.id),
          ),
        )
      : [];
    const hasChecklistMap = new Map(
      checklistItems.map((item) => [
        `${item.parentId}:${item.parentType}`,
        true,
      ]),
    );

    return items
      .map((item) => {
        const section = sectionMap.get(item.taskSectionId);
        if (!section) return;

        const project = projectMap.get(section.projectId);
        if (!project) return;

        const listItem =
          listItemMap.get(`${item.type}:${item.id}`) ||
          listItemMap.get(`${dailyEntryType}:${item.id}`) ||
          listItemMap.get(`${stashEntryType}:${item.id}`);
        if (!listItem) return;

        const entry = dailyEntryMap.get(item.id);
        const dailyList = entry
          ? dailyListMap.get(entry.dailyListId)
          : undefined;
        const dateOfTask = dailyList
          ? parse(dailyList.date, dailyDateFormat, new Date())
          : undefined;

        return {
          item,
          section,
          project,
          listItem,
          dailyList,
          dateOfTask,
          lastScheduleTime: dateOfTask,
          hasChecklist: hasChecklistMap.get(`${item.id}:${item.type}`) ?? false,
        };
      })
      .filter((item) => !!item);
  },
});

export const taskSectionItemsForDisplayChildren = selector({
  name: "taskSectionItemsForDisplayChildren",
  args: { taskSectionId: v.string() },
  handler: function* taskSectionItemsForDisplayChildren({ taskSectionId }) {
    const items = yield* taskSectionItems({ taskSectionId });
    return yield* taskSectionItemsForDisplay({
      items,
      listItems: items,
    });
  },
});

export const taskSectionItemIds = selector({
  name: "taskSectionItemIds",
  args: { taskSectionId: v.string() },
  handler: function* taskSectionItemIds({ taskSectionId }) {
    return (yield* taskSectionItems({ taskSectionId })).map((item) => item.id);
  },
});

export const doneTaskSectionItemsForDisplay = selector({
  name: "doneTaskSectionItemsForDisplay",
  args: { taskSectionId: v.string(), limited: v.boolean() },
  handler: function* doneTaskSectionItemsForDisplay({
    taskSectionId,
    limited,
  }) {
    const tasks = yield* selectFrom(
      tasksTable,
      "byTaskSectionIdStatesToggledAt",
    )
      .where((q) => q.eq("taskSectionId", taskSectionId).eq("state", "done"))
      // fetch one more, so UI will show "Show more" button and limit to show only 5 items
      .limit(limited ? 6 : 9999)
      .order("desc");

    return yield* taskSectionItemsForDisplay({
      items: tasks,
      listItems: tasks,
    });
  },
});

export const taskSectionItemById = selector({
  name: "taskSectionItemById",
  args: { id: v.string() },
  handler: function* taskSectionItemById({
    id,
  }): Generator<unknown, Item | undefined, unknown> {
    const task = yield* taskById({ id });
    if (task) return task;

    const template = yield* taskTemplateById({ id });
    if (template) return template;

    return undefined;
  },
});

export const taskSectionItemByIdOrDefault = selector({
  name: "taskSectionItemByIdOrDefault",
  args: { id: v.string() },
  handler: function* taskSectionItemByIdOrDefault({
    id,
  }): Generator<unknown, Item, unknown> {
    return (yield* taskSectionItemById({ id })) || defaultTask;
  },
});

export const taskSectionItemSiblings = selector({
  name: "taskSectionItemSiblings",
  args: { itemId: v.string() },
  handler: function* taskSectionItemSiblings({
    itemId,
  }): Generator<unknown, [Item | undefined, Item | undefined], unknown> {
    const item = yield* taskSectionItemByIdOrDefault({ id: itemId });
    if (!item) return [undefined, undefined];

    const ids = yield* taskSectionItemIds({
      taskSectionId: item.taskSectionId,
    });
    const index = ids.findIndex((id) => id === itemId);

    const beforeId = index > 0 ? ids[index - 1] : undefined;
    const afterId = index < ids.length - 1 ? ids[index + 1] : undefined;

    const before = beforeId
      ? yield* taskSectionItemByIdOrDefault({ id: beforeId })
      : undefined;
    const after = afterId
      ? yield* taskSectionItemByIdOrDefault({ id: afterId })
      : undefined;

    return [before, after];
  },
});

export const createTaskNextToSectionItem = action({
  name: "createTaskNextToSectionItem",
  args: {
    itemId: v.string(),
    position: v.union(v.literal("before"), v.literal("after")),
    taskParams: v.optional(v.partial(tasksTable.v())),
  },
  handler: function* createTaskNextToSectionItem({
    itemId,
    position,
    taskParams,
  }) {
    const item = yield* taskSectionItemById({ id: itemId });
    if (!item) throw new Error("Item not found");

    return yield* createTask({
      task: {
        ...taskParams,
        taskSectionId: item.taskSectionId,
        orderToken: generateKeyPositionedBetween(
          item,
          yield* taskSectionItemSiblings({ itemId }),
          position,
        ),
      },
    });
  },
});

export const createTaskAfterSectionItem = action({
  name: "createTaskAfterSectionItem",
  args: {
    itemId: v.string(),
    taskParams: v.optional(v.partial(tasksTable.v())),
  },
  handler: function* createTaskAfterSectionItem({ itemId, taskParams }) {
    const item = yield* taskSectionItemById({ id: itemId });
    if (!item) throw new Error("Item not found");

    const [, after] = yield* taskSectionItemSiblings({ itemId });
    const orderToken = generateJitteredKeyBetween(
      item.orderToken,
      after?.orderToken || null,
    );

    return yield* createTask({
      task: {
        ...taskParams,
        taskSectionId: item.taskSectionId,
        orderToken,
      },
    });
  },
});
