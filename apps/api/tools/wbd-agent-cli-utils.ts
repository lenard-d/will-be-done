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

  if (spaces.length === 0) throw new Error("No will-be-done space found");
  if (spaces.length > 1) {
    throw new Error("Multiple spaces found; pass --space ID explicitly");
  }
  return spaces[0].id;
}
