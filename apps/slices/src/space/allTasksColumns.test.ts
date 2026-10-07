import { describe, expect, it } from "vitest";
import { DB, execSync, selectSync, syncDispatch } from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import {
  allTasksColumns,
  createAllTasksColumn,
  deleteAllTasksColumn,
  ensureAllTasksColumns,
  moveAllTasksColumn,
  updateAllTasksColumn,
} from "./allTasksColumns";
import { emptyTaskFilters } from "./taskViewFilters";
import { getSpaceBackup, loadSpaceBackup, type Backup } from "./backup";
import { appById, appCanDrop } from "./app";
import {
  registeredSpaceSyncableTables,
  registeredSpaceSyncableModelTableMap,
} from "./syncMap";
import { allTasksColumnsTable, tasksTable } from "./tables";
import { dbIdTrait } from "../traits";
import {
  changesTable,
  getChangesetAfter,
  insertChangeFromDelete,
  insertChangeFromInsert,
  insertChangeFromUpdate,
  mergeChanges,
  type ChangesetArrayType,
} from "../common";
import { registeredSpaceSyncableTableNameMap } from "./syncMap";

const filtersJson = JSON.stringify(emptyTaskFilters);
const backup: Backup = {
  tasks: [],
  projects: [],
  dailyLists: [],
  taskTemplates: [],
  projectSections: [],
};

function createDB() {
  const db = new DB(new BptreeInmemDriver(), {
    traits: [dbIdTrait("space", "a0000000-0000-4000-8000-000000000001")],
  });
  execSync(db.loadTables([...registeredSpaceSyncableTables, changesTable]));
  return db;
}

function columns(db: DB) {
  return selectSync(db, { selector: allTasksColumns, args: {} });
}

function changesAfter(db: DB, after: string) {
  return selectSync(db, {
    selector: getChangesetAfter,
    args: {
      after,
      registeredSyncableTableNameMap: registeredSpaceSyncableTableNameMap,
    },
  }).changesets;
}

function mergeInto(db: DB, input: ChangesetArrayType, nextClock: string) {
  syncDispatch(
    db,
    mergeChanges({
      input,
      nextClock,
      clientId: "peer",
      registeredSyncableTableNameMap: registeredSpaceSyncableTableNameMap,
    }),
  );
}

describe("saved All tasks columns", () => {
  it("initializes once and preserves the first saved filters", () => {
    const db = createDB();
    const initial = syncDispatch(db, ensureAllTasksColumns({ filtersJson }));
    syncDispatch(
      db,
      ensureAllTasksColumns({
        filtersJson: JSON.stringify({ ...emptyTaskFilters, query: "later" }),
      }),
    );
    expect(columns(db)).toEqual([initial]);
  });

  it("uses one default identity across databases", () => {
    const first = syncDispatch(
      createDB(),
      ensureAllTasksColumns({ filtersJson }),
    );
    const second = syncDispatch(
      createDB(),
      ensureAllTasksColumns({ filtersJson }),
    );
    expect(second).toEqual(first);
  });

  it("normalizes filter input and keeps column edits independent", () => {
    const db = createDB();
    const first = syncDispatch(db, ensureAllTasksColumns({ filtersJson }));
    const second = syncDispatch(
      db,
      createAllTasksColumn({ title: " Other ", filtersJson }),
    );
    syncDispatch(
      db,
      updateAllTasksColumn({
        id: second.id,
        filtersJson: JSON.stringify({
          ...emptyTaskFilters,
          columnNames: ["  NEXT  "],
          query: "find",
        }),
      }),
    );
    expect(columns(db)).toEqual([
      first,
      {
        ...second,
        filtersJson: JSON.stringify({
          ...emptyTaskFilters,
          query: "find",
          columnNames: ["next"],
        }),
      },
    ]);
  });

  it.each([
    "not json",
    JSON.stringify({ ...emptyTaskFilters, states: ["invalid"] }),
    JSON.stringify({
      ...emptyTaskFilters,
      plannedDay: { kind: "range", from: "2026-10-10", to: "2026-10-01" },
    }),
  ])("rejects invalid filters without creating rows: %s", (invalid) => {
    const db = createDB();
    expect(() =>
      syncDispatch(
        db,
        createAllTasksColumn({ title: "Invalid", filtersJson: invalid }),
      ),
    ).toThrow();
    expect(columns(db)).toEqual([]);
  });

  it("rejects invalid updates and retains the existing row", () => {
    const db = createDB();
    const column = syncDispatch(db, ensureAllTasksColumns({ filtersJson }));
    expect(() =>
      syncDispatch(
        db,
        updateAllTasksColumn({
          id: column.id,
          title: "Changed",
          filtersJson: "{}",
        }),
      ),
    ).toThrow();
    expect(columns(db)).toEqual([column]);
  });

  it("inserts after an anchor and moves adjacent columns both ways", () => {
    const db = createDB();
    const first = syncDispatch(db, ensureAllTasksColumns({ filtersJson }));
    const last = syncDispatch(
      db,
      createAllTasksColumn({ title: "Last", filtersJson }),
    );
    const middle = syncDispatch(
      db,
      createAllTasksColumn({ title: "Middle", filtersJson, afterId: first.id }),
    );
    expect(columns(db).map((column) => column.id)).toEqual([
      first.id,
      middle.id,
      last.id,
    ]);
    syncDispatch(db, moveAllTasksColumn({ id: first.id, direction: "right" }));
    syncDispatch(db, moveAllTasksColumn({ id: last.id, direction: "left" }));
    expect(columns(db).map((column) => column.id)).toEqual([
      middle.id,
      last.id,
      first.id,
    ]);
  });

  it("keeps moves at each edge unchanged", () => {
    const db = createDB();
    const first = syncDispatch(db, ensureAllTasksColumns({ filtersJson }));
    const last = syncDispatch(
      db,
      createAllTasksColumn({ title: "Last", filtersJson }),
    );
    syncDispatch(db, moveAllTasksColumn({ id: first.id, direction: "left" }));
    syncDispatch(db, moveAllTasksColumn({ id: last.id, direction: "right" }));
    expect(columns(db)).toEqual([first, last]);
  });

  it("deletes a saved view and protects the final column", () => {
    const db = createDB();
    const first = syncDispatch(db, ensureAllTasksColumns({ filtersJson }));
    const second = syncDispatch(
      db,
      createAllTasksColumn({ title: "Second", filtersJson }),
    );
    syncDispatch(db, deleteAllTasksColumn({ id: second.id }));
    expect(() =>
      syncDispatch(db, deleteAllTasksColumn({ id: first.id })),
    ).toThrow("final");
    expect(columns(db)).toEqual([first]);
  });

  it("deletes only the saved view and retains task ownership", () => {
    const db = createDB();
    const task = {
      type: "task",
      id: "task-1",
      title: "Keep task",
      state: "todo",
      projectSectionId: "original-section",
      orderToken: "a0",
      lastToggledAt: 0,
      createdAt: 0,
      templateId: null,
      templateDate: null,
    };
    execSync(db.driver.insert(tasksTable.tableName, [task]));
    syncDispatch(db, ensureAllTasksColumns({ filtersJson }));
    const column = syncDispatch(
      db,
      createAllTasksColumn({ title: "View", filtersJson }),
    );
    syncDispatch(db, deleteAllTasksColumn({ id: column.id }));
    expect(
      execSync(
        db.driver.intervalScan(tasksTable.tableName, "byIds", [{}], {
          order: "asc",
        }),
      ),
    ).toEqual([task]);
  });

  it("transfers columns and filter updates between devices through sync", () => {
    const source = createDB();
    const destination = createDB();
    const column = syncDispatch(source, ensureAllTasksColumns({ filtersJson }));
    syncDispatch(
      source,
      insertChangeFromInsert({
        tableDef: allTasksColumnsTable,
        row: column,
        clientId: "source",
        nextClock: "001",
      }),
    );
    const initial = selectSync(source, {
      selector: getChangesetAfter,
      args: {
        after: "",
        registeredSyncableTableNameMap: registeredSpaceSyncableTableNameMap,
      },
    });
    syncDispatch(
      destination,
      mergeChanges({
        input: initial.changesets,
        nextClock: "002",
        clientId: "destination",
        registeredSyncableTableNameMap: registeredSpaceSyncableTableNameMap,
      }),
    );
    expect(columns(destination)).toEqual([column]);

    const updated = syncDispatch(
      source,
      updateAllTasksColumn({
        id: column.id,
        title: "Renamed",
        filtersJson: JSON.stringify({ ...emptyTaskFilters, query: "phone" }),
      }),
    );
    syncDispatch(
      source,
      insertChangeFromUpdate({
        tableDef: allTasksColumnsTable,
        oldRow: column,
        newRow: updated,
        clientId: "source",
        nextClock: "003",
      }),
    );
    const changes = selectSync(source, {
      selector: getChangesetAfter,
      args: {
        after: "001",
        registeredSyncableTableNameMap: registeredSpaceSyncableTableNameMap,
      },
    });
    syncDispatch(
      destination,
      mergeChanges({
        input: changes.changesets,
        nextClock: "004",
        clientId: "destination",
        registeredSyncableTableNameMap: registeredSpaceSyncableTableNameMap,
      }),
    );
    expect(columns(destination)).toEqual([updated]);
  });

  it("registers columns for sync and model lookup without accepting task drops", () => {
    const db = createDB();
    const column = syncDispatch(db, ensureAllTasksColumns({ filtersJson }));
    expect(registeredSpaceSyncableModelTableMap.allTasksColumn).toBe(
      allTasksColumnsTable,
    );
    expect(
      selectSync(db, {
        selector: appById,
        args: { id: column.id, modelType: "allTasksColumn" },
      }),
    ).toEqual(column);
    expect(
      selectSync(db, {
        selector: appCanDrop,
        args: {
          id: column.id,
          modelType: "allTasksColumn",
          dropId: "task-1",
          dropModelType: "task",
        },
      }),
    ).toBe(false);
  });

  it("recovers an unfiltered default after concurrent view deletions without changing tasks", () => {
    const desktop = createDB();
    const phone = createDB();
    const task = {
      type: "task",
      id: "retained-task",
      title: "Keep task",
      state: "todo",
      projectSectionId: "original-section",
      orderToken: "a0",
      lastToggledAt: 0,
      createdAt: 0,
      templateId: null,
      templateDate: null,
    };
    for (const db of [desktop, phone]) {
      execSync(db.driver.insert(tasksTable.tableName, [task]));
    }
    const first = syncDispatch(
      desktop,
      ensureAllTasksColumns({
        filtersJson: JSON.stringify({
          ...emptyTaskFilters,
          query: "Old filter",
        }),
      }),
    );
    const second = syncDispatch(
      desktop,
      createAllTasksColumn({ title: "Second", filtersJson }),
    );
    for (const row of [first, second]) {
      syncDispatch(
        desktop,
        insertChangeFromInsert({
          tableDef: allTasksColumnsTable,
          row,
          clientId: "desktop",
          nextClock: "001",
        }),
      );
    }
    mergeInto(phone, changesAfter(desktop, ""), "002");
    syncDispatch(desktop, deleteAllTasksColumn({ id: first.id }));
    syncDispatch(
      desktop,
      insertChangeFromDelete({
        tableDef: allTasksColumnsTable,
        row: first,
        clientId: "desktop",
        nextClock: "003",
      }),
    );
    syncDispatch(phone, deleteAllTasksColumn({ id: second.id }));
    syncDispatch(
      phone,
      insertChangeFromDelete({
        tableDef: allTasksColumnsTable,
        row: second,
        clientId: "phone",
        nextClock: "004",
      }),
    );
    const desktopChanges = changesAfter(desktop, "002");
    const phoneChanges = changesAfter(phone, "002");
    mergeInto(desktop, phoneChanges, "005");
    mergeInto(phone, desktopChanges, "006");
    expect([columns(desktop), columns(phone)]).toEqual([[], []]);
    for (const db of [desktop, phone]) {
      expect(
        execSync(
          db.driver.intervalScan(tasksTable.tableName, "byIds", [{}], {
            order: "asc",
          }),
        ),
      ).toEqual([task]);
    }
    const recovered = syncDispatch(
      desktop,
      ensureAllTasksColumns({ filtersJson }),
    );
    expect(recovered.filtersJson).toBe(filtersJson);
    syncDispatch(
      desktop,
      insertChangeFromInsert({
        tableDef: allTasksColumnsTable,
        row: recovered,
        clientId: "desktop",
        nextClock: "007",
      }),
    );
    mergeInto(phone, changesAfter(desktop, "006"), "008");
    expect([columns(desktop), columns(phone)]).toEqual([
      [recovered],
      [recovered],
    ]);
  });

  it("restores column settings and preserves them for old backups", () => {
    const source = createDB();
    syncDispatch(source, ensureAllTasksColumns({ filtersJson }));
    syncDispatch(
      source,
      createAllTasksColumn({ title: "Second", filtersJson }),
    );
    const exported = selectSync(source, { selector: getSpaceBackup, args: {} });
    const restored = createDB();
    syncDispatch(restored, loadSpaceBackup({ backup: exported }));
    expect(columns(restored)).toEqual(columns(source));
    syncDispatch(restored, loadSpaceBackup({ backup }));
    expect(columns(restored)).toEqual(columns(source));
  });

  it("rejects invalid saved filters on backup restore", () => {
    const db = createDB();
    expect(() =>
      syncDispatch(
        db,
        loadSpaceBackup({
          backup: {
            ...backup,
            allTasksColumns: [
              {
                id: "invalid",
                title: "Invalid",
                createdAt: 0,
                orderToken: "a0",
                filtersJson: "{}",
              },
            ],
          },
        }),
      ),
    ).toThrow();
  });
});
