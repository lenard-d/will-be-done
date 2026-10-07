import type { State } from "@/utils/State";

type SyncNotifications = { webSocket: State<number>; local: State<number> };
type SyncVersions = { webSocket: number; local: number };

export function syncNotificationVersions(
  notifications: SyncNotifications,
): SyncVersions {
  return {
    webSocket: notifications.webSocket.get(),
    local: notifications.local.get(),
  };
}

/** Observe events during the sync request as well as events during the wait. */
export function waitForSyncTrigger({
  notifications,
  since,
  pollInterval,
}: {
  notifications: SyncNotifications;
  since: SyncVersions;
  pollInterval?: number;
}) {
  return new Promise<"timeout" | "ws" | "local">((resolve) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const subscriptions: (() => void)[] = [];
    const finish = (reason: "timeout" | "ws" | "local") => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      for (const unsubscribe of subscriptions) unsubscribe();
      resolve(reason);
    };
    subscriptions.push(
      notifications.webSocket.subscribe((version) => {
        if (version > since.webSocket) finish("ws");
      }),
    );
    subscriptions.push(
      notifications.local.subscribe((version) => {
        if (version > since.local) finish("local");
      }),
    );
    if (notifications.webSocket.get() > since.webSocket) finish("ws");
    else if (notifications.local.get() > since.local) finish("local");
    else if (pollInterval !== undefined)
      timeout = setTimeout(() => finish("timeout"), pollInterval);
  });
}
