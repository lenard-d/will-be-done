import { describe, expect, test } from "bun:test";
import { resolveSpaceId } from "./wbd-agent-cli-utils";

describe("resolveSpaceId", () => {
  const spaces = [{ id: "space-one" }, { id: "space-two" }];

  test("accepts only explicitly registered space IDs", () => {
    expect(resolveSpaceId("space-two", spaces)).toBe("space-two");
    expect(() => resolveSpaceId("space-typo", spaces)).toThrow(
      "Space not found: space-typo",
    );
  });

  test("uses the only registered space when --space is omitted", () => {
    expect(resolveSpaceId(undefined, [{ id: "space-one" }])).toBe("space-one");
    expect(() => resolveSpaceId(undefined, [])).toThrow(
      "No will-be-done space found",
    );
    expect(() => resolveSpaceId(undefined, spaces)).toThrow(
      "Multiple spaces found; pass --space ID explicitly",
    );
  });
});
