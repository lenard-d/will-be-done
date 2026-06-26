import { shouldNeverHappen } from "../utils";
import {
  deleteRows,
  insert,
  selectFrom,
  upsert,
  v,
} from "@will-be-done/hyperdb";
import { action, selector } from "../builders";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { uuidv7 } from "uuidv7";
import {
  generateOrderTokenPositioned,
  normalizeOrderPosition,
  orderPositionArg,
} from "./utils";
import { appById } from "./app";
import {
  createCategory,
  deleteCategories,
  firstProjectCategoryChild,
  inboxCategoryId,
  projectCategoryById,
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
import { taskById, updateTask } from "./cardsTasks";
import { updateTemplate } from "./cardsTaskTemplates";
import { registerModelSlice } from "./maps";
import { genUUIDV5 } from "../traits";
import { startOfDay } from "date-fns";
import {
  projectType,
  projectsTable,
  tasksTable,
  possibleModelType,
  type Task,
  Project,
  isProject,
  isTaskProjection,
  isTask,
  isTaskTemplate,
} from "./tables";

export const defaultProject: Project = {
  type: projectType,
  id: "default-project-id",
  title: "default project",
  icon: "",
  isInbox: false,
  orderToken: "",
  createdAt: 0,
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
  handler: function* projectById({ id }) {
    const projects = yield* selectFrom(projectsTable, "byId")
      .where((q) => q.eq("id", id))
      .limit(1);
    return projects[0] as Project | undefined;
  },
});

export const projectByIdOrDefault = selector({
  name: "projectByIdOrDefault",
  args: { id: v.string() },
  handler: function* projectByIdOrDefault({ id }) {
    return (yield* projectById({ id })) || defaultProject;
  },
});

export const projectCanDrop = selector({
  name: "projectCanDrop",
  args: {
    projectId: v.string(),
    dropItemId: v.string(),
    dropModelType: possibleModelType,
  },
  handler: function* projectCanDrop({
    projectId,
    dropItemId,
    dropModelType,
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
    project: v.partial(projectsTable.v()),
    position: orderPositionArg,
  },
  handler: function* createProject({
    project,
    position,
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
    project: v.partial(projectsTable.v()),
  },
  handler: function* updateProject({
    id,
    project,
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
    dropModelType: possibleModelType,
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* projectHandleDrop({
    projectId,
    dropItemId,
    dropModelType,
    edge,
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
    taskAttrs: v.optional(v.partial(tasksTable.v())),
  },
  handler: function* createProjectTask({
    projectId,
    position,
    taskAttrs,
  }): Generator<unknown, Task, unknown> {
    const project = yield* projectById({ id: projectId });
    if (!project) throw new Error("Project not found");

    let projectCategoryId = taskAttrs?.projectCategoryId;
    if (projectCategoryId) {
      const category = yield* projectCategoryById({ id: projectCategoryId });
      if (!category || category.projectId !== projectId) {
        throw new Error("Project category does not belong to project");
      }
    } else {
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
    taskAttrs: v.optional(v.partial(tasksTable.v())),
  },
  handler: function* createProjectTaskIfNotExists({
    projectId,
    taskId,
    position,
    taskAttrs,
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
  byId: projectById,
  delete: deleteProjects,
  canDrop: projectCanDrop,
  handleDrop: projectHandleDrop,
};
registerModelSlice(projectsSlice, projectsTable, projectType);
