const DOWNWARD_INTENT_DISTANCE = 8;
export const COMMAND_PALETTE_OPEN_DISTANCE = 56;

export type SwipePoint = { x: number; y: number };
export type CommandPalettePull =
  | { phase: "pending" }
  | { phase: "cancelled" }
  | { phase: "dragging"; distance: number };

/** Once the pull starts, only vertical displacement controls the reveal. */
export function getCommandPaletteSwipeProgress({
  start,
  current,
  pulling,
}: {
  start: SwipePoint;
  current: SwipePoint;
  pulling: boolean;
}): CommandPalettePull {
  const distance = current.y - start.y;
  if (pulling) return { phase: "dragging", distance: Math.max(0, distance) };
  const sidewaysDistance = Math.abs(current.x - start.x);
  if (distance <= -DOWNWARD_INTENT_DISTANCE) return { phase: "cancelled" };
  if (distance >= DOWNWARD_INTENT_DISTANCE && distance > sidewaysDistance) {
    return { phase: "dragging", distance };
  }
  return { phase: "pending" };
}
