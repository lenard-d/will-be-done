import { isObjectType } from "../utils";
import { shouldNeverHappen } from "../utils";
import {
  action,
  deleteRows,
  type ExtractSchema,
  insert,
  selectFrom,
  selector,
  upsert,
  v,
} from "@will-be-done/hyperdb-lib";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { uuidv7 } from "uuidv7";
import type { OrderableItem } from "./utils";
import { generateOrderTokenPositioned } from "./utils";
import { appById } from "./app";
import {
  createCategory,
  deleteCategories,
  firstProjectCategoryChild,
  inboxCategoryId,
  projectCategoriesByProjectId,
  projectCategoriesByProjectIds,
  createProjectCategoryTask,
} from "./projectsCategories";
import { projectCategoryCardIds } from "./projectsCategoriesCards";
import {
  firstProjectChild,
  lastProjectChild,
  projectSiblings,
} from "./projectsAll";
import { dailyListAllTaskIds, dailyListsByIds } from "./dailyLists";
import { dailyProjectionByTaskId } from "./dailyListsProjections";
import { stashProjectionAllTaskIds } from "./stashProjections";
import { taskById, updateTask, type Task, isTask } from "./cardsTasks";
import { updateTemplate, isTaskTemplate } from "./cardsTaskTemplates";
import { registerSpaceSyncableTable } from "./syncMap";
import { registerModelSlice, AnyModelType } from "./maps";
import { isTaskProjection } from "./dailyListsProjections";
import { genUUIDV5 } from "../traits";
import { startOfDay } from "date-fns";
import { projectType, projectsTable } from "./tables";

export { projectType, projectsTable };

export type Project = ExtractSchema<typeof projectsTable>;

export const isProject = isObjectType<Project>(projectType);

export const defaultProject: Project = {
  type: projectType,
  id: "default-project-id",
  title: "default project",
  icon: "",
  isInbox: false,
  orderToken: "",
  createdAt: 0,
};

registerSpaceSyncableTable(projectsTable, projectType);

const projectValidator = projectsTable.v();
if (projectValidator.kind !== "object") {
  throw new Error("projectsTable validator must be an object validator");
}

const taskValidator = v.object({
  type: v.literal("task"),
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
});

const projectPatchValidator = v.partial(projectValidator);
const taskPatchValidator = v.partial(taskValidator);

const orderPositionArg = v.union(
  v.literal("append"),
  v.literal("prepend"),
  v.array(v.union(v.object({ orderToken: v.string() }), v.null())),
);

type OrderPositionArg = "append" | "prepend" | (OrderableItem | null)[];

const normalizeOrderPosition = (
  position: OrderPositionArg,
):
  | "append"
  | "prepend"
  | [OrderableItem | undefined, OrderableItem | undefined] => {
  if (position === "append" || position === "prepend") return position;
  return [position[0] ?? undefined, position[1] ?? undefined];
};

// Selectors and actions
export const projectAllIds = selector({
  name: "projectAllIds",
  args: {},
  handler: function* projectAllIds() {
    const projects = yield* selectFrom(projectsTable, "byOrderToken").where(
      (q) => q,
    );

    return projects.map((p) => p.id);
  },
});

export const projectById = selector({
  name: "projectById",
  args: { id: v.string() },
  handler: function* projectById({ id }: { id: string }) {
    const projects = yield* selectFrom(projectsTable, "byId")
      .where((q) => q.eq("id", id))
      .limit(1);
    return projects[0] as Project | undefined;
  },
});

export const projectByIdOrDefault = selector({
  name: "projectByIdOrDefault",
  args: { id: v.string() },
  handler: function* projectByIdOrDefault({ id }: { id: string }) {
    return (yield* projectById({ id })) || defaultProject;
  },
});

export const projectCanDrop = selector({
  name: "projectCanDrop",
  args: {
    projectId: v.string(),
    dropItemId: v.string(),
    dropModelType: v.union(
      v.literal("task"),
      v.literal("template"),
      v.literal("project"),
      v.literal("dailyList"),
      v.literal("projectCategory"),
      v.literal("projection"),
      v.literal("stashProjection"),
      v.literal("checklistItem"),
      v.literal("stash"),
    ),
  },
  handler: function* projectCanDrop({
    projectId,
    dropItemId,
    dropModelType,
  }: {
    projectId: string;
    dropItemId: string;
    dropModelType: AnyModelType;
  }): Generator<unknown, boolean, unknown> {
    const project = yield* projectById({ id: projectId });
    if (!project) return false;

    const dropItem = yield* appById({
      id: dropItemId,
      modelType: dropModelType,
    });
    if (!dropItem) return false;

    // Projects can accept tasks, templates, projections, and other projects
    if (isProject(dropItem) || isTask(dropItem) || isTaskTemplate(dropItem)) {
      return true;
    }

    if (isTaskProjection(dropItem)) {
      const task = yield* taskById({ id: dropItem.id });
      return task !== undefined && task.state === "todo";
    }

    return false;
  },
});

export const inboxProjectId = selector({
  name: "inboxProjectId",
  args: {},
  handler: function* inboxProjectId() {
    return yield* genUUIDV5(projectType, "inbox");
  },
});

export const overdueTasksCountExceptDailiesCount = selector({
  name: "overdueTasksCountExceptDailiesCount",
  args: {
    projectId: v.string(),
    exceptDailyListIds: v.array(v.string()),
    currentDate: v.number(),
  },
  handler: function* overdueTasksCountExceptDailiesCount({
    projectId,
    exceptDailyListIds,
    currentDate,
  }: {
    projectId: string;
    exceptDailyListIds: string[];
    currentDate: number;
  }): Generator<unknown, number, unknown> {
    const currentDay = startOfDay(new Date(currentDate));

    const categories = yield* projectCategoriesByProjectId({ projectId });

    const taskIds = yield* dailyListAllTaskIds({
      dailyListIds: exceptDailyListIds,
    });
    const exceptCardIds: Set<string> = new Set(taskIds);
    const exceptDailyListSet = new Set(exceptDailyListIds);

    // First pass: collect all unique dailyListIds that we need to check
    const dailyListIdsToFetch = new Set<string>();
    for (const category of categories) {
      const childrenIds = yield* projectCategoryCardIds({
        projectCategoryId: category.id,
      });

      for (const taskId of childrenIds) {
        if (exceptCardIds.has(taskId)) continue;

        const projection = yield* dailyProjectionByTaskId({ taskId });
        if (!projection) continue;
        if (exceptDailyListSet.has(projection.dailyListId)) continue;

        dailyListIdsToFetch.add(projection.dailyListId);
      }
    }

    // Batch fetch all daily lists at once
    const dailyLists = yield* dailyListsByIds({
      ids: Array.from(dailyListIdsToFetch),
    });
    const dailyListMap = new Map(dailyLists.map((dl) => [dl.id, dl]));

    // Second pass: count overdue tasks
    let overdueCount = 0;
    for (const category of categories) {
      const childrenIds = yield* projectCategoryCardIds({
        projectCategoryId: category.id,
      });

      for (const taskId of childrenIds) {
        if (exceptCardIds.has(taskId)) continue;

        const projection = yield* dailyProjectionByTaskId({ taskId });
        if (!projection) continue;
        if (exceptDailyListSet.has(projection.dailyListId)) continue;

        const dailyList = dailyListMap.get(projection.dailyListId);
        if (!dailyList) continue;

        // Parse the date and check if it's before currentDate
        const listDate = new Date(dailyList.date);
        if (listDate < currentDay) {
          overdueCount++;
        }
      }
    }

    return overdueCount;
  },
});

export const notDoneTasksCountExceptDailiesCount = selector({
  name: "notDoneTasksCountExceptDailiesCount",
  args: {
    projectId: v.string(),
    exceptDailyListIds: v.array(v.string()),
  },
  handler: function* notDoneTasksCountExceptDailiesCount({
    projectId,
    exceptDailyListIds,
  }: {
    projectId: string;
    exceptDailyListIds: string[];
  }): Generator<unknown, number, unknown> {
    const categories = yield* projectCategoriesByProjectId({ projectId });

    const taskIds = yield* dailyListAllTaskIds({
      dailyListIds: exceptDailyListIds,
    });
    const exceptCardIds: Set<string> = new Set(taskIds);

    const finalChildrenIds: string[] = [];
    for (const category of categories) {
      const childrenIds = yield* projectCategoryCardIds({
        projectCategoryId: category.id,
      });

      finalChildrenIds.push(...childrenIds);
    }

    return finalChildrenIds.filter((id) => !exceptCardIds.has(id)).length;
  },
});

export const overdueTasksCountExceptDailiesAndStashCount = selector({
  name: "overdueTasksCountExceptDailiesAndStashCount",
  args: {
    projectId: v.string(),
    exceptDailyListIds: v.array(v.string()),
    currentDate: v.number(),
  },
  handler: function* overdueTasksCountExceptDailiesAndStashCount({
    projectId,
    exceptDailyListIds,
    currentDate,
  }: {
    projectId: string;
    exceptDailyListIds: string[];
    currentDate: number;
  }): Generator<unknown, number, unknown> {
    const currentDay = startOfDay(new Date(currentDate));

    const categories = yield* projectCategoriesByProjectId({ projectId });

    const taskIds = yield* dailyListAllTaskIds({
      dailyListIds: exceptDailyListIds,
    });
    const stashTaskIds = yield* stashProjectionAllTaskIds({});
    const exceptCardIds: Set<string> = new Set([...taskIds, ...stashTaskIds]);
    const exceptDailyListSet = new Set(exceptDailyListIds);

    const dailyListIdsToFetch = new Set<string>();
    for (const category of categories) {
      const childrenIds = yield* projectCategoryCardIds({
        projectCategoryId: category.id,
      });

      for (const taskId of childrenIds) {
        if (exceptCardIds.has(taskId)) continue;

        const projection = yield* dailyProjectionByTaskId({ taskId });
        if (!projection) continue;
        if (exceptDailyListSet.has(projection.dailyListId)) continue;

        dailyListIdsToFetch.add(projection.dailyListId);
      }
    }

    const dailyLists = yield* dailyListsByIds({
      ids: Array.from(dailyListIdsToFetch),
    });
    const dailyListMap = new Map(dailyLists.map((dl) => [dl.id, dl]));

    let overdueCount = 0;
    for (const category of categories) {
      const childrenIds = yield* projectCategoryCardIds({
        projectCategoryId: category.id,
      });

      for (const taskId of childrenIds) {
        if (exceptCardIds.has(taskId)) continue;

        const projection = yield* dailyProjectionByTaskId({ taskId });
        if (!projection) continue;
        if (exceptDailyListSet.has(projection.dailyListId)) continue;

        const dailyList = dailyListMap.get(projection.dailyListId);
        if (!dailyList) continue;

        const listDate = new Date(dailyList.date);
        if (listDate < currentDay) {
          overdueCount++;
        }
      }
    }

    return overdueCount;
  },
});

export const notDoneTasksCountExceptDailiesAndStashCount = selector({
  name: "notDoneTasksCountExceptDailiesAndStashCount",
  args: {
    projectId: v.string(),
    exceptDailyListIds: v.array(v.string()),
  },
  handler: function* notDoneTasksCountExceptDailiesAndStashCount({
    projectId,
    exceptDailyListIds,
  }: {
    projectId: string;
    exceptDailyListIds: string[];
  }): Generator<unknown, number, unknown> {
    const categories = yield* projectCategoriesByProjectId({ projectId });

    const taskIds = yield* dailyListAllTaskIds({
      dailyListIds: exceptDailyListIds,
    });
    const stashTaskIds = yield* stashProjectionAllTaskIds({});
    const exceptCardIds: Set<string> = new Set([...taskIds, ...stashTaskIds]);

    const finalChildrenIds: string[] = [];
    for (const category of categories) {
      const childrenIds = yield* projectCategoryCardIds({
        projectCategoryId: category.id,
      });

      finalChildrenIds.push(...childrenIds);
    }

    return finalChildrenIds.filter((id) => !exceptCardIds.has(id)).length;
  },
});

export const createProject = action({
  name: "createProject",
  args: {
    project: projectPatchValidator,
    position: orderPositionArg,
  },
  handler: function* createProject({
    project,
    position,
  }: {
    project: Partial<Project>;
    position: OrderPositionArg;
  }): Generator<unknown, Project, unknown> {
    const orderToken = yield* generateOrderTokenPositioned(
      "all-projects-list",
      { firstChild: firstProjectChild, lastChild: lastProjectChild },
      normalizeOrderPosition(position),
    );

    const id = project.id || uuidv7();
    const newProject: Project = {
      type: projectType,
      id,
      title: "New project",
      icon: "",
      isInbox: false,
      createdAt: Date.now(),
      orderToken: orderToken,
      ...project,
    };

    const isInbox = newProject.isInbox;

    yield* insert(projectsTable, [newProject]);
    if (isInbox) {
      yield* createCategory({
        categoryDraft: {
          projectId: newProject.id,
          title: "Inbox",
          id: yield* inboxCategoryId({}),
        },
        position: "append",
      });
    } else {
      yield* createCategory({
        categoryDraft: { projectId: newProject.id, title: "Week" },
        position: "append",
      });
      yield* createCategory({
        categoryDraft: { projectId: newProject.id, title: "Month" },
        position: "append",
      });
      yield* createCategory({
        categoryDraft: { projectId: newProject.id, title: "Ideas" },
        position: "append",
      });
    }

    return newProject;
  },
});

export const createInboxIfNotExists = action({
  name: "createInboxIfNotExists",
  args: {},
  handler: function* createInboxIfNotExists(): Generator<
    unknown,
    Project,
    unknown
  > {
    const inbox = yield* projectById({ id: yield* inboxProjectId({}) });
    if (inbox) {
      return inbox;
    }

    return yield* createProject({
      project: {
        id: yield* inboxProjectId({}),
        title: "Inbox",
        icon: "",
        isInbox: true,
        orderToken: generateJitteredKeyBetween(null, null),
        createdAt: new Date().getTime(),
      },
      position: [null, null],
    });
  },
});

export const updateProject = action({
  name: "updateProject",
  args: {
    id: v.string(),
    project: projectPatchValidator,
  },
  handler: function* updateProject({
    id,
    project,
  }: {
    id: string;
    project: Partial<Project>;
  }): Generator<unknown, void, unknown> {
    const projectInState = yield* projectById({ id });
    if (!projectInState) throw new Error("Project not found");

    yield* upsert(projectsTable, [{ ...projectInState, ...project }]);
  },
});

export const deleteProjects = action({
  name: "deleteProjects",
  args: { ids: v.array(v.string()) },
  handler: function* deleteProjects({
    ids,
  }: {
    ids: string[];
  }): Generator<unknown, void, unknown> {
    const projectCategories = yield* projectCategoriesByProjectIds({
      projectIds: ids,
    });

    yield* deleteCategories({ ids: projectCategories.map((c) => c.id) });
    yield* deleteRows(projectsTable, ids);
  },
});

export const projectHandleDrop = action({
  name: "projectHandleDrop",
  args: {
    projectId: v.string(),
    dropItemId: v.string(),
    dropModelType: v.union(
      v.literal("task"),
      v.literal("template"),
      v.literal("project"),
      v.literal("dailyList"),
      v.literal("projectCategory"),
      v.literal("projection"),
      v.literal("stashProjection"),
      v.literal("checklistItem"),
      v.literal("stash"),
    ),
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* projectHandleDrop({
    projectId,
    dropItemId,
    dropModelType,
    edge,
  }: {
    projectId: string;
    dropItemId: string;
    dropModelType: AnyModelType;
    edge: "top" | "bottom";
  }): Generator<unknown, void, unknown> {
    const canDropResult = yield* projectCanDrop({
      projectId,
      dropItemId,
      dropModelType,
    });
    if (!canDropResult) return;

    const project = yield* projectById({ id: projectId });
    if (!project) throw new Error("Project not found");

    const dropItem = yield* appById({
      id: dropItemId,
      modelType: dropModelType,
    });
    if (!dropItem) throw new Error("Target not found");

    if (isProject(dropItem)) {
      // Reorder projects - would need proper fractional indexing
      const [up, down] = yield* projectSiblings({ projectId: project.id });

      let orderToken: string;
      if (edge === "top") {
        orderToken = generateJitteredKeyBetween(
          up?.orderToken || null,
          project.orderToken,
        );
      } else {
        orderToken = generateJitteredKeyBetween(
          project.orderToken,
          down?.orderToken || null,
        );
      }

      yield* updateProject({
        id: dropItem.id,
        project: { orderToken },
      });
    } else if (
      isTask(dropItem) ||
      isTaskTemplate(dropItem) ||
      isTaskProjection(dropItem)
    ) {
      const category = yield* firstProjectCategoryChild({
        projectId: project.id,
      });
      if (!category) throw new Error("No categories found in project");

      // Move task/template to this project
      if (isTask(dropItem)) {
        yield* updateTask({
          id: dropItem.id,
          task: {
            projectCategoryId: category.id,
          },
        });
      } else if (isTaskTemplate(dropItem)) {
        yield* updateTemplate({
          id: dropItem.id,
          template: {
            projectCategoryId: category.id,
          },
        });
      } else if (isTaskProjection(dropItem)) {
        // When dropping a projection onto a project, move the underlying task
        const task = yield* taskById({ id: dropItem.id });
        if (task) {
          yield* updateTask({
            id: task.id,
            task: {
              projectCategoryId: category.id,
            },
          });
          // Keep the projection in the daily list
        }
      }
    } else {
      shouldNeverHappen("unknown drop item type", dropItem);
    }
  },
});

export const createProjectTask = action({
  name: "createProjectTask",
  args: {
    projectId: v.string(),
    position: orderPositionArg,
    taskAttrs: v.optional(taskPatchValidator),
  },
  handler: function* createProjectTask({
    projectId,
    position,
    taskAttrs,
  }: {
    projectId: string;
    position: OrderPositionArg;
    taskAttrs?: Partial<Task>;
  }): Generator<unknown, Task, unknown> {
    const project = yield* projectById({ id: projectId });
    if (!project) throw new Error("Project not found");

    let projectCategoryId = taskAttrs?.projectCategoryId;
    if (!projectCategoryId) {
      const firstCategory = yield* firstProjectCategoryChild({ projectId });
      if (!firstCategory) throw new Error("No categories found");
      projectCategoryId = firstCategory.id;
    }

    return yield* createProjectCategoryTask({
      categoryId: projectCategoryId,
      position,
      taskAttrs,
    });
  },
});

export const createProjectTaskIfNotExists = action({
  name: "createProjectTaskIfNotExists",
  args: {
    projectId: v.string(),
    taskId: v.string(),
    position: orderPositionArg,
    taskAttrs: v.optional(taskPatchValidator),
  },
  handler: function* createProjectTaskIfNotExists({
    projectId,
    taskId,
    position,
    taskAttrs,
  }: {
    projectId: string;
    taskId: string;
    position: OrderPositionArg;
    taskAttrs?: Partial<Task>;
  }): Generator<unknown, Task, unknown> {
    const task = yield* taskById({ id: taskId });
    if (task) {
      return task;
    }

    return yield* createProjectTask({
      projectId,
      position,
      taskAttrs: {
        ...taskAttrs,
        id: taskId,
      },
    });
  },
});

// Local slice object for registerModelSlice (not exported)
const projectsSlice = {
  projectAllIds,
  byId: projectById,
  projectByIdOrDefault,
  canDrop: projectCanDrop,
  inboxProjectId,
  overdueTasksCountExceptDailiesCount,
  notDoneTasksCountExceptDailiesCount,
  overdueTasksCountExceptDailiesAndStashCount,
  notDoneTasksCountExceptDailiesAndStashCount,
  createInboxIfNotExists,
  createProject,
  update: updateProject,
  delete: deleteProjects,
  handleDrop: projectHandleDrop,
  createProjectTask,
  createProjectTaskIfNotExists,
};
registerModelSlice(projectsSlice, projectsTable, projectType);
