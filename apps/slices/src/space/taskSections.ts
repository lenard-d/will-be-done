import {
  deleteRows,
  insert,
  selectFrom,
  upsert,
  v,
} from "@will-be-done/hyperdb";
import { action, selector } from "../builders";
import {
  generateOrderTokenPositioned,
  normalizeOrderPosition,
  orderPositionArg,
} from "./utils";
import { registerModelSlice } from "./maps";
import { uuidv7 } from "uuidv7";
import { appById } from "./app";
import { deleteItemsByIds } from "./items";
import {
  firstTaskSectionItem,
  lastTaskSectionItem,
  taskSectionItemByIdOrDefault,
  taskSectionItemIds,
} from "./taskSectionItems";
import { projectById, projectByIdOrDefault } from "./projects";
import { createTask, taskById, updateTask } from "./tasks";
import { updateTemplate } from "./taskTemplates";
import { defaultProject } from "./projects";
import { noop } from "@will-be-done/hyperdb";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { genUUIDV5 } from "../traits";
import {
  taskSectionType,
  taskSectionsTable,
  TaskSection,
  tasksTable,
  Task,
  possibleModelType,
  Project,
  isTask,
  isTaskTemplate,
  isDailyEntry,
  taskTemplatesTable,
} from "./tables";

export const defaultTaskSection: TaskSection = {
  type: taskSectionType,
  id: "abeee7aa-8bf4-4a5f-9167-ce42ad6187b6",
  title: "",
  projectId: "",
  orderToken: "",
  createdAt: 0,
};

export const taskSectionById = selector({
  name: "taskSectionById",
  args: { id: v.string() },
  handler: function* taskSectionById({ id }) {
    const tasks = yield* selectFrom(taskSectionsTable, "byId")
      .where((q) => q.eq("id", id))
      .limit(1);

    return tasks[0] as TaskSection | undefined;
  },
});

export const taskSectionByIdOrDefault = selector({
  name: "taskSectionByIdOrDefault",
  args: { id: v.string() },
  handler: function* taskSectionByIdOrDefault({ id }) {
    return (yield* taskSectionById({ id })) || defaultTaskSection;
  },
});

export const allTaskSections = selector({
  name: "allTaskSections",
  args: {},
  handler: function* allTaskSections() {
    const tasks = yield* selectFrom(taskSectionsTable, "byProjectIdOrderToken");
    return tasks;
  },
});

export const inboxTaskSectionId = selector({
  name: "inboxTaskSectionId",
  args: {},
  handler: function* inboxTaskSectionId() {
    // Keep the historical UUID namespace stable so existing inbox sections
    // retain their identity after the ProjectCategory -> TaskSection rename.
    return yield* genUUIDV5("projectCategory", "inbox");
  },
});

export const taskSectionsByProjectIds = selector({
  name: "taskSectionsByProjectIds",
  args: { projectIds: v.array(v.string()) },
  handler: function* taskSectionsByProjectIds({ projectIds }) {
    const sections = yield* selectFrom(
      taskSectionsTable,
      "byProjectIdOrderToken",
    ).where((q) => projectIds.map((id) => q.eq("projectId", id)));
    return sections;
  },
});

export const taskSectionsByProjectId = selector({
  name: "taskSectionsByProjectId",
  args: { projectId: v.string() },
  handler: function* taskSectionsByProjectId({ projectId }) {
    return yield* taskSectionsByProjectIds({ projectIds: [projectId] });
  },
});

export const projectOfTaskSection = selector({
  name: "projectOfTaskSection",
  args: { taskSectionId: v.string() },
  handler: function* projectOfTaskSection({
    taskSectionId,
  }): Generator<unknown, Project | undefined, unknown> {
    const section = yield* taskSectionById({ id: taskSectionId });
    if (!section) return undefined;

    return yield* projectById({ id: section.projectId });
  },
});

export const projectOfTaskSectionOrDefault = selector({
  name: "projectOfTaskSectionOrDefault",
  args: { taskSectionId: v.string() },
  handler: function* projectOfTaskSectionOrDefault({
    taskSectionId,
  }): Generator<unknown, Project, unknown> {
    const section = yield* taskSectionById({ id: taskSectionId });
    if (!section) return defaultProject;

    return yield* projectByIdOrDefault({ id: section.projectId });
  },
});

export const firstTaskSectionChild = selector({
  name: "firstTaskSectionChild",
  args: { projectId: v.string() },
  handler: function* firstTaskSectionChild({ projectId }) {
    return (yield* taskSectionsByProjectId({ projectId }))[0] as
      | TaskSection
      | undefined;
  },
});

export const lastTaskSectionChild = selector({
  name: "lastTaskSectionChild",
  args: { projectId: v.string() },
  handler: function* lastTaskSectionChild({ projectId }) {
    const result = yield* taskSectionsByProjectId({ projectId });
    if (result.length === 0) return undefined as TaskSection | undefined;

    return result[result.length - 1] as TaskSection | undefined;
  },
});

export const updateTaskSection = action({
  name: "updateTaskSection",
  args: {
    taskSectionId: v.string(),
    section: v.partial(taskSectionsTable.v()),
  },
  handler: function* updateTaskSection({
    taskSectionId,
    section,
  }): Generator<unknown, void, unknown> {
    const sectionInState = yield* taskSectionById({ id: taskSectionId });
    if (!sectionInState) throw new Error("Section not found");

    yield* upsert(taskSectionsTable, [{ ...sectionInState, ...section }]);
  },
});

export const taskSectionSiblings = selector({
  name: "taskSectionSiblings",
  args: { taskSectionId: v.string() },
  handler: function* taskSectionSiblings({ taskSectionId }) {
    const item = yield* taskSectionById({ id: taskSectionId });
    if (!item)
      return [undefined, undefined] as [
        TaskSection | undefined,
        TaskSection | undefined,
      ];

    const sortedTaskSections = yield* selectFrom(
      taskSectionsTable,
      "byProjectIdOrderToken",
    ).where((q) => q.eq("projectId", item.projectId));

    const index = sortedTaskSections.findIndex((p) => p.id === taskSectionId);

    const beforeId = index > 0 ? sortedTaskSections[index - 1].id : undefined;
    const afterId =
      index < sortedTaskSections.length - 1
        ? sortedTaskSections[index + 1].id
        : undefined;

    const before = beforeId
      ? yield* taskSectionByIdOrDefault({ id: beforeId })
      : undefined;
    const after = afterId
      ? yield* taskSectionByIdOrDefault({ id: afterId })
      : undefined;

    return [before, after] as [
      TaskSection | undefined,
      TaskSection | undefined,
    ];
  },
});

export const moveLeft = action({
  name: "moveLeft",
  args: { taskSectionId: v.string() },
  handler: function* moveLeft({
    taskSectionId,
  }): Generator<unknown, void, unknown> {
    const [up] = yield* taskSectionSiblings({ taskSectionId });
    const [up2] = up
      ? yield* taskSectionSiblings({ taskSectionId: up?.id })
      : [undefined, undefined];

    if (!up) return;

    yield* updateTaskSection({
      taskSectionId,
      section: {
        orderToken: generateJitteredKeyBetween(
          up2?.orderToken || null,
          up.orderToken,
        ),
      },
    });
  },
});

export const moveRight = action({
  name: "moveRight",
  args: { taskSectionId: v.string() },
  handler: function* moveRight({
    taskSectionId,
  }): Generator<unknown, void, unknown> {
    const [_up, down] = yield* taskSectionSiblings({ taskSectionId });
    const [_up2, down2] = down
      ? yield* taskSectionSiblings({ taskSectionId: down?.id })
      : [undefined, undefined];

    if (!down) return;

    yield* updateTaskSection({
      taskSectionId,
      section: {
        orderToken: generateJitteredKeyBetween(
          down.orderToken,
          down2?.orderToken || null,
        ),
      },
    });
  },
});

export const createTaskSection = action({
  name: "createTaskSection",
  args: {
    sectionDraft: v.required(v.partial(taskSectionsTable.v()), [
      "title",
      "projectId",
    ]),
    position: orderPositionArg,
  },
  handler: function* createTaskSection({
    sectionDraft,
    position,
  }): Generator<unknown, TaskSection, unknown> {
    const orderToken = yield* generateOrderTokenPositioned(
      sectionDraft.projectId,
      {
        firstChild: (projectId) => firstTaskSectionChild({ projectId }),
        lastChild: (projectId) => lastTaskSectionChild({ projectId }),
      },
      normalizeOrderPosition(position),
    );

    const id = sectionDraft.id || uuidv7();

    const section: TaskSection = {
      type: taskSectionType,
      id,
      title: sectionDraft.title,
      projectId: sectionDraft.projectId,
      orderToken: orderToken,
      createdAt: Date.now(),
    };

    yield* insert(taskSectionsTable, [section]);

    return section;
  },
});

export const createTaskInSection = action({
  name: "createTaskInSection",
  args: {
    taskSectionId: v.string(),
    position: orderPositionArg,
    taskAttrs: v.optional(v.partial(tasksTable.v())),
  },
  handler: function* createTaskInSection({
    taskSectionId,
    position,
    taskAttrs,
  }): Generator<unknown, Task, unknown> {
    const orderToken = yield* generateOrderTokenPositioned(
      taskSectionId,
      {
        firstChild: (taskSectionId) => firstTaskSectionItem({ taskSectionId }),
        lastChild: (taskSectionId) => lastTaskSectionItem({ taskSectionId }),
      },
      normalizeOrderPosition(position),
    );

    return yield* createTask({
      task: {
        ...taskAttrs,
        orderToken: orderToken,
        taskSectionId: taskSectionId,
      },
    });
  },
});

export const deleteTaskSections = action({
  name: "deleteTaskSections",
  args: { ids: v.array(v.string()) },
  handler: function* deleteTaskSections({
    ids,
  }): Generator<unknown, void, unknown> {
    const idsToDelete: string[] = [];

    for (const taskSectionId of ids) {
      const templatesIds = (yield* selectFrom(
        taskTemplatesTable,
        "byTaskSectionIdOrderStates",
      ).where((q) => q.eq("taskSectionId", taskSectionId))).map((t) => t.id);

      const taskIds = (yield* selectFrom(
        tasksTable,
        "byTaskSectionIdOrderStates",
      ).where((q) =>
        q.eq("taskSectionId", taskSectionId).eq("state", "todo"),
      )).map((t) => t.id);

      const doneTaskIds = (yield* selectFrom(
        tasksTable,
        "byTaskSectionIdOrderStates",
      ).where((q) =>
        q.eq("taskSectionId", taskSectionId).eq("state", "done"),
      )).map((t) => t.id);

      idsToDelete.push(...templatesIds);
      idsToDelete.push(...taskIds);
      idsToDelete.push(...doneTaskIds);
    }

    if (idsToDelete.length > 0) {
      yield* deleteItemsByIds({ ids: idsToDelete });
    }

    yield* deleteRows(taskSectionsTable, ids);
  },
});

export const taskSectionHandleDrop = action({
  name: "taskSectionHandleDrop",
  args: {
    taskSectionId: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* taskSectionHandleDrop({
    taskSectionId,
    dropId,
    dropModelType,
    edge,
  }): Generator<unknown, void, unknown> {
    const dropItem = yield* appById({
      id: dropId,
      modelType: dropModelType,
    });
    if (!dropItem) return;

    const childrenIds = yield* taskSectionItemIds({
      taskSectionId: taskSectionId,
    });
    let orderToken: string;
    if (childrenIds.length === 0) {
      orderToken = generateJitteredKeyBetween(null, null);
    } else if (edge === "top") {
      const first = yield* taskSectionItemByIdOrDefault({
        id: childrenIds[0],
      });
      orderToken = generateJitteredKeyBetween(null, first.orderToken || null);
    } else {
      const last = yield* taskSectionItemByIdOrDefault({
        id: childrenIds[childrenIds.length - 1],
      });
      orderToken = generateJitteredKeyBetween(last.orderToken || null, null);
    }

    if (isTask(dropItem)) {
      yield* updateTask({
        id: dropItem.id,
        task: {
          taskSectionId: taskSectionId,
          orderToken,
        },
      });
    } else if (isTaskTemplate(dropItem)) {
      yield* updateTemplate({
        id: dropItem.id,
        template: {
          taskSectionId: taskSectionId,
          orderToken,
        },
      });
    } else if (isDailyEntry(dropItem)) {
      // When dropping a entry onto a section, move the underlying task
      const task = yield* taskById({ id: dropItem.id });
      if (task) {
        yield* updateTask({
          id: task.id,
          task: {
            taskSectionId: taskSectionId,
            orderToken,
          },
        });
        // Keep the entry in the daily list
      }
    }
  },
});

export const taskSectionCanDrop = selector({
  name: "taskSectionCanDrop",
  args: {
    _taskSectionId: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
  },
  handler: function* taskSectionCanDrop({
    _taskSectionId,
    dropId,
    dropModelType,
  }): Generator<unknown, boolean, unknown> {
    yield* noop();

    const dropItem = yield* appById({
      id: dropId,
      modelType: dropModelType,
    });
    if (!dropItem) return false;

    if (isTask(dropItem) || isTaskTemplate(dropItem)) {
      return true;
    }

    if (isDailyEntry(dropItem)) {
      const task = yield* taskById({ id: dropItem.id });
      return task !== undefined && task.state === "todo";
    }

    return false;
  },
});

const taskSectionsSlice = {
  byId: taskSectionById,
  delete: deleteTaskSections,
  handleDrop: taskSectionHandleDrop,
  canDrop: taskSectionCanDrop,
};

registerModelSlice(taskSectionsSlice, taskSectionsTable, taskSectionType);
