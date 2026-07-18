export type HabitShortcut =
  | "toggle"
  | "edit"
  | "actions"
  | "details"
  | "move-routine"
  | "add-after"
  | "add-before"
  | "delete"
  | "escape"
  | "move-up"
  | "move-down"
  | "move-left"
  | "move-right";

type ShortcutEvent = Pick<
  KeyboardEvent,
  "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
>;

export const getHabitShortcut = (
  event: ShortcutEvent,
): HabitShortcut | null => {
  if (event.ctrlKey && !(event.metaKey || event.shiftKey || event.altKey)) {
    if (event.code === "ArrowUp" || event.code === "KeyK") return "move-up";
    if (event.code === "ArrowDown" || event.code === "KeyJ") return "move-down";
    if (event.code === "ArrowLeft" || event.code === "KeyH") return "move-left";
    if (event.code === "ArrowRight" || event.code === "KeyL")
      return "move-right";
    return null;
  }

  if (
    event.shiftKey &&
    !(event.ctrlKey || event.metaKey || event.altKey) &&
    event.code === "KeyO"
  ) {
    return "add-before";
  }

  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
    return null;
  if (event.code === "Space") return "toggle";
  if (event.code === "Enter" || event.code === "KeyI") return "edit";
  if (event.code === "KeyA") return "actions";
  if (event.code === "KeyV") return "details";
  if (event.code === "KeyM") return "move-routine";
  if (event.code === "KeyO") return "add-after";
  if (
    event.code === "Backspace" ||
    event.code === "KeyD" ||
    event.code === "KeyX"
  ) {
    return "delete";
  }
  if (event.code === "Escape") return "escape";
  return null;
};

export const normalizeTargetTimeInput = (
  value: string,
): string | null | undefined => {
  const normalized = value.trim();
  if (!normalized) return null;
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized)
    ? normalized
    : undefined;
};

export const getHabitRoutineSelection = (
  routineId: string | null,
  routines: { id: string; archivedAt: number | null }[],
  unassignedValue: string,
) =>
  routineId !== null &&
  routines.some(
    (routine) => routine.id === routineId && routine.archivedAt === null,
  )
    ? routineId
    : unassignedValue;

export const getRoutineMoveTarget = (
  routineIds: string[],
  routineId: string,
  direction: "left" | "right",
): { targetId: string; edge: "top" | "bottom" } | null => {
  const index = routineIds.indexOf(routineId);
  if (index === -1) return null;
  const targetId = routineIds[index + (direction === "left" ? -1 : 1)];
  if (!targetId) return null;
  return {
    targetId,
    edge: direction === "left" ? "top" : "bottom",
  };
};
