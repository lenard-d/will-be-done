import { afterEach, describe, expect, it, vi } from "vitest";
import { State } from "@/utils/State";
import {
  syncNotificationVersions,
  waitForSyncTrigger,
} from "./waitForSyncTrigger";

afterEach(() => vi.useRealTimers());
const createNotifications = () => ({
  webSocket: new State(0),
  local: new State(0),
});

describe("sync wake events", () => {
  it.each(["webSocket", "local"] as const)(
    "retains %s events received during a request",
    async (source) => {
      const notifications = createNotifications();
      const since = syncNotificationVersions(notifications);
      notifications[source].modify((version) => version + 1);
      expect(await waitForSyncTrigger({ notifications, since })).toBe(
        source === "webSocket" ? "ws" : "local",
      );
    },
  );
  it.each(["webSocket", "local"] as const)(
    "wakes for %s events after waiting starts",
    async (source) => {
      const notifications = createNotifications();
      const waiting = waitForSyncTrigger({
        notifications,
        since: syncNotificationVersions(notifications),
      });
      notifications[source].modify((version) => version + 1);
      expect(await waiting).toBe(source === "webSocket" ? "ws" : "local");
    },
  );
  it("removes listeners after waking", async () => {
    const notifications = createNotifications();
    const waiting = waitForSyncTrigger({
      notifications,
      since: syncNotificationVersions(notifications),
    });
    notifications.local.set(1);
    await waiting;
    expect([
      notifications.local.subs.size,
      notifications.webSocket.subs.size,
    ]).toEqual([0, 0]);
  });
  it("polls and removes listeners when no event arrives", async () => {
    vi.useFakeTimers();
    const notifications = createNotifications();
    const waiting = waitForSyncTrigger({
      notifications,
      since: syncNotificationVersions(notifications),
      pollInterval: 5000,
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(await waiting).toBe("timeout");
    expect([
      notifications.local.subs.size,
      notifications.webSocket.subs.size,
    ]).toEqual([0, 0]);
  });
});
