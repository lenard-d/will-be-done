import { describe, expect, it } from "vitest";
import {
  DB,
  execSync,
  selectSync,
  syncDispatch,
} from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { dbIdTrait } from "../traits";
import { getSpaceBackup, loadSpaceBackup, type Backup } from "./backup";
import { registeredSpaceSyncableTables } from "./syncMap";

const emptyBackup = (): Backup => ({
  tasks: [],
  projects: [],
  dailyLists: [],
  taskTemplates: [],
  projectCategories: [],
  dailyListProjections: [],
  checklistItems: [],
  habits: [
    {
      id: "habit-1",
      title: "Walk",
      routineId: "routine-1",
      orderToken: "a",
      targetTime: "08:00",
      createdAt: 10,
      archivedAt: null,
    },
  ],
  routines: [
    {
      id: "routine-1",
      title: "Morning",
      orderToken: "a",
      createdAt: 5,
      archivedAt: null,
    },
  ],
  habitCompletions: [
    {
      id: "completion-1",
      habitId: "habit-1",
      completedAt: 20,
    },
  ],
});

function createDB() {
  const db = new DB(new BptreeInmemDriver(), {
    traits: [
      dbIdTrait("space", "a0000000-0000-4000-8000-000000000001"),
    ],
  });
  execSync(db.loadTables(registeredSpaceSyncableTables));
  return db;
}

describe("space backup", () => {
  it("exports persisted legacy habits with complete normalized fields", () => {
    const db = createDB();
    execSync(
      db.driver.insert("habits", [
        {
          type: "habit",
          id: "legacy-habit-for-export",
          title: "Legacy habit",
          orderToken: "1700000000000",
          createdAt: 10,
          archivedAt: 20,
        },
      ]),
    );

    const exported = selectSync(db, { selector: getSpaceBackup, args: {} });

    expect(exported.habits).toEqual([
      {
        id: "legacy-habit-for-export",
        title: "Legacy habit",
        routineId: null,
        orderToken: "1700000000000",
        targetTime: null,
        createdAt: 10,
        archivedAt: 20,
      },
    ]);
  });

  it("restores legacy habit backups as complete persisted rows", () => {
    const db = createDB();
    const backup = emptyBackup();
    backup.habits = [
      {
        id: "legacy-habit-for-restore",
        title: "Legacy habit",
        orderToken: "1700000000000",
        createdAt: 10,
        archivedAt: null,
      },
    ];

    syncDispatch(db, loadSpaceBackup({ backup }));

    expect(
      execSync(
        db.driver.intervalScan("habits", "byOrder", [{}], { order: "asc" }),
      ),
    ).toEqual([
      {
        type: "habit",
        id: "legacy-habit-for-restore",
        title: "Legacy habit",
        routineId: null,
        orderToken: "1700000000000",
        targetTime: null,
        createdAt: 10,
        archivedAt: null,
      },
    ]);
  });

  it("roundtrips habits, routines, and explicit completions", () => {
    expect(
      registeredSpaceSyncableTables.map((table) => table.tableName),
    ).toEqual(
      expect.arrayContaining(["habits", "routines", "habit_completions"]),
    );

    const source = createDB();
    syncDispatch(source, loadSpaceBackup({ backup: emptyBackup() }));
    const exported = selectSync(source, { selector: getSpaceBackup, args: {} });

    const restored = createDB();
    syncDispatch(restored, loadSpaceBackup({ backup: exported }));
    const roundtripped = selectSync(restored, {
      selector: getSpaceBackup,
      args: {},
    });

    expect(roundtripped.habits).toEqual(exported.habits);
    expect(roundtripped.routines).toEqual(exported.routines);
    expect(roundtripped.habitCompletions).toEqual(
      exported.habitCompletions,
    );
  });

  it("preserves optional habit tables when legacy backup sections are absent", () => {
    const db = createDB();
    syncDispatch(db, loadSpaceBackup({ backup: emptyBackup() }));
    const legacyBackup: Backup = {
      tasks: [],
      projects: [],
      dailyLists: [],
      taskTemplates: [],
      projectCategories: [],
    };

    syncDispatch(db, loadSpaceBackup({ backup: legacyBackup }));
    const restored = selectSync(db, { selector: getSpaceBackup, args: {} });

    expect(restored.habits).toEqual(emptyBackup().habits);
    expect(restored.routines).toEqual(emptyBackup().routines);
    expect(restored.habitCompletions).toEqual(emptyBackup().habitCompletions);
  });

  it("clears optional habit tables when sections are explicitly empty", () => {
    const db = createDB();
    syncDispatch(db, loadSpaceBackup({ backup: emptyBackup() }));

    syncDispatch(
      db,
      loadSpaceBackup({
        backup: {
          tasks: [],
          projects: [],
          dailyLists: [],
          taskTemplates: [],
          projectCategories: [],
          habits: [],
          routines: [],
          habitCompletions: [],
        },
      }),
    );
    const restored = selectSync(db, { selector: getSpaceBackup, args: {} });

    expect(restored.habits).toEqual([]);
    expect(restored.routines).toEqual([]);
    expect(restored.habitCompletions).toEqual([]);
  });

  it("restores dangling habit references and completions losslessly", () => {
    const db = createDB();
    const backup = emptyBackup();
    backup.habits = [
      {
        ...backup.habits![0]!,
        routineId: "missing-routine",
      },
    ];
    backup.routines = [];
    backup.habitCompletions = [
      ...backup.habitCompletions!,
      {
        id: "dangling-completion",
        habitId: "missing-habit",
        completedAt: 30,
      },
    ];

    syncDispatch(db, loadSpaceBackup({ backup }));
    const restored = selectSync(db, { selector: getSpaceBackup, args: {} });

    expect(restored.habits).toEqual(backup.habits);
    expect(restored.routines).toEqual(backup.routines);
    expect(restored.habitCompletions).toEqual(backup.habitCompletions);
  });
});
