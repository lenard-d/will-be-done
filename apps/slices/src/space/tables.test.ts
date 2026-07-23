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
  it("uses canonical table names and snake-case model discriminators", () => {
    expect(dailyEntriesTable.tableName).toBe("daily_entries");
    expect(dailyEntryType).toBe("daily_entry");
    expect(stashEntriesTable.tableName).toBe("stash_entries");
    expect(stashEntryType).toBe("stash_entry");
    expect(projectSectionsTable.tableName).toBe("project_sections");
    expect(projectSectionType).toBe("project_section");
  });
});
