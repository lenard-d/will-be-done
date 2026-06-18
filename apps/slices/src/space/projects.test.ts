import { describe, expect, it } from "vitest";
import {
  DB,
  execSync,
  runSelector,
  syncDispatch,
} from "@will-be-done/hyperdb-lib";
import { BptreeInmemDriver } from "@will-be-done/hyperdb-lib/drivers/inmemory";
import { dbIdTrait } from "../traits";
import { addToDailyList } from "./dailyListsProjections";
import { addToStash } from "./stashProjections";
import { createDailyList } from "./dailyLists";
import {
  createProject as createProjectAction,
  notDoneTasksCountExceptDailiesAndStashCount,
  notDoneTasksCountExceptDailiesCount,
  overdueTasksCountExceptDailiesAndStashCount,
  overdueTasksCountExceptDailiesCount,
} from "./projects";
import {
  createProjectCategoryTask,
  projectCategoriesByProjectId,
} from "./projectsCategories";
import {
  DailyList,
  dailyListsTable,
  Project,
  projectCategoriesTable,
  ProjectCategory,
  projectsTable,
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
      projectsTable,
      stashProjectionsTable,
      taskProjectionsTable,
      taskTemplatesTable,
      tasksTable,
    ]),
  );

  return db;
}

function createProject(db: DB) {
  const project = syncDispatch(
    db,
    createProjectAction({
      project: {
        id: "project-1",
        title: "Project",
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

function createTask(db: DB, categoryId: string, id: string) {
  return syncDispatch(
    db,
    createProjectCategoryTask({
      categoryId,
      position: "append",
      taskAttrs: { id },
    }),
  ) as Task;
}

describe("project stash-aware timeline counts", () => {
  it("excludes stashed tasks from the stash-aware not-done count only", () => {
    const db = createDB();
    const { project, category } = createProject(db);

    createTask(db, category.id, "visible-task");
    const stashedTask = createTask(db, category.id, "stashed-task");
    const dailyTask = createTask(db, category.id, "daily-task");

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
