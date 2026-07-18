import { cn } from "@/lib/utils";

export const taskFloatingControlSurface =
  "rounded-sm bg-panel/90 text-content-tinted ";

export const taskFloatingControlDoneSurface =
  "bg-done-panel-tinted/95 text-done-content ";

export const taskFloatingControlHover =
  "hover:bg-panel-hover hover:text-content";

export const taskFloatingControlVisible =
  "group-hover/task:opacity-100 group-focus-within/task:opacity-100";

export const taskFloatingControlButtonClassName = ({
  isVisible,
  isDone,
}: {
  isVisible: boolean;
  isDone: boolean;
}) =>
  cn(
    taskFloatingControlSurface,
    isDone ? taskFloatingControlDoneSurface : taskFloatingControlHover,
    isDone && "hover:bg-done-panel-selected/30 hover:text-done-content",
    "size-5 cursor-pointer opacity-0 transition-opacity focus-visible:opacity-100",
    isVisible && "opacity-100",
    taskFloatingControlVisible,
  );

export const taskCardClassName = ({
  isFocused,
  isDone,
  isOnTimeline = false,
}: {
  isFocused: boolean;
  isDone: boolean;
  isOnTimeline?: boolean;
}) =>
  cn(
    "group/task relative rounded-lg whitespace-break-spaces [overflow-wrap:anywhere] text-sm ring-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
    "[&[data-suppress-focus-visible=true]]:focus-visible:outline-none",
    isFocused
      ? isDone
        ? isOnTimeline
          ? "ring-ring outline-2 outline-dashed outline-done-panel-selected focus-visible:outline-dashed text-done-content"
          : "ring-2 ring-done-panel-selected text-done-content"
        : isOnTimeline
          ? "ring-ring outline-2 outline-dashed outline-accent focus-visible:outline-dashed text-content"
          : "ring-2 ring-accent text-content"
      : isDone
        ? isOnTimeline
          ? "ring-done-ring outline-2 outline-dashed outline-done-panel-selected text-done-content hover:ring-ring-hover"
          : "ring-done-ring text-done-content hover:ring-ring-hover"
        : isOnTimeline
          ? "ring-ring outline-2 outline-dashed outline-content-tinted-2 text-content hover:ring-ring-hover"
          : "ring-ring text-content hover:ring-ring-hover",
  );

export const taskCardBodyClassName = ({
  isFocused,
  isDone,
}: {
  isFocused: boolean;
  isDone: boolean;
}) =>
  cn(
    "pb-2 rounded-t-lg",
    isDone
      ? "bg-done-panel"
      : isFocused
        ? "bg-panel-hover"
        : "bg-panel hover:bg-panel-hover",
  );

export const taskCardFooterClassName = ({
  isDone,
  nature,
}: {
  isDone: boolean;
  nature?: "red" | "green" | "unknown";
}) =>
  cn(
    "text-sm px-2 py-1.5 text-xs rounded-b-lg",
    isDone
      ? "bg-done-panel-tinted text-done-content"
      : nature === "red"
        ? "bg-nature-red text-nature-red-content"
        : nature === "green"
          ? "bg-nature-green text-nature-green-content"
          : "bg-panel-tinted text-content-tinted",
  );

export const taskFloatingIconGroupClassName = ({
  isShifted,
  isDone,
}: {
  isShifted: boolean;
  isDone: boolean;
}) =>
  cn(
    taskFloatingControlSurface,
    isDone && taskFloatingControlDoneSurface,
    "absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center gap-0.5 px-1 transition-transform",
    isShifted && "-translate-x-6",
    "group-hover/task:-translate-x-6 group-focus-within/task:-translate-x-6",
  );
