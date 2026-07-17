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

  test("uses the first registered space only when --space is omitted", () => {
    expect(resolveSpaceId(undefined, spaces)).toBe("space-one");
    expect(() => resolveSpaceId(undefined, [])).toThrow(
      "No will-be-done space found",
    );
  });
});
