import { asyncDispatch, type SubscribableDB } from "@will-be-done/hyperdb";
import { mergeChanges } from "@will-be-done/slices/common";
import { BroadcastChannel } from "broadcast-channel";
import type { ChangePersistedEvent, SyncConfig } from "./syncTypes";

type CreateCrossTabChangesArgs = {
  clientId: string;
  syncSubDb: SubscribableDB;
  syncConfig: SyncConfig;
  nextClock: () => string;
};

export const createCrossTabChanges = ({
  clientId,
  syncSubDb,
  syncConfig,
  nextClock,
}: CreateCrossTabChangesArgs) => {
  const bc = new BroadcastChannel(`changes-${clientId}`);

  const applyChanges = async (data: ChangePersistedEvent) => {
    await asyncDispatch(
      syncSubDb.withTraits({ type: "skip-sync" }),
      mergeChanges({
        input: data.changeset,
        nextClock: nextClock(),
        clientId,
        registeredSyncableTableNameMap: syncConfig.tableNameMap,
      }),
    );
  };

  bc.onmessage = (data) => {
    void applyChanges(data as ChangePersistedEvent);
  };

  return {
    applyChanges,
    postChanges: (data: ChangePersistedEvent) => {
      void bc.postMessage(data);
    },
  };
};
