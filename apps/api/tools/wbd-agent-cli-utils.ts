export type RegisteredSpace = { id: string };

export function resolveSpaceId(
  requestedSpaceId: string | undefined,
  spaces: readonly RegisteredSpace[],
): string {
  if (requestedSpaceId !== undefined) {
    if (!spaces.some((space) => space.id === requestedSpaceId)) {
      throw new Error(`Space not found: ${requestedSpaceId}`);
    }
    return requestedSpaceId;
  }

  const defaultSpaceId = spaces[0]?.id;
  if (!defaultSpaceId) throw new Error("No will-be-done space found");
  return defaultSpaceId;
}
