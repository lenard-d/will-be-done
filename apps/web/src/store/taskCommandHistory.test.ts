import { describe, expect, it } from "vitest";
import {
  TaskCommandHistory,
  shouldHandleTaskRedo,
  shouldHandleTaskUndo,
} from "./taskCommandHistory";

describe("TaskCommandHistory", () => {
  it.each(["status", "title", "move", "delete"])(
    "undoes the latest %s command",
    async () => {
      const history = new TaskCommandHistory();
      let value = "before";

      await history.execute(async () => {
        value = "after";
        return {
          undo: async () => {
            value = "before";
          },
          redo: async () => {
            value = "after";
          },
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
      return {
        undo: async () => {
          values.pop();
        },
        redo: async () => {
          values.push("first");
        },
      };
    });
    await history.execute(async () => {
      values.push("second");
      return {
        undo: async () => {
          values.pop();
        },
        redo: async () => {
          values.push("second");
        },
      };
    });

    await history.undo();
    expect(values).toEqual(["first"]);
    await history.undo();
    expect(values).toEqual([]);
  });

  it("redoes the latest undone command", async () => {
    const history = new TaskCommandHistory();
    let value = "before";

    await history.execute(async () => {
      value = "after";
      return {
        undo: async () => {
          value = "before";
        },
        redo: async () => {
          value = "after";
        },
      };
    });

    await history.undo();
    await history.redo();

    expect(value).toBe("after");
  });

  it("clears redo history after a new command", async () => {
    const history = new TaskCommandHistory();
    const values: string[] = [];
    const command = (value: string) => async () => {
      values.push(value);
      return {
        undo: async () => {
          values.pop();
        },
        redo: async () => {
          values.push(value);
        },
      };
    };

    await history.execute(command("first"));
    await history.undo();
    await history.execute(command("second"));
    await history.redo();

    expect(values).toEqual(["second"]);
  });

  it("retains an undo entry when undo fails", async () => {
    const history = new TaskCommandHistory();
    let shouldFail = true;
    let value = "after";

    await history.execute(async () => ({
      undo: async () => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("undo failed");
        }
        value = "before";
      },
      redo: async () => {
        value = "after";
      },
    }));

    await expect(history.undo()).rejects.toThrow("undo failed");
    await history.undo();

    expect(value).toBe("before");
  });

  it("retains a redo entry when redo fails", async () => {
    const history = new TaskCommandHistory();
    let shouldFail = true;
    let value = "after";

    await history.execute(async () => ({
      undo: async () => {
        value = "before";
      },
      redo: async () => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("redo failed");
        }
        value = "after";
      },
    }));
    await history.undo();

    await expect(history.redo()).rejects.toThrow("redo failed");
    await history.redo();

    expect(value).toBe("after");
  });
});

describe("task undo shortcut", () => {
  it.each(["metaKey", "ctrlKey"])(
    "accepts the Z character on a German keyboard with %s",
    (modifier) => {
      const shortcut = {
        key: "z",
        code: "KeyY",
        metaKey: modifier === "metaKey",
        ctrlKey: modifier === "ctrlKey",
        shiftKey: false,
        altKey: false,
      };
      expect(shouldHandleTaskUndo(shortcut)).toBe(true);
    },
  );

  it("accepts Cmd/Ctrl+Z outside editable controls", () => {
    expect(
      shouldHandleTaskUndo({
        key: "z",
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(true);
    expect(
      shouldHandleTaskUndo({
        key: "z",
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(true);
  });

  it("does not treat the Y character as undo at the physical Z position", () => {
    const shortcut = {
      key: "y",
      code: "KeyZ",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
    };
    expect(shouldHandleTaskUndo(shortcut)).toBe(false);
  });

  it("accepts the reserved U shortcut", () => {
    expect(
      shouldHandleTaskUndo({
        key: "u",
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
        key: "z",
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe(false);
    expect(
      shouldHandleTaskUndo({
        key: "z",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(false);
    expect(
      shouldHandleTaskUndo({
        key: "z",
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: true,
      }),
    ).toBe(false);
  });
});

describe("task redo shortcut", () => {
  it.each(["metaKey", "ctrlKey"])(
    "accepts Shift+Z on a German keyboard with %s",
    (modifier) => {
      const shortcut = {
        key: "Z",
        code: "KeyY",
        metaKey: modifier === "metaKey",
        ctrlKey: modifier === "ctrlKey",
        shiftKey: true,
        altKey: false,
      };
      expect(shouldHandleTaskRedo(shortcut)).toBe(true);
    },
  );

  it("accepts Ctrl+R and Cmd/Ctrl+Shift+Z", () => {
    expect(
      shouldHandleTaskRedo({
        key: "r",
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(true);
    expect(
      shouldHandleTaskRedo({
        key: "z",
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe(true);
    expect(
      shouldHandleTaskRedo({
        key: "z",
        metaKey: false,
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe(true);
  });

  it("does not treat Shift+Y as redo at the physical Z position", () => {
    const shortcut = {
      key: "Y",
      code: "KeyZ",
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
    };
    expect(shouldHandleTaskRedo(shortcut)).toBe(false);
  });

  it("leaves plain R and modified redo shortcuts untouched", () => {
    expect(
      shouldHandleTaskRedo({
        key: "r",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(false);
    expect(
      shouldHandleTaskRedo({
        key: "r",
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: true,
      }),
    ).toBe(false);
  });
});
