import { describe, expect, it } from "vitest";
import {
  DB,
  HybridDB,
  SubscribableDB,
  defineTable,
  createSelector,
  execAsync,
  selectAsync,
  selectFrom,
  v,
} from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { waitForLocalPersistence } from "./waitForLocalPersistence";

const drafts = defineTable("durable_drafts", {
  id: v.string(),
  title: v.string(),
});

class ControlledPersistenceDB extends DB {
  constructor(
    private readonly persistenceGate: Promise<void>,
    private readonly onPersistenceStarted: () => void,
  ) {
    super(new BptreeInmemDriver());
  }
  override *beginTx(
    ...args: Parameters<DB["beginTx"]>
  ): ReturnType<DB["beginTx"]> {
    this.onPersistenceStarted();
    yield { type: "unwrap", data: this.persistenceGate };
    return yield* super.beginTx(...args);
  }
}

describe("local draft durability", () => {
  it("keeps completion pending until the projected write reaches primary storage", async () => {
    let releasePersistence = () => {};
    const gate = new Promise<void>((resolve) => {
      releasePersistence = resolve;
    });
    let markPersistenceStarted = () => {};
    const started = new Promise<void>((resolve) => {
      markPersistenceStarted = resolve;
    });
    const primary = new ControlledPersistenceDB(gate, markPersistenceStarted);
    const hybrid = new HybridDB(primary, new DB(new BptreeInmemDriver()));
    const db = new SubscribableDB(hybrid);
    await execAsync(db.loadTables([drafts]));
    await execAsync(
      db.insert(drafts, [{ id: "task-title", title: "Saved title" }]),
    );
    await started;
    let completed = false;
    const completion = waitForLocalPersistence(db).then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    releasePersistence();
    await completion;
    const stored = await selectAsync(primary, {
      selector: createSelector()({
        name: "persistedDraft",
        args: {},
        handler: function* () {
          return yield* selectFrom(drafts, "byId")
            .where((query) => query.eq("id", "task-title"))
            .firstOr(null);
        },
      }),
      args: {},
    });
    expect(stored?.title).toBe("Saved title");
  });
});
