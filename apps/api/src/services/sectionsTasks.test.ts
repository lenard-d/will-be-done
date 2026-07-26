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
  dailyEntriesByDailyListId,
  projectSectionsTable,
  projectsTable,
  projectSectionType,
  projectType,
  dailyEntriesTable,
  tasksTable,
  taskTemplatesTable,
  taskTemplateType,
  taskType,
  type Project,
  type ProjectSection,
  type Task,
  type TaskTemplate,
} from "@will-be-done/slices/space";
import * as databases from "../db/db";
import { dbsTable } from "../slices/dbSlice";
import {
  createProjectSection,
  deleteProjectSection,
  listProjectSections,
  moveProjectSection,
  updateProjectSection,
} from "./sections";
import { listSectionItems } from "./items";
import { InvalidPlacementError, ResourceNotFoundError } from "./errors";
import {
  createSectionTask,
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
import { listDailyListItems } from "./dailyLists";

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
    const sections: ProjectSection[] = [
      {
        type: projectSectionType,
        id: "section-1",
        projectId: "project-1",
        title: "First",
        orderToken: orderA,
        createdAt: 101,
      },
      {
        type: projectSectionType,
        id: "section-2",
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
        projectSectionId: "section-1",
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
        projectSectionId: "section-1",
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
        projectSectionId: "section-1",
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
        projectSectionId: "section-1",
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
        projectSectionId: "section-1",
        orderToken: orderB,
        repeatRule: "FREQ=DAILY",
        repeatRuleDtStart: 100,
        createdAt: 100,
        lastGeneratedAt: 100,
        nature: "red",
      },
    ];

    yield* insert(projectsTable, projects);
    yield* insert(projectSectionsTable, sections);
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
      projectSectionsTable,
      tasksTable,
      taskTemplatesTable,
      checklistItemsTable,
      dailyListsTable,
      dailyEntriesTable,
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

describe("section and task services", () => {
  afterEach(() => mock.restore());

  test("lists project sections in display order without order tokens", () => {
    setUpDatabases();

    expect(
      listProjectSections({
        spaceId: "space-1",
        projectId: "project-1",
        userId: "user-1",
      }),
    ).toEqual([
      {
        id: "section-1",
        projectId: "project-1",
        title: "First",
        createdAt: 101,
      },
      {
        id: "section-2",
        projectId: "project-1",
        title: "Second",
        createdAt: 102,
      },
    ]);

    expect(() =>
      listProjectSections({
        spaceId: "space-1",
        projectId: "missing",
        userId: "user-1",
      }),
    ).toThrow(ResourceNotFoundError);
  });

  test("lists todo tasks and templates as items, or done tasks only", () => {
    setUpDatabases();

    expect(
      listSectionItems({
        spaceId: "space-1",
        sectionId: "section-1",
        userId: "user-1",
      }).map((item) => [item.type, item.id]),
    ).toEqual([
      ["task", "task-a"],
      ["template", "template-b"],
      ["task", "task-c"],
    ]);

    expect(
      listSectionItems({
        spaceId: "space-1",
        sectionId: "section-1",
        userId: "user-1",
        taskState: "done",
      }).map((item) => [item.type, item.id]),
    ).toEqual([
      ["task", "done-new"],
      ["task", "done-old"],
    ]);
  });

  test("creates and moves tasks using ID-based placement", () => {
    setUpDatabases();

    const created = createSectionTask({
      spaceId: "space-1",
      sectionId: "section-1",
      userId: "user-1",
      title: "B",
      placement: { kind: "after", anchorId: "task-a" },
    });
    expect(created).not.toHaveProperty("orderToken");
    expect(
      listSectionItems({
        spaceId: "space-1",
        sectionId: "section-1",
        userId: "user-1",
      })
        .filter((item) => item.type === "task")
        .map((item) => item.title),
    ).toEqual(["A", "B", "C"]);

    const moved = moveTask({
      spaceId: "space-1",
      taskId: created.id,
      userId: "user-1",
      projectSectionId: "section-2",
      placement: { kind: "first" },
    });
    expect(moved.projectSectionId).toBe("section-2");
    expect(
      listSectionItems({
        spaceId: "space-1",
        sectionId: "section-2",
        userId: "user-1",
      }).map((item) => item.id),
    ).toEqual([created.id]);
  });

  test("rejects anchors outside the destination section", () => {
    setUpDatabases();

    expect(() =>
      createSectionTask({
        spaceId: "space-1",
        sectionId: "section-2",
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

  test("creates, updates, repositions, and deletes sections", () => {
    setUpDatabases();

    const created = createProjectSection({
      spaceId: "space-1",
      projectId: "project-1",
      userId: "user-1",
      title: "Middle",
      placement: { kind: "before", anchorId: "section-2" },
    });
    expect(
      listProjectSections({
        spaceId: "space-1",
        projectId: "project-1",
        userId: "user-1",
      }).map((section) => section.id),
    ).toEqual(["section-1", created.id, "section-2"]);

    const updated = updateProjectSection({
      spaceId: "space-1",
      sectionId: created.id,
      userId: "user-1",
      updates: { title: "First now" },
    });
    expect(updated.title).toBe("First now");
    const destination = createSpaceProject({
      spaceId: "space-1",
      userId: "user-1",
      title: "Destination",
    });
    moveProjectSection({
      spaceId: "space-1",
      sectionId: created.id,
      userId: "user-1",
      projectId: destination.id,
      placement: { kind: "first" },
    });
    expect(
      listProjectSections({
        spaceId: "space-1",
        projectId: destination.id,
        userId: "user-1",
      })[0].id,
    ).toBe(created.id);

    deleteProjectSection({
      spaceId: "space-1",
      sectionId: created.id,
      userId: "user-1",
    });
    expect(
      listProjectSections({
        spaceId: "space-1",
        projectId: "project-1",
        userId: "user-1",
      }).some((section) => section.id === created.id),
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
        selector: dailyEntriesByDailyListId,
        args: { dailyListId: firstList!.id },
      }).map((entry) => entry.id),
    ).toEqual(["task-a", "task-c"]);
    expect(
      listDailyListItems({
        spaceId: "space-1",
        userId: "user-1",
        date: "2026-07-22",
      }).map((item) => item.id),
    ).toEqual(["task-a", "task-c"]);

    scheduleTask({
      spaceId: "space-1",
      taskId: "done-new",
      userId: "user-1",
      date: "2026-07-22",
    });
    expect(
      listDailyListItems({
        spaceId: "space-1",
        userId: "user-1",
        date: "2026-07-22",
        state: "done",
      }).map((item) => item.id),
    ).toEqual(["done-new"]);
    expect(
      listDailyListItems({
        spaceId: "space-1",
        userId: "user-1",
        date: "2026-07-24",
      }),
    ).toEqual([]);

    scheduleTask({
      spaceId: "space-1",
      taskId: "task-a",
      userId: "user-1",
      date: "2026-07-23",
    });
    expect(
      selectSync(spaceDB, {
        selector: dailyEntriesByDailyListId,
        args: { dailyListId: firstList!.id },
      }).map((entry) => entry.id),
    ).toEqual(["task-c", "done-new"]);
  });
});
