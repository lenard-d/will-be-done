import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import {
  createAction,
  DB,
  execSync,
  insert,
  syncDispatch,
} from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import {
  projectType,
  projectsTable,
  type Project,
} from "@will-be-done/slices/space";
import * as databases from "../db/db";
import { dbsTable } from "../slices/dbSlice";
import { DatabaseAccessDeniedError } from "./databaseAccess";
import { listSpaceProjects } from "./projects";

const action = createAction();
const seedProjects = action({
  name: "seedProjects",
  args: {},
  handler: function* () {
    const projects: Project[] = [
      {
        type: projectType,
        id: "second",
        title: "Second",
        icon: "2",
        isInbox: false,
        orderToken: "b",
        createdAt: 200,
      },
      {
        type: projectType,
        id: "first",
        title: "First",
        icon: "1",
        isInbox: true,
        orderToken: "a",
        createdAt: 100,
      },
    ];

    yield* insert(projectsTable, projects);
  },
});

describe("listSpaceProjects", () => {
  afterEach(() => {
    mock.restore();
  });

  test("returns public project fields in display order and enforces ownership", () => {
    const mainDB = new DB(new BptreeInmemDriver());
    const spaceDB = new DB(new BptreeInmemDriver());
    execSync(mainDB.loadTables([dbsTable]));
    execSync(spaceDB.loadTables([projectsTable]));
    syncDispatch(spaceDB, seedProjects({}));

    spyOn(databases, "getMainHyperDB").mockImplementation(() => mainDB);
    spyOn(databases, "getHyperDB").mockImplementation(
      () =>
        ({ db: spaceDB }) as unknown as ReturnType<typeof databases.getHyperDB>,
    );
    const projects = listSpaceProjects({
      spaceId: "space-1",
      userId: "user-1",
    });

    expect(projects).toEqual([
      {
        id: "first",
        title: "First",
        icon: "1",
        isInbox: true,
        createdAt: 100,
      },
      {
        id: "second",
        title: "Second",
        icon: "2",
        isInbox: false,
        createdAt: 200,
      },
    ]);

    expect(() =>
      listSpaceProjects({ spaceId: "space-1", userId: "another-user" }),
    ).toThrow(DatabaseAccessDeniedError);
  });
});
