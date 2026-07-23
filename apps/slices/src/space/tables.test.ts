import { describe, expect, it } from "vitest";
import {
  dailyEntriesTable,
  dailyEntryType,
  projectSectionsTable,
  projectSectionType,
  stashEntriesTable,
  stashEntryType,
} from "./tables";

describe("storage identities", () => {
  it("uses snake-case table names and camel-case model discriminators", () => {
    expect(dailyEntriesTable.tableName).toBe("daily_entries");
    expect(dailyEntryType).toBe("dailyEntry");
    expect(stashEntriesTable.tableName).toBe("stash_entries");
    expect(stashEntryType).toBe("stashEntry");
    expect(projectSectionsTable.tableName).toBe("project_sections");
    expect(projectSectionType).toBe("projectSection");
  });
});
