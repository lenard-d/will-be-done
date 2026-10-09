import { expect, it } from "vitest";
import { getTaskSearchStatus } from "./taskSearchStatus";

it.each([
  { state: "todo", columnTitle: "Week", inStash: false, expected: "TO DO" },
  { state: "done", columnTitle: "Week", inStash: false, expected: "DONE" },
  { state: "done", columnTitle: "Blocked", inStash: true, expected: "DONE" },
  { state: "done", columnTitle: "Ideas", inStash: false, expected: "DONE" },
  {
    state: "todo",
    columnTitle: " bLoCkEd ",
    inStash: false,
    expected: "BLOCKED",
  },
  { state: "todo", columnTitle: "Blocked", inStash: true, expected: "BLOCKED" },
  { state: "todo", columnTitle: "Week", inStash: true, expected: "STASH" },
  { state: "todo", columnTitle: " STASH ", inStash: false, expected: "STASH" },
  { state: "todo", columnTitle: " ideas ", inStash: false, expected: "IDEAS" },
  { state: "todo", columnTitle: "Ideas", inStash: true, expected: "STASH" },
] as const)(
  "shows $expected for $state in $columnTitle (stash: $inStash)",
  ({ expected, ...task }) => {
    expect(getTaskSearchStatus(task)).toBe(expected);
  },
);
