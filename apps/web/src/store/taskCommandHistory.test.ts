import { describe, expect, it } from "vitest";
import { TaskCommandHistory, shouldHandleTaskUndo } from "./taskCommandHistory";

describe("TaskCommandHistory", () => {
  it.each(["status", "title", "move", "delete"])(
    "undoes the latest %s command",
    async () => {
      const history = new TaskCommandHistory();
      let value = "before";

      await history.execute(async () => {
        value = "after";
        return async () => {
          value = "before";
        };
      });
      await history.undo();

      expect(value).toBe("before");
    },
  );

  it("undoes commands in reverse execution order", async () => {
    const history = new TaskCommandHistory();
    const values: string[] = [];

    await history.execute(async () => {
      values.push("first");
      return async () => {
        values.pop();
      };
    });
    await history.execute(async () => {
      values.push("second");
      return async () => {
        values.pop();
      };
    });

    await history.undo();
    expect(values).toEqual(["first"]);
    await history.undo();
    expect(values).toEqual([]);
  });
});

describe("task undo shortcut", () => {
  it("accepts Cmd/Ctrl+Z outside editable controls", () => {
    expect(
      shouldHandleTaskUndo({
        code: "KeyZ",
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(true);
    expect(
      shouldHandleTaskUndo({
        code: "KeyZ",
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(true);
  });

  it("accepts the reserved U shortcut", () => {
    expect(
      shouldHandleTaskUndo({
        code: "KeyU",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(true);
  });

  it("leaves redo and text editing shortcuts untouched", () => {
    expect(
      shouldHandleTaskUndo({
        code: "KeyZ",
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe(false);
    expect(
      shouldHandleTaskUndo({
        code: "KeyZ",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(false);
    expect(
      shouldHandleTaskUndo({
        code: "KeyZ",
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: true,
      }),
    ).toBe(false);
  });
});
