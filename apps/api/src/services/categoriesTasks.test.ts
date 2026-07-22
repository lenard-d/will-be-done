import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import {
  createAction,
  DB,
  execSync,
  insert,
  selectSync,
  syncDispatch,
} from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { dbIdTrait } from "@will-be-done/slices/traits";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import {
  checklistItemsTable,
  dailyListByDate,
  dailyListsTable,
  dailyProjectionsByDailyListId,
  projectCategoriesTable,
  projectsTable,
  projectCategoryType,
  projectType,
  taskProjectionsTable,
  tasksTable,
  taskTemplatesTable,
  taskTemplateType,
  taskType,
  type Project,
  type ProjectCategory,
  type Task,
  type TaskTemplate,
} from "@will-be-done/slices/space";
import * as databases from "../db/db";
import { dbsTable } from "../slices/dbSlice";
import {
  createProjectCategory,
  deleteProjectCategory,
  listProjectCategories,
  moveProjectCategory,
  updateProjectCategory,
} from "./categories";
import { listCategoryCards } from "./cards";
import { InvalidPlacementError, ResourceNotFoundError } from "./errors";
import {
  createCategoryTask,
  deleteTask,
  getTask,
  moveTask,
  updateTask,
} from "./tasks";
import {
  createSpaceProject,
  deleteSpaceProject,
  listSpaceProjects,
  moveSpaceProject,
  updateSpaceProject,
} from "./projects";
import { scheduleTask } from "./scheduling";

const action = createAction();
const orderA = generateJitteredKeyBetween(null, null);
const orderB = generateJitteredKeyBetween(orderA, null);
const orderC = generateJitteredKeyBetween(orderB, null);
const orderD = generateJitteredKeyBetween(orderC, null);
const orderE = generateJitteredKeyBetween(orderD, null);
const seedDomain = action({
  name: "seedApiDomain",
  args: {},
  handler: function* () {
    const projects: Project[] = [
      {
        type: projectType,
        id: "project-1",
        title: "Project",
        icon: "",
        isInbox: false,
        orderToken: orderA,
        createdAt: 100,
      },
    ];
    const categories: ProjectCategory[] = [
      {
        type: projectCategoryType,
        id: "category-1",
        projectId: "project-1",
        title: "First",
        orderToken: orderA,
        createdAt: 101,
      },
      {
        type: projectCategoryType,
        id: "category-2",
        projectId: "project-1",
        title: "Second",
        orderToken: orderB,
        createdAt: 102,
      },
    ];
    const tasks: Task[] = [
      {
        type: taskType,
        id: "task-a",
        title: "A",
        state: "todo",
        projectCategoryId: "category-1",
        orderToken: orderA,
        lastToggledAt: 100,
        nature: "unknown",
        createdAt: 100,
        templateId: null,
        templateDate: null,
      },
      {
        type: taskType,
        id: "task-c",
        title: "C",
        state: "todo",
        projectCategoryId: "category-1",
        orderToken: orderC,
        lastToggledAt: 100,
        nature: "green",
        createdAt: 100,
        templateId: null,
        templateDate: null,
      },
      {
        type: taskType,
        id: "done-old",
        title: "Done old",
        state: "done",
        projectCategoryId: "category-1",
        orderToken: orderD,
        lastToggledAt: 200,
        nature: "unknown",
        createdAt: 100,
        templateId: null,
        templateDate: null,
      },
      {
        type: taskType,
        id: "done-new",
        title: "Done new",
        state: "done",
        projectCategoryId: "category-1",
        orderToken: orderE,
        lastToggledAt: 300,
        nature: "unknown",
        createdAt: 100,
        templateId: null,
        templateDate: null,
      },
    ];
    const templates: TaskTemplate[] = [
      {
        type: taskTemplateType,
        id: "template-b",
        title: "Template B",
        projectCategoryId: "category-1",
        orderToken: orderB,
        repeatRule: "FREQ=DAILY",
        repeatRuleDtStart: 100,
        createdAt: 100,
        lastGeneratedAt: 100,
        nature: "red",
      },
    ];

    yield* insert(projectsTable, projects);
    yield* insert(projectCategoriesTable, categories);
    yield* insert(tasksTable, tasks);
    yield* insert(taskTemplatesTable, templates);
  },
});

function setUpDatabases() {
  const mainDB = new DB(new BptreeInmemDriver());
  const spaceDB = new DB(new BptreeInmemDriver(), {
    traits: [dbIdTrait("space", "a0000000-0000-4000-8000-000000000001")],
  });
  execSync(mainDB.loadTables([dbsTable]));
  execSync(
    spaceDB.loadTables([
      projectsTable,
      projectCategoriesTable,
      tasksTable,
      taskTemplatesTable,
      checklistItemsTable,
      dailyListsTable,
      taskProjectionsTable,
    ]),
  );
  syncDispatch(spaceDB, seedDomain({}));

  spyOn(databases, "getMainHyperDB").mockImplementation(() => mainDB);
  spyOn(databases, "getHyperDB").mockImplementation(
    () =>
      ({ db: spaceDB }) as unknown as ReturnType<typeof databases.getHyperDB>,
  );
  return { spaceDB };
}

describe("category and task services", () => {
  afterEach(() => mock.restore());

  test("lists project categories in display order without order tokens", () => {
    setUpDatabases();

    expect(
      listProjectCategories({
        spaceId: "space-1",
        projectId: "project-1",
        userId: "user-1",
      }),
    ).toEqual([
      {
        id: "category-1",
        projectId: "project-1",
        title: "First",
        createdAt: 101,
      },
      {
        id: "category-2",
        projectId: "project-1",
        title: "Second",
        createdAt: 102,
      },
    ]);

    expect(() =>
      listProjectCategories({
        spaceId: "space-1",
        projectId: "missing",
        userId: "user-1",
      }),
    ).toThrow(ResourceNotFoundError);
  });

  test("lists todo tasks and templates as cards, or done tasks only", () => {
    setUpDatabases();

    expect(
      listCategoryCards({
        spaceId: "space-1",
        categoryId: "category-1",
        userId: "user-1",
      }).map((card) => [card.type, card.id]),
    ).toEqual([
      ["task", "task-a"],
      ["template", "template-b"],
      ["task", "task-c"],
    ]);

    expect(
      listCategoryCards({
        spaceId: "space-1",
        categoryId: "category-1",
        userId: "user-1",
        taskState: "done",
      }).map((card) => [card.type, card.id]),
    ).toEqual([
      ["task", "done-new"],
      ["task", "done-old"],
    ]);
  });

  test("creates and moves tasks using ID-based placement", () => {
    setUpDatabases();

    const created = createCategoryTask({
      spaceId: "space-1",
      categoryId: "category-1",
      userId: "user-1",
      title: "B",
      placement: { kind: "after", anchorId: "task-a" },
    });
    expect(created).not.toHaveProperty("orderToken");
    expect(
      listCategoryCards({
        spaceId: "space-1",
        categoryId: "category-1",
        userId: "user-1",
      })
        .filter((card) => card.type === "task")
        .map((card) => card.title),
    ).toEqual(["A", "B", "C"]);

    const moved = moveTask({
      spaceId: "space-1",
      taskId: created.id,
      userId: "user-1",
      projectCategoryId: "category-2",
      placement: { kind: "first" },
    });
    expect(moved.projectCategoryId).toBe("category-2");
    expect(
      listCategoryCards({
        spaceId: "space-1",
        categoryId: "category-2",
        userId: "user-1",
      }).map((card) => card.id),
    ).toEqual([created.id]);
  });

  test("rejects anchors outside the destination category", () => {
    setUpDatabases();

    expect(() =>
      createCategoryTask({
        spaceId: "space-1",
        categoryId: "category-2",
        userId: "user-1",
        title: "Invalid",
        placement: { kind: "after", anchorId: "task-a" },
      }),
    ).toThrow(InvalidPlacementError);
  });

  test("updates task state and deletes the task", () => {
    setUpDatabases();

    const updated = updateTask({
      spaceId: "space-1",
      taskId: "task-a",
      userId: "user-1",
      updates: { state: "done", title: "Finished" },
    });
    expect(updated).toMatchObject({ state: "done", title: "Finished" });

    deleteTask({
      spaceId: "space-1",
      taskId: "task-a",
      userId: "user-1",
    });
    expect(() =>
      getTask({
        spaceId: "space-1",
        taskId: "task-a",
        userId: "user-1",
      }),
    ).toThrow(ResourceNotFoundError);
  });

  test("creates, updates, repositions, and deletes projects", () => {
    setUpDatabases();

    const created = createSpaceProject({
      spaceId: "space-1",
      userId: "user-1",
      title: "New project",
      placement: { kind: "first" },
    });
    expect(
      listSpaceProjects({ spaceId: "space-1", userId: "user-1" })[0].id,
    ).toBe(created.id);

    const updated = updateSpaceProject({
      spaceId: "space-1",
      projectId: created.id,
      userId: "user-1",
      updates: { title: "Renamed" },
    });
    expect(updated.title).toBe("Renamed");
    moveSpaceProject({
      spaceId: "space-1",
      projectId: created.id,
      userId: "user-1",
      placement: { kind: "last" },
    });
    expect(
      listSpaceProjects({ spaceId: "space-1", userId: "user-1" }).at(-1)?.id,
    ).toBe(created.id);

    deleteSpaceProject({
      spaceId: "space-1",
      projectId: created.id,
      userId: "user-1",
    });
    expect(
      listSpaceProjects({ spaceId: "space-1", userId: "user-1" }).some(
        (project) => project.id === created.id,
      ),
    ).toBe(false);
  });

  test("creates, updates, repositions, and deletes categories", () => {
    setUpDatabases();

    const created = createProjectCategory({
      spaceId: "space-1",
      projectId: "project-1",
      userId: "user-1",
      title: "Middle",
      placement: { kind: "before", anchorId: "category-2" },
    });
    expect(
      listProjectCategories({
        spaceId: "space-1",
        projectId: "project-1",
        userId: "user-1",
      }).map((category) => category.id),
    ).toEqual(["category-1", created.id, "category-2"]);

    const updated = updateProjectCategory({
      spaceId: "space-1",
      categoryId: created.id,
      userId: "user-1",
      updates: { title: "First now" },
    });
    expect(updated.title).toBe("First now");
    const destination = createSpaceProject({
      spaceId: "space-1",
      userId: "user-1",
      title: "Destination",
    });
    moveProjectCategory({
      spaceId: "space-1",
      categoryId: created.id,
      userId: "user-1",
      projectId: destination.id,
      placement: { kind: "first" },
    });
    expect(
      listProjectCategories({
        spaceId: "space-1",
        projectId: destination.id,
        userId: "user-1",
      })[0].id,
    ).toBe(created.id);

    deleteProjectCategory({
      spaceId: "space-1",
      categoryId: created.id,
      userId: "user-1",
    });
    expect(
      listProjectCategories({
        spaceId: "space-1",
        projectId: "project-1",
        userId: "user-1",
      }).some((category) => category.id === created.id),
    ).toBe(false);
    deleteSpaceProject({
      spaceId: "space-1",
      projectId: destination.id,
      userId: "user-1",
    });
  });

  test("schedules, positions, and reschedules a task", () => {
    const { spaceDB } = setUpDatabases();

    scheduleTask({
      spaceId: "space-1",
      taskId: "task-c",
      userId: "user-1",
      date: "2026-07-22",
    });
    const scheduled = scheduleTask({
      spaceId: "space-1",
      taskId: "task-a",
      userId: "user-1",
      date: "2026-07-22",
      placement: { kind: "before", anchorId: "task-c" },
    });
    expect(scheduled).toMatchObject({
      task: { id: "task-a" },
      date: "2026-07-22",
    });

    const firstList = selectSync(spaceDB, {
      selector: dailyListByDate,
      args: { date: "2026-07-22" },
    });
    expect(firstList).toBeDefined();
    expect(
      selectSync(spaceDB, {
        selector: dailyProjectionsByDailyListId,
        args: { dailyListId: firstList!.id },
      }).map((projection) => projection.id),
    ).toEqual(["task-a", "task-c"]);

    scheduleTask({
      spaceId: "space-1",
      taskId: "task-a",
      userId: "user-1",
      date: "2026-07-23",
    });
    expect(
      selectSync(spaceDB, {
        selector: dailyProjectionsByDailyListId,
        args: { dailyListId: firstList!.id },
      }).map((projection) => projection.id),
    ).toEqual(["task-c"]);
  });
});
