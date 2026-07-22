import { TRPCError } from "@trpc/server";
import {
  isSupportedSyncVersion,
  UnsupportedSyncVersionError,
} from "@will-be-done/slices/common";

export const assertSupportedSyncVersion = (
  syncVersion: number | undefined,
): void => {
  if (isSupportedSyncVersion(syncVersion)) return;

  const cause = new UnsupportedSyncVersionError(syncVersion ?? null);
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: cause.message,
    cause,
  });
};
