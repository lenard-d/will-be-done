import { describe, expect, it } from "vitest";
import { DB, execSync, selectSync } from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { allTasksForDisplay } from "./allTasksForDisplay";
import { defaultTask } from "./tasks";
import { defaultTaskTemplate } from "./taskTemplates";
import {
  checklistItemsTable,
  dailyEntriesTable,
  dailyListsTable,
  projectSectionsTable,
  projectsTable,
  stashEntriesTable,
  tasksTable,
  taskTemplatesTable,
  type Project,
  type ProjectSection,
  type Task,
} from "./tables";

function createEmptyDB() {
  const db = new DB(new BptreeInmemDriver());
  execSync(
    db.loadTables([
      tasksTable,
      taskTemplatesTable,
      projectsTable,
      projectSectionsTable,
      dailyListsTable,
      dailyEntriesTable,
      stashEntriesTable,
      checklistItemsTable,
    ]),
  );
  return db;
}

function createDB() {
  const db = createEmptyDB();
  const projects: Project[] = [
    {
      id: "inbox",
      type: "project",
      title: "Inbox",
      icon: "",
      isInbox: true,
      orderToken: "a0",
      createdAt: 0,
    },
    {
      id: "project",
      type: "project",
      title: "Project",
      icon: "",
      isInbox: false,
      orderToken: "a1",
      createdAt: 0,
    },
  ];
  const sections: ProjectSection[] = [
    {
      id: "inbox-section",
      type: "projectSection",
      projectId: "inbox",
      title: "Inbox section",
      orderToken: "a0",
      createdAt: 0,
    },
    {
      id: "project-section",
      type: "projectSection",
      projectId: "project",
      title: "Project section",
      orderToken: "a0",
      createdAt: 0,
    },
  ];
  const tasks: Task[] = [
    {
      ...defaultTask,
      id: "unscheduled",
      title: "Unscheduled",
      projectSectionId: "inbox-section",
      orderToken: "a0",
    },
    {
      ...defaultTask,
      id: "done",
      title: "Completed",
      projectSectionId: "project-section",
      state: "done",
      orderToken: "a0",
    },
    {
      ...defaultTask,
      id: "stashed",
      title: "Stashed",
      projectSectionId: "project-section",
      orderToken: "a1",
    },
    {
      ...defaultTask,
      id: "generated",
      title: "Generated",
      projectSectionId: "project-section",
      orderToken: "a2",
      templateId: "blueprint",
    },
  ];
  execSync(db.driver.insert(projectsTable.tableName, projects));
  execSync(db.driver.insert(projectSectionsTable.tableName, sections));
  execSync(db.driver.insert(tasksTable.tableName, tasks));
  execSync(
    db.driver.insert(taskTemplatesTable.tableName, [
      {
        ...defaultTaskTemplate,
        id: "blueprint",
        projectSectionId: "project-section",
      },
    ]),
  );
  execSync(
    db.driver.insert(dailyListsTable.tableName, [
      { id: "day", type: "dailyList", date: "2026-10-07" },
    ]),
  );
  execSync(
    db.driver.insert(dailyEntriesTable.tableName, [
      {
        id: "done",
        type: "dailyEntry",
        dailyListId: "day",
        orderToken: "a0",
        createdAt: 0,
      },
      {
        id: "generated",
        type: "dailyEntry",
        dailyListId: "day",
        orderToken: "a1",
        createdAt: 0,
      },
    ]),
  );
  execSync(
    db.driver.insert(stashEntriesTable.tableName, [
      { id: "stashed", type: "stashEntry", orderToken: "a0", createdAt: 0 },
    ]),
  );
  return db;
}

describe("all tasks for display", () => {
  it("includes every task once across Inbox, projects, states and placements", () => {
    const items = selectSync(createDB(), {
      selector: allTasksForDisplay,
      args: {},
    });
    expect(items.map((entry) => entry.item.id)).toEqual([
      "unscheduled",
      "done",
      "stashed",
      "generated",
    ]);
  });

  it("keeps task identity with project, section and schedule context", () => {
    const items = selectSync(createDB(), {
      selector: allTasksForDisplay,
      args: {},
    });
    expect(
      items.map((entry) => ({
        id: entry.item.id,
        listItemType: entry.listItem.type,
        project: entry.project.title,
        section: entry.section.title,
        date: entry.dailyList?.date,
      })),
    ).toEqual([
      {
        id: "unscheduled",
        listItemType: "task",
        project: "Inbox",
        section: "Inbox section",
        date: undefined,
      },
      {
        id: "done",
        listItemType: "task",
        project: "Project",
        section: "Project section",
        date: "2026-10-07",
      },
      {
        id: "stashed",
        listItemType: "task",
        project: "Project",
        section: "Project section",
        date: undefined,
      },
      {
        id: "generated",
        listItemType: "task",
        project: "Project",
        section: "Project section",
        date: "2026-10-07",
      },
    ]);
  });

  it("does not read tasks from another space database", () => {
    createDB();
    const otherSpace = createEmptyDB();
    expect(
      selectSync(otherSpace, { selector: allTasksForDisplay, args: {} }),
    ).toEqual([]);
  });
});
