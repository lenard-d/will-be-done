import { useEffect } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { isInputElement } from "@/utils/isInputElement.ts";
import { isModelDNDData } from "@/lib/dnd/models.ts";
import { DropTargetRecord } from "@atlaskit/pragmatic-drag-and-drop/dist/types/internal-types";
import { shouldNeverHappen } from "@/utils.ts";
import { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/dist/types/types";
import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {
  AnyModelType,
  appById,
  appHandleDrop,
  checklistItemType,
  dailyListType,
  dailyEntryType,
  habitType,
  projectSectionType,
  projectType,
  routineType,
  stashEntryType,
  stashType,
  taskTemplateType,
  taskType,
} from "@will-be-done/slices/space";
import { useDB, useAsyncDispatch } from "@will-be-done/hyperdb/react";
import { FocusKey, useFocusStore } from "@/store/focusSlice.ts";
import {
  getDOMSiblings,
  getDOMColumnSiblingFirstItems,
} from "@/components/Focus/domNavigation.ts";
import { selectAsync } from "@will-be-done/hyperdb";
import { useTaskCommandHistory } from "@/hooks/useTaskCommandHistory.ts";
import {
  shouldHandleTaskRedo,
  shouldHandleTaskUndo,
} from "@/store/taskCommandHistory.ts";
import { sortedTaskDrop } from "@/components/TaskSorting/sortedTaskDrop";
import { dailyEntryById } from "@will-be-done/slices/space";

export function GlobalListener() {
  const dispatch = useAsyncDispatch();
  const db = useDB();
  const { executeTaskCommand, redoTaskCommand, undoTaskCommand } =
    useTaskCommandHistory();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const focusState = useFocusStore.getState();
      if (e.defaultPrevented) return;

      const activeElement =
        e.target instanceof Element ? e.target : document.activeElement;

      const isEditor =
        activeElement &&
        (activeElement.closest(
          "textarea, select, [role='textbox'], [role='combobox']",
        ) ||
          (activeElement instanceof HTMLElement &&
            activeElement.isContentEditable) ||
          activeElement.closest(
            "input:not([type='checkbox']):not([type='radio']):not([type='button']):not([type='submit'])",
          ));
      if (isEditor) return;
      if (e.target instanceof HTMLElement && e.target.shadowRoot) {
        return;
      }
      if (focusState.isFocusDisabled) return;

      if (shouldHandleTaskUndo(e)) {
        if (
          !e.metaKey &&
          !e.ctrlKey &&
          activeElement &&
          isInputElement(activeElement)
        )
          return;
        e.preventDefault();
        void undoTaskCommand();
        return;
      }

      if (shouldHandleTaskRedo(e)) {
        e.preventDefault();
        void redoTaskCommand();
        return;
      }
    };

    const handleModifiedHistoryShortcut = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) handleKeyDown(event);
    };

    window.addEventListener("keydown", handleModifiedHistoryShortcut, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener(
        "keydown",
        handleModifiedHistoryShortcut,
        true,
      );
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [redoTaskCommand, undoTaskCommand]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const focusState = useFocusStore.getState();

      if (focusState.isFocusDisabled || e.defaultPrevented) return;

      const activeElement =
        e.target instanceof Element ? e.target : document.activeElement;

      // Check if the active element IS any kind of input element
      const isInput = activeElement && isInputElement(activeElement);

      // If it's an input, return early
      if (isInput) return;

      if (e.code === "Escape" && !focusState.focusItemKey) {
        useFocusStore.getState().resetFocus();
        return;
      }

      const noModifiers = !(e.shiftKey || e.ctrlKey || e.metaKey || e.altKey);
      const isUp = noModifiers && (e.code === "ArrowUp" || e.code == "KeyK");
      const isDown =
        noModifiers && (e.code === "ArrowDown" || e.code == "KeyJ");

      const isLeft =
        noModifiers && (e.code === "ArrowLeft" || e.code == "KeyH");
      const isRight =
        noModifiers && (e.code === "ArrowRight" || e.code == "KeyL");

      const focusItemKey = useFocusStore.getState().focusItemKey;
      if (focusItemKey && (isUp || isDown)) {
        e.preventDefault();

        const [up, down] = getDOMSiblings(focusItemKey);

        if (isUp) {
          if (!up) return;

          useFocusStore.getState().focusByKey(up);
        } else if (isDown) {
          if (!down) return;

          useFocusStore.getState().focusByKey(down);
        }
      } else if (focusItemKey && (isLeft || isRight)) {
        e.preventDefault();

        const [left, right] = getDOMColumnSiblingFirstItems(focusItemKey);

        if (isLeft) {
          if (!left) return;

          useFocusStore.getState().focusByKey(left);
        } else if (isRight) {
          if (!right) return;

          useFocusStore.getState().focusByKey(right);
        }
      }
    };

    const handleFocus = (event: Event) => {
      const focusedElement = event.target;
      if (!(focusedElement instanceof HTMLElement)) {
        return;
      }

      if (focusedElement.hasAttribute("data-focusable-key")) {
        const focusableKey = focusedElement.getAttribute("data-focusable-key");

        if (focusableKey) {
          useFocusStore.getState().focusByKey(focusableKey as FocusKey, true);
        }
      }
    };

    window.addEventListener("focus", handleFocus, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    return combine(
      monitorForElements({
        onDrop: function (args) {
          void (async () => {
            const { location, source } = args;
            const { projectSectionId, taskSortFocusScope } = source.data;

            if (!location.current.dropTargets.length) {
              return;
            }

            if (!isModelDNDData(source.data)) {
              return;
            }

            const closestTarget = location.current.dropTargets[0];
            const projectTarget = location.current.dropTargets.find(
              (target) => target.data.modelType === projectSectionType,
            );
            const isProjectColumnTransfer =
              typeof projectSectionId === "string" &&
              typeof projectTarget?.data.modelId === "string" &&
              projectSectionId !== projectTarget.data.modelId;
            const sortedTarget =
              closestTarget && "taskSortMode" in closestTarget.data
                ? closestTarget
                : undefined;
            const isTaskSource =
              source.data.modelType === taskType ||
              source.data.modelType === dailyEntryType ||
              source.data.modelType === stashEntryType;
            if (sortedTarget && isTaskSource && !isProjectColumnTransfer) {
              const sourceEntry = await selectAsync(db, {
                selector: dailyEntryById,
                args: { id: source.data.modelId },
              });
              const sortedDrop = sortedTaskDrop({
                sourceId: source.data.modelId,
                sourceDailyListId: sourceEntry?.dailyListId,
                sourceFocusScope: taskSortFocusScope,
                target: sortedTarget.data,
                edge:
                  extractClosestEdge(sortedTarget.data) === "bottom"
                    ? "bottom"
                    : "top",
              });
              if (sortedDrop.handled) {
                const action = sortedDrop.action;
                if (action) {
                  void executeTaskCommand([source.data.modelId], () =>
                    dispatch(action),
                  );
                }
                return;
              }
            }

            const projectSortMode = closestTarget?.element
              .closest("[data-task-sort-mode]")
              ?.getAttribute("data-task-sort-mode");
            if (
              !isProjectColumnTransfer &&
              closestTarget?.data.modelType === projectSectionType &&
              (projectSortMode === "date" || projectSortMode === "alphabetical")
            )
              return;

            const targetImportanceOrder = [
              checklistItemType,
              habitType,
              stashEntryType,
              dailyEntryType,
              taskType,
              taskTemplateType,
              stashType,
              dailyListType,
              projectSectionType,
              routineType,
              projectType,
            ];

            const targetModelsArray = await Promise.all(
              location.current.dropTargets.map(async (t) => {
                if (!isModelDNDData(t.data)) {
                  return [] as const;
                }
                const entity = await selectAsync(db, {
                  selector: appById,
                  args: { id: t.data.modelId, modelType: t.data.modelType },
                });
                if (!entity) {
                  // Virtual models (e.g. stash) have no DB row — use DnD data directly
                  return [
                    [
                      t,
                      { id: t.data.modelId, type: t.data.modelType },
                    ] as const,
                  ];
                }
                return [[t, entity] as const];
              }),
            );

            const targetModels = targetModelsArray.flatMap((t) => t);

            let targetItemInfo:
              | readonly [DropTargetRecord, { id: string; type: AnyModelType }]
              | undefined = undefined;
            for (const importanceType of targetImportanceOrder) {
              targetItemInfo = targetModels.find(
                ([_, e]) => e.type === importanceType,
              ) as readonly [
                DropTargetRecord,
                { id: string; type: AnyModelType },
              ];

              if (targetItemInfo) {
                break;
              }
            }

            if (!targetItemInfo) {
              shouldNeverHappen(
                "Drop entity not found or not in importance list",
              );

              return;
            }

            const closestEdgeOfTarget: Edge | null = extractClosestEdge(
              targetItemInfo[0].data,
            );

            if (
              closestEdgeOfTarget &&
              closestEdgeOfTarget != "top" &&
              closestEdgeOfTarget != "bottom"
            ) {
              shouldNeverHappen("edge is not top or bottom");

              return;
            }

            const sourceModelId = source.data.modelId;
            const sourceModelType = source.data.modelType;
            const moveItem = () =>
              dispatch(
                appHandleDrop({
                  id: targetItemInfo[1].id,
                  modelType: targetItemInfo[1].type,
                  dropId: sourceModelId,
                  dropModelType: sourceModelType,
                  edge: closestEdgeOfTarget || "top",
                }),
              );
            if (isTaskSource) {
              void executeTaskCommand([sourceModelId], moveItem);
            } else {
              void moveItem();
            }
          })();
        },
      }),
    );
  }, [db, dispatch, executeTaskCommand]);

  return <></>;
}
