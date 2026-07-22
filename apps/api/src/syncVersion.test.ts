import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { UnsupportedSyncVersionError } from "@will-be-done/slices/common";
import { assertSupportedSyncVersion } from "./syncVersion";

describe("sync version enforcement", () => {
  it("accepts version 1", () => {
    expect(() => assertSupportedSyncVersion(1)).not.toThrow();
  });

  it.each([undefined, 0, 2])("rejects unsupported version %s", (version) => {
    try {
      assertSupportedSyncVersion(version);
      throw new Error("Expected sync version rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect(error).toMatchObject({ code: "PRECONDITION_FAILED" });
      expect((error as TRPCError).cause).toBeInstanceOf(
        UnsupportedSyncVersionError,
      );
    }
  });
});
