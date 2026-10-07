import {
  execAsync,
  HybridDB,
  SubscribableDB,
  type HyperDB,
} from "@will-be-done/hyperdb";

/** Wait until a projected local change reaches persistent storage. */
export async function waitForLocalPersistence(db: HyperDB): Promise<void> {
  const localDB = db instanceof SubscribableDB ? db.db : db;
  if (localDB instanceof HybridDB) {
    await execAsync(localDB.waitForPendingPersistence());
  }
}
