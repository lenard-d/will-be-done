import type { Task } from "@will-be-done/slices/space";

export type TaskSearchStatus = "DONE" | "TO DO" | "BLOCKED" | "STASH" | "IDEAS";

export const taskSearchStatusColors = {
  DONE: "bg-green-950 text-green-400",
  "TO DO": "bg-panel text-content-tinted",
  BLOCKED: "bg-yellow-950 text-notice",
  STASH: "bg-green-950 text-green-400",
  IDEAS: "bg-blue-950 text-blue-400",
} satisfies Record<TaskSearchStatus, string>;

export function getTaskSearchStatus({
  state,
  columnTitle,
  inStash,
}: {
  state: Task["state"];
  columnTitle: string;
  inStash: boolean;
}): TaskSearchStatus {
  if (state === "done") return "DONE";
  const column = columnTitle.trim().toLowerCase();
  if (column === "blocked") return "BLOCKED";
  if (inStash || column === "stash") return "STASH";
  if (column === "ideas") return "IDEAS";
  return "TO DO";
}
