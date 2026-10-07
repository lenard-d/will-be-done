const MIN_SWIPE_DISTANCE = 56;
const MAX_HORIZONTAL_DISTANCE = 24;
const DIRECTION_LOCK_DISTANCE = 8;
const MIN_VERTICAL_RATIO = 1.5;
const MAX_SWIPE_DURATION_MS = 750;

export type SwipePoint = { x: number; y: number; time: number };

export function getCommandPaletteSwipeProgress(
  start: SwipePoint,
  current: SwipePoint,
): "pending" | "cancelled" | "ready" {
  const horizontalDistance = Math.abs(current.x - start.x);
  const verticalDistance = current.y - start.y;

  if (
    current.time - start.time > MAX_SWIPE_DURATION_MS ||
    verticalDistance < -DIRECTION_LOCK_DISTANCE ||
    horizontalDistance > MAX_HORIZONTAL_DISTANCE ||
    (horizontalDistance >= DIRECTION_LOCK_DISTANCE &&
      horizontalDistance > Math.abs(verticalDistance))
  ) {
    return "cancelled";
  }

  return verticalDistance >= MIN_SWIPE_DISTANCE &&
    verticalDistance >= horizontalDistance * MIN_VERTICAL_RATIO
    ? "ready"
    : "pending";
}
