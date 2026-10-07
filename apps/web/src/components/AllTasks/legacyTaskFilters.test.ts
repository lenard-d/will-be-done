import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyTaskFilters } from "./taskFilters";
import { readLegacyTaskFilters } from "./legacyTaskFilters";

afterEach(() => vi.unstubAllGlobals());

function savedStorage(value: string | null) {
  vi.stubGlobal("localStorage", { getItem: () => value });
}

describe("legacy All tasks filters", () => {
  it("keeps the filters for the current space", () => {
    const filters = {
      ...emptyTaskFilters,
      projectIds: ["project"],
      columnNames: [" Blocked "],
    };
    savedStorage(
      JSON.stringify({
        state: {
          filtersBySpace: {
            current: filters,
            other: { ...emptyTaskFilters, query: "other" },
          },
        },
      }),
    );
    expect(readLegacyTaskFilters("current")).toEqual({
      ...filters,
      columnNames: ["blocked"],
    });
  });
  it("starts an unknown space without another space's filters", () => {
    savedStorage(
      JSON.stringify({
        state: {
          filtersBySpace: { other: { ...emptyTaskFilters, query: "other" } },
        },
      }),
    );
    expect(readLegacyTaskFilters("current")).toEqual(emptyTaskFilters);
  });
  it.each([
    null,
    "not JSON",
    JSON.stringify({
      state: { filtersBySpace: { current: { invalid: true } } },
    }),
  ])("ignores absent or damaged settings: %s", (value) => {
    savedStorage(value);
    expect(readLegacyTaskFilters("current")).toEqual(emptyTaskFilters);
  });
  it("works when browser storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Storage unavailable");
      },
    });
    expect(readLegacyTaskFilters("current")).toEqual(emptyTaskFilters);
  });
});
