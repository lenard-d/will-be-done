import { asyncDispatch, type HyperDB } from "@will-be-done/hyperdb";
import {
  getSyncStateOrDefault,
  updateSyncState,
} from "@will-be-done/slices/common";
import {
  BroadcastChannel,
  createLeaderElection,
  type LeaderElector,
} from "broadcast-channel";
import { trpcClient } from "@/lib/trpc.ts";
import { State } from "@/utils/State.ts";
import {
  createApplyServerChangesIfNoClientChanges,
  getChangesToSendToServer,
} from "./syncActions";
import { withSyncRequestTimeout } from "./syncRequestTimeout";
import type { ChangePersistedEvent, SyncConfig } from "./syncTypes";

const SYNC_POLL_INTERVAL_MS = 5000;

export class Syncer {
  private electionChannel: BroadcastChannel;
  private elector: LeaderElector;
  private runId = 0;
  private clientId: string;
  private syncConfig: SyncConfig;
  private wsUnsubscribe: (() => void) | null = null;
  private applyServerChangesIfNoClientChanges: ReturnType<
    typeof createApplyServerChangesIfNoClientChanges
  >;

  private wsNotification = new State<number>(0);
  private forceSyncNotification = new State<number>(0);
  private wakeSyncLoop = () => {
    this.forceSync();
  };

  constructor(
    private persistentDB: HyperDB,
    clientId: string,
    syncConfig: SyncConfig,
    private nextClock: () => string,
    private afterChangesPersisted: (e: ChangePersistedEvent) => void,
  ) {
    this.clientId = clientId;
    this.syncConfig = syncConfig;
    this.electionChannel = new BroadcastChannel("election-" + clientId);
    this.elector = createLeaderElection(this.electionChannel);
    this.applyServerChangesIfNoClientChanges =
      createApplyServerChangesIfNoClientChanges(nextClock);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.wakeSyncLoop();
      }
    });
    window.addEventListener("online", this.wakeSyncLoop);
    window.addEventListener("focus", this.wakeSyncLoop);
  }

  startLoop() {
    this.elector.onduplicate = () => {
      console.log("onduplicate");

      this.runId++;
      this.cleanupWebSocket();
      void this.run();
    };

    void this.run();
  }

  forceSync() {
    this.forceSyncNotification.modify((version) => version + 1);
  }

  private cleanupWebSocket() {
    if (this.wsUnsubscribe) {
      this.wsUnsubscribe();
      this.wsUnsubscribe = null;
    }
  }

  private setupWebSocketSubscription() {
    const subscription = trpcClient.onChangesAvailable.subscribe(
      {
        dbId: this.syncConfig.dbId,
        dbType: this.syncConfig.dbType,
      },
      {
        onData: () => {
          console.log("WebSocket notification received");
          this.wsNotification.modify((version) => version + 1);
        },
        onError: (err) => {
          console.error("WebSocket subscription error:", err);
          this.wsNotification.modify((version) => version + 1);
        },
      },
    );

    this.wsUnsubscribe = () => subscription.unsubscribe();
  }

  async run() {
    const myRunId = ++this.runId;

    await this.elector.awaitLeadership();

    this.setupWebSocketSubscription();

    while (true) {
      if (this.runId !== myRunId) {
        console.log("runId !== myRunId, stopping syncer loop");
        this.cleanupWebSocket();
        return;
      }
      try {
        console.log("sending changes to server");
        await this.sendChangesToServer();
        console.log("applying changes from server");
        await this.getAndApplyChanges();
      } catch (e) {
        console.error(e);
      }

      await this.waitForNextSyncTrigger();
    }
  }

  private async waitForNextSyncTrigger() {
    const wsVersion = this.wsNotification.get();
    const forceSyncVersion = this.forceSyncNotification.get();

    return new Promise<"timeout" | "ws" | "local">((resolve) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let unsubscribeWs = () => {};
      let unsubscribeForceSync = () => {};
      let settled = false;

      const finish = (reason: "timeout" | "ws" | "local") => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        unsubscribeWs();
        unsubscribeForceSync();
        resolve(reason);
      };

      unsubscribeWs = this.wsNotification.subscribe((version) => {
        if (version > wsVersion) {
          finish("ws");
        }
      });
      unsubscribeForceSync = this.forceSyncNotification.subscribe((version) => {
        if (version > forceSyncVersion) {
          finish("local");
        }
      });

      if (process.env.NODE_ENV !== "development") {
        timeoutId = setTimeout(() => finish("timeout"), SYNC_POLL_INTERVAL_MS);
      }
    });
  }

  private async getAndApplyChanges() {
    const syncState = await asyncDispatch(
      this.persistentDB,
      getSyncStateOrDefault({}),
    );
    const serverChanges = await withSyncRequestTimeout(
      "getChangesAfter",
      (signal) =>
        trpcClient.getChangesAfter.query(
          {
            lastServerUpdatedAt: syncState.lastServerAppliedClock,
            dbId: this.syncConfig.dbId,
            dbType: this.syncConfig.dbType,
            clientId: this.clientId,
          },
          { signal },
        ),
    );

    if (serverChanges.changesets.length === 0) {
      console.log("no changes from server");
      if (serverChanges.maxClock !== "") {
        await asyncDispatch(
          this.persistentDB,
          updateSyncState({
            updates: { lastServerAppliedClock: serverChanges.maxClock },
          }),
        );
      }

      return;
    }

    await asyncDispatch(
      this.persistentDB,
      this.applyServerChangesIfNoClientChanges({
        registeredSyncableTableNameMap: this.syncConfig.tableNameMap,
        syncState,
        serverChanges,
        clientId: this.clientId,
      }),
    );

    try {
      this.afterChangesPersisted({ changeset: serverChanges.changesets });
    } catch (e) {
      console.error(e);
    }
  }

  private async sendChangesToServer() {
    const { changesets, maxClock } = await asyncDispatch(
      this.persistentDB,
      getChangesToSendToServer({
        registeredSyncableTableNameMap: this.syncConfig.tableNameMap,
      }),
    );

    if (changesets.length === 0) {
      return;
    }

    await withSyncRequestTimeout("handleChanges", (signal) =>
      trpcClient.handleChanges.mutate(
        {
          dbId: this.syncConfig.dbId,
          dbType: this.syncConfig.dbType,
          changeset: changesets,
        },
        { signal },
      ),
    );
    await asyncDispatch(
      this.persistentDB,
      updateSyncState({ updates: { lastSentClock: maxClock } }),
    );
  }
}
