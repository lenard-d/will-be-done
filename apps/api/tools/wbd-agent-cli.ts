#!/usr/bin/env bun

const originalLog = console.log.bind(console);
const originalError = console.error.bind(console);
console.log = () => {};

const pretty = process.argv.includes("--json");
const argv = process.argv.slice(2).filter((value) => value !== "--json");
const [group, command, ...rest] = argv;

function output(value: unknown) {
  originalLog(JSON.stringify(value, null, pretty ? 2 : 0));
}

function fail(message: string): never {
  originalError(message);
  process.exit(1);
}

function usage(): never {
  originalError(`will-be-done agent CLI
Usage:
  wbd status|users|spaces [--json]
  wbd projects list|create|update ... [--space ID] [--json]
  wbd categories list|create ... [--space ID] [--json]
  wbd tasks list|create|update|toggle|delete ... [--space ID] [--json]`);
  process.exit(2);
}

function option(name: string) {
  const index = rest.indexOf(name);
  return index >= 0 ? rest[index + 1] : undefined;
}

function positionalArgs() {
  const optionsWithValues = new Set([
    "--space",
    "--state",
    "--project",
    "--category",
    "--content",
    "--title",
    "--icon",
  ]);
  const values: string[] = [];
  for (let index = 0; index < rest.length; index += 1) {
    if (optionsWithValues.has(rest[index]!)) index += 1;
    else values.push(rest[index]!);
  }
  return values;
}

async function main() {
  const { createSelector, selectFrom, selectSync, syncDispatch } = await import(
    "@will-be-done/hyperdb"
  );
  const { getHyperDB, getMainHyperDB } = await import("../src/db/db.ts");
  const { spaceDBConfig } = await import("../src/db/configs.ts");
  const { usersTable } = await import("../src/slices/authSlice.ts");
  const { dbsTable } = await import("../src/slices/dbSlice.ts");
  const { resolveSpaceId } = await import("./wbd-agent-cli-utils.ts");
  const space = await import("@will-be-done/slices/space");
  const selector = createSelector();
  const allUsers = selector({
    name: "agentCliAllUsers",
    args: {},
    handler: function* allUsers() {
      return yield* selectFrom(usersTable, "byIds");
    },
  });
  const allDbs = selector({
    name: "agentCliAllDbs",
    args: {},
    handler: function* allDbs() {
      return yield* selectFrom(dbsTable, "byIdTypes");
    },
  });
  const mainDb = getMainHyperDB();
  const users = () =>
    selectSync(mainDb, { selector: allUsers, args: {} }).map(
      ({ password: _password, ...user }) => user,
    );
  const spaces = () =>
    selectSync(mainDb, { selector: allDbs, args: {} }).filter(
      (row) => row.type === "space",
    );
  const spaceContext = () => {
    let spaceId: string;
    try {
      spaceId = resolveSpaceId(option("--space"), spaces());
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
    return { spaceId, db: getHyperDB(spaceDBConfig(spaceId)).db };
  };
  type AnyDb =
    | ReturnType<typeof getMainHyperDB>
    | ReturnType<typeof getHyperDB>["db"];
  const projects = (db: AnyDb) =>
    selectSync(db, { selector: space.allProjects, args: {} });
  const categories = (db: AnyDb) =>
    selectSync(db, { selector: space.allProjectCategories, args: {} });
  const tasks = (db: AnyDb) =>
    selectSync(db, { selector: space.allTasks, args: {} });
  const chooseCategory = (db: AnyDb) => {
    const explicitCategory = option("--category");
    if (explicitCategory) return explicitCategory;
    const rows = projects(db);
    const projectId =
      option("--project") ?? rows.find((row) => row.isInbox)?.id ?? rows[0]?.id;
    if (!projectId) fail("No project found");
    return (
      categories(db).find((row) => row.projectId === projectId)?.id ??
      fail(`Project has no category: ${projectId}`)
    );
  };

  if (!group) usage();
  if (group === "status") {
    output({ ok: true, users: users().length, spaces: spaces().length });
  } else if (group === "users") {
    output(users());
  } else if (group === "spaces") {
    output(spaces());
  } else if (group === "projects" && command === "list") {
    const { spaceId, db } = spaceContext();
    output({ spaceId, projects: projects(db) });
  } else if (group === "projects" && command === "create") {
    const title = positionalArgs().join(" ") || fail("Missing project title");
    const { spaceId, db } = spaceContext();
    const project = syncDispatch(
      db,
      space.createProject({ project: { title }, position: "append" }),
    );
    output({ spaceId, project });
  } else if (group === "projects" && command === "update") {
    const projectId = positionalArgs()[0] || fail("Missing project-id");
    const { spaceId, db } = spaceContext();
    const project: { title?: string; icon?: string } = {};
    if (option("--title")) project.title = option("--title");
    if (option("--icon")) project.icon = option("--icon");
    if (Object.keys(project).length === 0) fail("Nothing to update");
    syncDispatch(db, space.updateProject({ id: projectId, project }));
    output({
      spaceId,
      project: selectSync(db, {
        selector: space.projectById,
        args: { id: projectId },
      }),
    });
  } else if (group === "categories" && command === "list") {
    const { spaceId, db } = spaceContext();
    const projectId = option("--project");
    output({
      spaceId,
      categories: categories(db).filter(
        (row) => !projectId || row.projectId === projectId,
      ),
    });
  } else if (group === "categories" && command === "create") {
    const args = positionalArgs();
    const projectId = args[0] || fail("Missing project-id");
    const title = args.slice(1).join(" ") || fail("Missing category title");
    const { spaceId, db } = spaceContext();
    const category = syncDispatch(
      db,
      space.createCategory({
        categoryDraft: { projectId, title },
        position: "append",
      }),
    );
    output({ spaceId, category });
  } else if (group === "tasks" && command === "list") {
    const { spaceId, db } = spaceContext();
    const state = option("--state") ?? "todo";
    if (!new Set(["todo", "done", "all"]).has(state)) {
      fail("--state must be todo, done, or all");
    }
    let rows = tasks(db).filter((task) => state === "all" || task.state === state);
    const projectId = option("--project");
    if (projectId) {
      const categoryIds = new Set(
        categories(db)
          .filter((category) => category.projectId === projectId)
          .map((category) => category.id),
      );
      rows = rows.filter((task) => categoryIds.has(task.projectCategoryId));
    }
    output({ spaceId, tasks: rows });
  } else if (group === "tasks" && command === "create") {
    const title = positionalArgs().join(" ") || fail("Missing task title");
    const { spaceId, db } = spaceContext();
    const task = syncDispatch(
      db,
      space.createProjectCategoryTask({
        categoryId: chooseCategory(db),
        position: "append",
        taskAttrs: { title, content: option("--content") },
      }),
    );
    output({ spaceId, task });
  } else if (group === "tasks" && command === "update") {
    const taskId = positionalArgs()[0] || fail("Missing task-id");
    const { spaceId, db } = spaceContext();
    const task: {
      title?: string;
      content?: string;
      state?: "todo" | "done";
      projectCategoryId?: string;
    } = {};
    if (option("--title")) task.title = option("--title");
    if (option("--content")) task.content = option("--content");
    const state = option("--state");
    if (state) {
      if (state !== "todo" && state !== "done") fail("Invalid task state");
      task.state = state;
    }
    if (option("--category") || option("--project")) {
      task.projectCategoryId = chooseCategory(db);
    }
    if (Object.keys(task).length === 0) fail("Nothing to update");
    syncDispatch(db, space.updateTask({ id: taskId, task }));
    output({
      spaceId,
      task: selectSync(db, {
        selector: space.taskById,
        args: { id: taskId },
      }),
    });
  } else if (group === "tasks" && command === "toggle") {
    const taskId = positionalArgs()[0] || fail("Missing task-id");
    const { spaceId, db } = spaceContext();
    syncDispatch(db, space.toggleTaskState({ taskId }));
    output({
      spaceId,
      task: selectSync(db, {
        selector: space.taskById,
        args: { id: taskId },
      }),
    });
  } else if (group === "tasks" && command === "delete") {
    const taskId = positionalArgs()[0] || fail("Missing task-id");
    const { spaceId, db } = spaceContext();
    syncDispatch(db, space.deleteTasks({ ids: [taskId] }));
    output({ spaceId, deleted: taskId });
  } else {
    usage();
  }
}

void main().catch((error: unknown) => {
  originalError(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exit(1);
});
