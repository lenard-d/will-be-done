import { describe, expect, it } from "vitest";
import {
  DB,
  SubscribableDB,
  execSync,
  runSelector,
  syncDispatch,
} from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { dbIdTrait } from "../traits";
import { appCanDrop, appHandleDrop } from "./app";
import { addToDailyList } from "./dailyListsProjections";
import { addToStash, stashProjectionById } from "./stashProjections";
import { createDailyList } from "./dailyLists";
import {
  createProject as createProjectAction,
  notDoneTasksCountExceptDailiesAndStashCount,
  notDoneTasksCountExceptDailiesCount,
  overdueTasksCountExceptDailiesAndStashCount,
  overdueTasksCountExceptDailiesCount,
} from "./projects";
import {
  installProjectTaskStatsHooks,
  migrateProjectCategoryTaskStats,
  migrateScheduledTodoTasks,
  projectTasksCount,
  projectsWithTaskStats,
  rebuildProjectCategoryTaskStats,
  rebuildScheduledTodoTasks,
} from "./taskStats";
import {
  createCategory,
  createProjectCategoryTask,
  projectCategoriesByProjectId,
} from "./projectsCategories";
import { projectCategoryCardIds } from "./projectsCategoriesCards";
import { taskById, updateTask } from "./cardsTasks";
import {
  DailyList,
  dailyListsTable,
  Project,
  projectCategoriesTable,
  projectCategoryTaskStatsTable,
  ProjectCategory,
  projectsTable,
  scheduledTodoTasksTable,
  spaceMigrationsTable,
  stashProjectionType,
  stashProjectionsTable,
  Task,
  taskProjectionsTable,
  tasksTable,
  taskTemplatesTable,
} from "./tables";

function createDB() {
  const driver = new BptreeInmemDriver();
  const spaceId = "a0000000-0000-4000-8000-000000000001";
  const db = new DB(driver, { traits: [dbIdTrait("space", spaceId)] });

  execSync(
    db.loadTables([
      dailyListsTable,
      projectCategoriesTable,
      projectCategoryTaskStatsTable,
      projectsTable,
      scheduledTodoTasksTable,
      spaceMigrationsTable,
      stashProjectionsTable,
      taskProjectionsTable,
      taskTemplatesTable,
      tasksTable,
    ]),
  );

  return db;
}

function createDBWithTaskStatsHooks() {
  const db = new SubscribableDB(createDB());
  installProjectTaskStatsHooks(db);

  return db;
}

function createProject(
  db: DB | SubscribableDB,
  attrs: { id?: string; title?: string } = {},
) {
  const project = syncDispatch(
    db,
    createProjectAction({
      project: {
        id: attrs.id ?? "project-1",
        title: attrs.title ?? "Project",
      },
      position: "append",
    }),
  ) as Project;

  const category = runSelector<ProjectCategory>(
    db,
    function* () {
      return (yield* projectCategoriesByProjectId({
        projectId: project.id,
      }))[0];
    },
    [],
  );

  return { project, category };
}

function createTask(db: DB | SubscribableDB, categoryId: string, id: string) {
  return syncDispatch(
    db,
    createProjectCategoryTask({
      categoryId,
      position: "append",
      taskAttrs: { id },
    }),
  ) as Task;
}

describe("project task stats cache", () => {
  it("updates cached project counts from task changes", () => {
    const db = createDBWithTaskStatsHooks();
    const { project, category } = createProject(db);

    const task = createTask(db, category.id, "cached-task");

    const insertedCount = runSelector<number>(
      db,
      function* () {
        return yield* projectTasksCount({ projectId: project.id });
      },
      [],
    );
    expect(insertedCount).toBe(1);

    syncDispatch(db, updateTask({ id: task.id, task: { state: "done" } }));

    const completedCount = runSelector<number>(
      db,
      function* () {
        return yield* projectTasksCount({ projectId: project.id });
      },
      [],
    );
    expect(completedCount).toBe(0);
  });

  it("rebuilds cached project counts from existing tasks", () => {
    const db = createDB();
    const { project, category } = createProject(db);

    createTask(db, category.id, "existing-task");
    const completedTask = createTask(
      db,
      category.id,
      "completed-existing-task",
    );
    syncDispatch(
      db,
      updateTask({ id: completedTask.id, task: { state: "done" } }),
    );

    syncDispatch(db, rebuildProjectCategoryTaskStats({}));

    const count = runSelector<number>(
      db,
      function* () {
        return yield* projectTasksCount({ projectId: project.id });
      },
      [],
    );
    expect(count).toBe(1);
  });

  it("migrates cached project counts once from existing tasks", () => {
    const db = createDB();
    const { project, category } = createProject(db);

    createTask(db, category.id, "migration-existing-task");
    const completedTask = createTask(
      db,
      category.id,
      "migration-completed-existing-task",
    );
    syncDispatch(
      db,
      updateTask({ id: completedTask.id, task: { state: "done" } }),
    );

    syncDispatch(db, migrateProjectCategoryTaskStats({}));

    const migratedCount = runSelector<number>(
      db,
      function* () {
        return yield* projectTasksCount({ projectId: project.id });
      },
      [],
    );
    expect(migratedCount).toBe(1);

    createTask(db, category.id, "post-migration-task-without-hook");
    syncDispatch(db, migrateProjectCategoryTaskStats({}));

    const countAfterSecondMigration = runSelector<number>(
      db,
      function* () {
        return yield* projectTasksCount({ projectId: project.id });
      },
      [],
    );
    expect(countAfterSecondMigration).toBe(1);
  });

  it("returns all projects with cached task counts in one selector", () => {
    const db = createDBWithTaskStatsHooks();
    const { project, category } = createProject(db);

    createTask(db, category.id, "batched-visible-task");
    const completedTask = createTask(db, category.id, "batched-completed-task");
    syncDispatch(
      db,
      updateTask({ id: completedTask.id, task: { state: "done" } }),
    );

    const projects = runSelector(
      db,
      function* () {
        return yield* projectsWithTaskStats({
          currentDate: new Date(2026, 3, 19).getTime(),
        });
      },
      [],
    );
    const projectWithStats = projects.find(
      (entry) => entry.project.id === project.id,
    );

    expect(projectWithStats?.notDoneCount).toBe(1);
  });

  it("returns overdue project counts in the bulk stats selector", () => {
    const db = createDBWithTaskStatsHooks();
    const { project, category } = createProject(db);

    const overdueTask = createTask(db, category.id, "bulk-overdue-task");
    const todayTask = createTask(db, category.id, "bulk-today-task");
    const completedOverdueTask = createTask(
      db,
      category.id,
      "bulk-completed-overdue-task",
    );
    syncDispatch(
      db,
      updateTask({ id: completedOverdueTask.id, task: { state: "done" } }),
    );

    const overdueList = syncDispatch(
      db,
      createDailyList({ dailyList: { date: "2026-04-18" } }),
    ) as DailyList;
    const todayList = syncDispatch(
      db,
      createDailyList({ dailyList: { date: "2026-04-19" } }),
    ) as DailyList;

    for (const [taskId, dailyListId] of [
      [overdueTask.id, overdueList.id],
      [completedOverdueTask.id, overdueList.id],
      [todayTask.id, todayList.id],
    ]) {
      syncDispatch(
        db,
        addToDailyList({
          taskId,
          dailyListId,
          position: "append",
        }),
      );
    }

    const projects = runSelector(
      db,
      function* () {
        return yield* projectsWithTaskStats({
          currentDate: new Date(2026, 3, 19).getTime(),
        });
      },
      [],
    );
    const projectWithStats = projects.find(
      (entry) => entry.project.id === project.id,
    );

    expect(projectWithStats?.notDoneCount).toBe(2);
    expect(projectWithStats?.overdueCount).toBe(1);

    syncDispatch(
      db,
      updateTask({ id: overdueTask.id, task: { state: "done" } }),
    );

    const projectsAfterDone = runSelector(
      db,
      function* () {
        return yield* projectsWithTaskStats({
          currentDate: new Date(2026, 3, 19).getTime(),
        });
      },
      [],
    );
    const projectWithStatsAfterDone = projectsAfterDone.find(
      (entry) => entry.project.id === project.id,
    );

    expect(projectWithStatsAfterDone?.notDoneCount).toBe(1);
    expect(projectWithStatsAfterDone?.overdueCount).toBe(0);
  });

  it("rebuilds scheduled todo cache from existing projections", () => {
    const db = createDB();
    const { project, category } = createProject(db);

    const overdueTask = createTask(db, category.id, "rebuild-overdue-task");
    const doneOverdueTask = createTask(
      db,
      category.id,
      "rebuild-done-overdue-task",
    );
    syncDispatch(
      db,
      updateTask({ id: doneOverdueTask.id, task: { state: "done" } }),
    );

    const overdueList = syncDispatch(
      db,
      createDailyList({ dailyList: { date: "2026-04-18" } }),
    ) as DailyList;

    for (const taskId of [overdueTask.id, doneOverdueTask.id]) {
      syncDispatch(
        db,
        addToDailyList({
          taskId,
          dailyListId: overdueList.id,
          position: "append",
        }),
      );
    }

    syncDispatch(db, rebuildScheduledTodoTasks({}));

    const projects = runSelector(
      db,
      function* () {
        return yield* projectsWithTaskStats({
          currentDate: new Date(2026, 3, 19).getTime(),
        });
      },
      [],
    );
    const projectWithStats = projects.find(
      (entry) => entry.project.id === project.id,
    );

    expect(projectWithStats?.overdueCount).toBe(1);
  });

  it("migrates scheduled todo cache once from existing projections", () => {
    const db = createDB();
    const { project, category } = createProject(db);

    const overdueTask = createTask(db, category.id, "migration-overdue-task");
    const overdueList = syncDispatch(
      db,
      createDailyList({ dailyList: { date: "2026-04-18" } }),
    ) as DailyList;
    syncDispatch(
      db,
      addToDailyList({
        taskId: overdueTask.id,
        dailyListId: overdueList.id,
        position: "append",
      }),
    );

    syncDispatch(db, migrateScheduledTodoTasks({}));

    const migratedProjects = runSelector(
      db,
      function* () {
        return yield* projectsWithTaskStats({
          currentDate: new Date(2026, 3, 19).getTime(),
        });
      },
      [],
    );
    const migratedProjectWithStats = migratedProjects.find(
      (entry) => entry.project.id === project.id,
    );

    expect(migratedProjectWithStats?.overdueCount).toBe(1);

    const laterTask = createTask(
      db,
      category.id,
      "post-migration-overdue-task",
    );
    syncDispatch(
      db,
      addToDailyList({
        taskId: laterTask.id,
        dailyListId: overdueList.id,
        position: "append",
      }),
    );
    syncDispatch(db, migrateScheduledTodoTasks({}));

    const projectsAfterSecondMigration = runSelector(
      db,
      function* () {
        return yield* projectsWithTaskStats({
          currentDate: new Date(2026, 3, 19).getTime(),
        });
      },
      [],
    );
    const projectAfterSecondMigration = projectsAfterSecondMigration.find(
      (entry) => entry.project.id === project.id,
    );

    expect(projectAfterSecondMigration?.overdueCount).toBe(1);
  });
});

describe("moving stashed tasks through app drops", () => {
  it("treats a stash projection dropped on a project task as its task and removes it from stash", () => {
    const db = createDB();
    const { category } = createProject(db);
    const targetTask = createTask(db, category.id, "target-task");
    const stashedTask = createTask(db, category.id, "stashed-drop-on-task");

    syncDispatch(
      db,
      addToStash({
        taskId: stashedTask.id,
        position: "append",
      }),
    );

    const canDrop = runSelector<boolean>(
      db,
      function* () {
        return yield* appCanDrop({
          id: targetTask.id,
          modelType: targetTask.type,
          dropId: stashedTask.id,
          dropModelType: stashProjectionType,
        });
      },
      [],
    );
    expect(canDrop).toBe(true);

    syncDispatch(
      db,
      appHandleDrop({
        id: targetTask.id,
        modelType: targetTask.type,
        dropId: stashedTask.id,
        dropModelType: stashProjectionType,
        edge: "top",
      }),
    );

    const taskIds = runSelector<string[]>(
      db,
      function* () {
        return yield* projectCategoryCardIds({
          projectCategoryId: category.id,
        });
      },
      [],
    );
    const stashProjection = runSelector(
      db,
      function* () {
        return yield* stashProjectionById({ id: stashedTask.id });
      },
      [],
    );

    expect(taskIds.indexOf(stashedTask.id)).toBeLessThan(
      taskIds.indexOf(targetTask.id),
    );
    expect(stashProjection).toBeUndefined();
  });

  it("treats a stash projection dropped on a project category as its task and removes it from stash", () => {
    const db = createDB();
    const { project, category } = createProject(db);
    const targetCategory = syncDispatch(
      db,
      createCategory({
        categoryDraft: {
          projectId: project.id,
          title: "Target",
        },
        position: "append",
      }),
    ) as ProjectCategory;
    const stashedTask = createTask(db, category.id, "stashed-drop-task");

    syncDispatch(
      db,
      addToStash({
        taskId: stashedTask.id,
        position: "append",
      }),
    );

    const canDrop = runSelector<boolean>(
      db,
      function* () {
        return yield* appCanDrop({
          id: targetCategory.id,
          modelType: targetCategory.type,
          dropId: stashedTask.id,
          dropModelType: stashProjectionType,
        });
      },
      [],
    );
    expect(canDrop).toBe(true);

    syncDispatch(
      db,
      appHandleDrop({
        id: targetCategory.id,
        modelType: targetCategory.type,
        dropId: stashedTask.id,
        dropModelType: stashProjectionType,
        edge: "bottom",
      }),
    );

    const movedTask = runSelector<Task | undefined>(
      db,
      function* () {
        return yield* taskById({ id: stashedTask.id });
      },
      [],
    );
    const stashProjection = runSelector(
      db,
      function* () {
        return yield* stashProjectionById({ id: stashedTask.id });
      },
      [],
    );

    expect(movedTask?.projectCategoryId).toBe(targetCategory.id);
    expect(stashProjection).toBeUndefined();
  });

  it("treats a stash projection dropped on a project as its task and removes it from stash", () => {
    const db = createDB();
    const { category } = createProject(db);
    const { project: targetProject, category: targetCategory } = createProject(
      db,
      {
        id: "project-2",
        title: "Target project",
      },
    );
    const stashedTask = createTask(db, category.id, "stashed-drop-on-project");

    syncDispatch(
      db,
      addToStash({
        taskId: stashedTask.id,
        position: "append",
      }),
    );

    const canDrop = runSelector<boolean>(
      db,
      function* () {
        return yield* appCanDrop({
          id: targetProject.id,
          modelType: targetProject.type,
          dropId: stashedTask.id,
          dropModelType: stashProjectionType,
        });
      },
      [],
    );
    expect(canDrop).toBe(true);

    syncDispatch(
      db,
      appHandleDrop({
        id: targetProject.id,
        modelType: targetProject.type,
        dropId: stashedTask.id,
        dropModelType: stashProjectionType,
        edge: "bottom",
      }),
    );

    const movedTask = runSelector<Task | undefined>(
      db,
      function* () {
        return yield* taskById({ id: stashedTask.id });
      },
      [],
    );
    const stashProjection = runSelector(
      db,
      function* () {
        return yield* stashProjectionById({ id: stashedTask.id });
      },
      [],
    );

    expect(movedTask?.projectCategoryId).toBe(targetCategory.id);
    expect(stashProjection).toBeUndefined();
  });
});

describe("project stash-aware timeline counts", () => {
  it("excludes stashed tasks from the stash-aware not-done count only", () => {
    const db = createDB();
    const { project, category } = createProject(db);

    createTask(db, category.id, "visible-task");
    const stashedTask = createTask(db, category.id, "stashed-task");
    const dailyTask = createTask(db, category.id, "daily-task");
    const completedTask = createTask(db, category.id, "completed-task");
    syncDispatch(
      db,
      updateTask({ id: completedTask.id, task: { state: "done" } }),
    );

    const dailyList = syncDispatch(
      db,
      createDailyList({ dailyList: { date: "2026-04-19" } }),
    ) as DailyList;
    syncDispatch(
      db,
      addToDailyList({
        taskId: dailyTask.id,
        dailyListId: dailyList.id,
        position: "append",
      }),
    );
    syncDispatch(
      db,
      addToStash({
        taskId: stashedTask.id,
        position: "append",
      }),
    );

    const existingCount = runSelector<number>(
      db,
      function* () {
        return yield* notDoneTasksCountExceptDailiesCount({
          projectId: project.id,
          exceptDailyListIds: [dailyList.id],
        });
      },
      [],
    );
    const stashAwareCount = runSelector<number>(
      db,
      function* () {
        return yield* notDoneTasksCountExceptDailiesAndStashCount({
          projectId: project.id,
          exceptDailyListIds: [dailyList.id],
        });
      },
      [],
    );

    expect(existingCount).toBe(2);
    expect(stashAwareCount).toBe(1);
  });

  it("excludes stashed tasks from the stash-aware overdue count only", () => {
    const db = createDB();
    const { project, category } = createProject(db);

    const overdueTask = createTask(db, category.id, "overdue-task");
    const stashedOverdueTask = createTask(
      db,
      category.id,
      "stashed-overdue-task",
    );
    const excludedDailyTask = createTask(
      db,
      category.id,
      "excluded-daily-task",
    );

    const overdueList = syncDispatch(
      db,
      createDailyList({ dailyList: { date: "2026-04-17" } }),
    ) as DailyList;
    const stashedOverdueList = syncDispatch(
      db,
      createDailyList({ dailyList: { date: "2026-04-18" } }),
    ) as DailyList;
    const excludedList = syncDispatch(
      db,
      createDailyList({ dailyList: { date: "2026-04-16" } }),
    ) as DailyList;

    syncDispatch(
      db,
      addToDailyList({
        taskId: overdueTask.id,
        dailyListId: overdueList.id,
        position: "append",
      }),
    );
    syncDispatch(
      db,
      addToDailyList({
        taskId: stashedOverdueTask.id,
        dailyListId: stashedOverdueList.id,
        position: "append",
      }),
    );
    syncDispatch(
      db,
      addToDailyList({
        taskId: excludedDailyTask.id,
        dailyListId: excludedList.id,
        position: "append",
      }),
    );
    syncDispatch(
      db,
      addToStash({
        taskId: stashedOverdueTask.id,
        position: "append",
      }),
    );

    const currentDate = new Date("2026-04-19T12:00:00Z");
    const existingCount = runSelector<number>(
      db,
      function* () {
        return yield* overdueTasksCountExceptDailiesCount({
          projectId: project.id,
          exceptDailyListIds: [excludedList.id],
          currentDate: currentDate.getTime(),
        });
      },
      [],
    );
    const stashAwareCount = runSelector<number>(
      db,
      function* () {
        return yield* overdueTasksCountExceptDailiesAndStashCount({
          projectId: project.id,
          exceptDailyListIds: [excludedList.id],
          currentDate: currentDate.getTime(),
        });
      },
      [],
    );

    expect(existingCount).toBe(2);
    expect(stashAwareCount).toBe(1);
  });
});
