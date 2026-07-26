import { afterEach, describe, expect, it } from "vitest";
import { withStoreStartupLock } from "./storeDbs";

const navigatorDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator",
);

afterEach(() => {
  if (navigatorDescriptor) {
    Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "navigator");
  }
});

describe("store database startup", () => {
  it("serializes the versioned migration check across tabs", async () => {
    let lockQueue = Promise.resolve();
    let activeLocks = 0;
    let maxActiveLocks = 0;
    const request = <T>(
      _name: string,
      callback: (lock: Lock) => Promise<T>,
    ): Promise<T> => {
      const result = lockQueue.then(async () => {
        activeLocks += 1;
        maxActiveLocks = Math.max(maxActiveLocks, activeLocks);
        try {
          return await callback({} as Lock);
        } finally {
          activeLocks -= 1;
        }
      });
      lockQueue = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    };
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { locks: { request } },
    });

    let migrationVersion = 0;
    let migrationRuns = 0;
    const startTab = () =>
      withStoreStartupLock("space-1", async () => {
        if (migrationVersion === 1) return;
        await Promise.resolve();
        migrationRuns += 1;
        migrationVersion = 1;
      });

    await Promise.all([startTab(), startTab()]);

    expect(maxActiveLocks).toBe(1);
    expect(migrationRuns).toBe(1);
    expect(migrationVersion).toBe(1);
  });
});
