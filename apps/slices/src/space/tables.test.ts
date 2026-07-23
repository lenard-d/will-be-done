import { describe, expect, it } from "vitest";
import {
  dailyEntriesTable,
  dailyEntryType,
  stashEntriesTable,
  stashEntryType,
} from "./tables";

describe("entry storage compatibility", () => {
  it("retains the existing table names and model discriminators", () => {
    expect(dailyEntriesTable.tableName).toBe("task_projections");
    expect(dailyEntryType).toBe("projection");
    expect(stashEntriesTable.tableName).toBe("stash_projections");
    expect(stashEntryType).toBe("stashProjection");
  });
});
