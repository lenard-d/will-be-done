import {
  selector,
  selectFrom,
  action,
  upsert,
  v,
} from "@will-be-done/hyperdb-lib";
import { syncStateTable, syncStateId, type SyncState } from "./tables";

export { syncStateTable, type SyncState } from "./tables";

export const getSyncStateOrDefault = selector({
  name: "getSyncStateOrDefault",
  args: {},
  handler: function* getSyncStateOrDefault() {
    const currentSyncState = (yield* selectFrom(syncStateTable, "byId").where(
      (q) => q.eq("id", syncStateId),
    ))[0];

    return (currentSyncState ?? {
      id: syncStateId,
      lastSentClock: "",
      lastServerAppliedClock: "",
    }) as SyncState;
  },
});

export const updateSyncState = action({
  name: "updateSyncState",
  args: {
    updates: v.object({
      id: v.optional(v.string()),
      lastSentClock: v.optional(v.string()),
      lastServerAppliedClock: v.optional(v.string()),
    }),
  },
  handler: function* updateSyncState({ updates }) {
    const currentSyncState = yield* getSyncStateOrDefault({});
    return yield* upsert(syncStateTable, [
      {
        ...currentSyncState,
        ...updates,
      },
    ]);
  },
});
