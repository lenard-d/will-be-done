import { describe, expect, it } from "vitest";
import {
  isSupportedSyncVersion,
  SYNC_VERSION_UNSUPPORTED,
  UnsupportedSyncVersionError,
} from "./syncProtocol";

describe("sync protocol version", () => {
  it("accepts version 3", () => {
    expect(isSupportedSyncVersion(3)).toBe(true);
  });

  it.each([undefined, 0, 1, 2, 4, 3.1])(
    "rejects unsupported version %s",
    (version) => {
      expect(isSupportedSyncVersion(version)).toBe(false);
    },
  );

  it("provides machine-readable compatibility data", () => {
    const error = new UnsupportedSyncVersionError(null);
    expect(error.data).toEqual({
      code: SYNC_VERSION_UNSUPPORTED,
      received: null,
      minimum: 3,
      maximum: 3,
    });
  });
});
