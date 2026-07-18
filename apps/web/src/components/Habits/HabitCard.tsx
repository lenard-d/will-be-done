import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import invariant from "tiny-invariant";
import TextareaAutosize from "react-textarea-autosize";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { preserveOffsetOnSource } from "@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Clock3,
  Flame,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  appHandleDrop,
  archiveHabit,
  createHabit,
  deleteHabits,
  habitType,
  moveHabit,
  toggleHabitToday,
  UNASSIGNED_ROUTINE_ID,
  updateHabit,
} from "@will-be-done/slices/space";
import { useAsyncDispatch } from "@will-be-done/hyperdb/react";
import { CheckboxComp } from "@/components/Checklist/Checklist";
import {
  getDOMColumnSiblingDropTarget,
  getDOMSiblings,
} from "@/components/Focus/domNavigation";
import { useGlobalListener } from "@/components/GlobalListener/hooks";
import { DropTaskIndicator } from "@/components/Task/Task";
import {
  taskCardBodyClassName,
  taskCardClassName,
  taskCardFooterClassName,
  taskFloatingControlButtonClassName,
} from "@/components/Task/styles";
import { MoveDestinationModal } from "@/components/MoveTaskModel/MoveModel";
import { useItemDetailsOpen } from "@/components/ItemDetails/ItemDetailsStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { promptDialog } from "@/components/ui/prompt-dialog-service";
import { createElementDragPreview } from "@/lib/dnd/dragPreview";
import { isModelDNDData, type DndModelData } from "@/lib/dnd/models";
import { cn } from "@/lib/utils";
import {
  buildFocusKey,
  focusTextareaAtEnd,
  parseColumnKey,
  useFocusStore,
} from "@/store/focusSlice";
import { isInputElement } from "@/utils/isInputElement";
import type { HabitMetricWithRoutine, RoutineColumn } from "./habitLayout";
import {
  getHabitShortcut,
  normalizeTargetTimeInput,
  type HabitShortcut,
} from "./habitInteractions";

const menuItemSelector = [
  "[data-slot='dropdown-menu-item']",
  "[data-slot='dropdown-menu-sub-trigger']",
]
  .map(
    (selector) =>
      `${selector}:not([data-disabled]):not([aria-disabled='true'])`,
  )
  .join(",");

const focusAdjacentMenuItem = (
  content: HTMLElement,
  direction: "next" | "previous",
) => {
  const items = Array.from(
    content.querySelectorAll<HTMLElement>(menuItemSelector),
  );
  if (!items.length) return;

  const activeIndex = items.findIndex(
    (item) => item === document.activeElement,
  );
  const nextIndex =
    activeIndex === -1
      ? direction === "next"
        ? 0
        : items.length - 1
      : direction === "next"
        ? (activeIndex + 1) % items.length
        : (activeIndex - 1 + items.length) % items.length;
  items[nextIndex]?.focus();
};

const HabitActionsMenu = ({
  habit,
  columns,
  isFocused,
  open,
  onOpenChange,
  onToggle,
  onEdit,
  onSetTime,
  onMoveRoutine,
  onAddAfter,
  onAddBefore,
  onMove,
  onArchive,
  onDelete,
  onShortcutKeyDown,
  onCloseAutoFocus,
}: {
  habit: HabitMetricWithRoutine;
  columns: RoutineColumn[];
  isFocused: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: () => void;
  onEdit: () => void;
  onSetTime: () => void;
  onMoveRoutine: (routineId: string | null) => void;
  onAddAfter: () => void;
  onAddBefore: () => void;
  onMove: (direction: "up" | "down" | "left" | "right") => void;
  onArchive: () => void;
  onDelete: () => void;
  onShortcutKeyDown: (event: ReactKeyboardEvent) => void;
  onCloseAutoFocus: (event: Event) => void;
}) => (
  <DropdownMenu open={open} onOpenChange={onOpenChange}>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Habit actions"
        title="Habit actions"
        className={taskFloatingControlButtonClassName({
          isVisible: isFocused || open,
          isDone: habit.isDoneToday,
        })}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <MoreHorizontal className="size-3" />
      </Button>
    </DropdownMenuTrigger>
    {open && (
      <DropdownMenuContent
        align="end"
        className="min-w-52 bg-task-dropdown shadow-2xl ring-0 backdrop-blur-none"
        onClick={(event) => event.stopPropagation()}
        onKeyDownCapture={(event) => {
          const noModifiers = !(
            event.shiftKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
          );
          if (noModifiers && (event.code === "KeyJ" || event.code === "KeyK")) {
            event.preventDefault();
            event.stopPropagation();
            focusAdjacentMenuItem(
              event.currentTarget,
              event.code === "KeyJ" ? "next" : "previous",
            );
            return;
          }

          const isMenuNavigationKey =
            noModifiers &&
            [
              "ArrowUp",
              "ArrowDown",
              "ArrowLeft",
              "ArrowRight",
              "Home",
              "End",
              "PageUp",
              "PageDown",
              "Tab",
              "Enter",
              "Space",
              "Escape",
            ].includes(event.code);
          if (!isMenuNavigationKey) onShortcutKeyDown(event);
        }}
        onKeyDown={(event) => event.stopPropagation()}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onToggle}>
            <Check />
            {habit.isDoneToday ? "Mark as todo" : "Mark as done"}
            <DropdownMenuShortcut>Space</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            Edit title
            <DropdownMenuShortcut>i</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onSetTime}>
            <Clock3 />
            Set target time
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput className="mr-2 size-4" />
              Move to routine
              <DropdownMenuShortcut>m</DropdownMenuShortcut>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                disabled={habit.routineId === null}
                onSelect={() => onMoveRoutine(null)}
              >
                Unassigned
              </DropdownMenuItem>
              {columns.map((column) => {
                const routine = column.routine;
                return routine ? (
                <DropdownMenuItem
                  key={column.id}
                  disabled={habit.routineId === routine.id}
                  onSelect={() => onMoveRoutine(routine.id)}
                >
                  {column.title}
                </DropdownMenuItem>
                ) : null;
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={onAddAfter}>
            <Plus />
            Add habit after
            <DropdownMenuShortcut>o</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onAddBefore}>
            <Plus />
            Add habit before
            <DropdownMenuShortcut>O</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onMove("up")}>
            <ArrowUp /> Move up
            <DropdownMenuShortcut>^k</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMove("down")}>
            <ArrowDown /> Move down
            <DropdownMenuShortcut>^j</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMove("left")}>
            <ArrowLeft /> Move left
            <DropdownMenuShortcut>^h</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMove("right")}>
            <ArrowRight /> Move right
            <DropdownMenuShortcut>^l</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onArchive}>
          <Archive /> Archive
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 /> Delete permanently
          <DropdownMenuShortcut>d</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    )}
  </DropdownMenu>
);

export const HabitCard = ({
  habit,
  columns,
}: {
  habit: HabitMetricWithRoutine;
  columns: RoutineColumn[];
}) => {
  const dispatch = useAsyncDispatch();
  const ref = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const skipNextMenuCloseFocusRef = useRef(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [isMoveRoutineModalOpen, setIsMoveRoutineModalOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(habit.title);
  const focusKey = buildFocusKey(habit.id, habitType);
  const isFocused = useFocusStore(
    (state) => !state.isFocusDisabled && state.focusItemKey === focusKey,
  );
  const isEditing = useFocusStore(
    (state) => !state.isFocusDisabled && state.editItemKey === focusKey,
  );

  const focusCard = useCallback(() => {
    window.setTimeout(() => {
      const element =
        ref.current ??
        document.querySelector<HTMLElement>(
          `[data-focusable-key="${CSS.escape(focusKey)}"]`,
        );
      element?.focus({ preventScroll: true });
      element?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, 0);
  }, [focusKey]);

  const persistTitle = useCallback(() => {
    if (draftTitle !== habit.title) {
      void dispatch(
        updateHabit({ id: habit.id, habit: { title: draftTitle } }),
      );
    }
  }, [dispatch, draftTitle, habit.id, habit.title]);

  const beginEdit = useCallback(() => {
    setDraftTitle(habit.title);
    useFocusStore.getState().editByKey(focusKey);
  }, [focusKey, habit.title]);

  const openMoveRoutineModal = useCallback(() => {
    ref.current?.focus({ preventScroll: true });
    setIsMoveRoutineModalOpen(true);
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    window.requestAnimationFrame(() => {
      if (titleRef.current) focusTextareaAtEnd(titleRef.current);
    });
  }, [isEditing]);

  const toggle = useCallback(() => {
    void dispatch(toggleHabitToday({ habitId: habit.id }));
  }, [dispatch, habit.id]);

  const move = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (direction === "left" || direction === "right") {
        const target = getDOMColumnSiblingDropTarget(focusKey, direction);
        if (!target) return;
        const parsed = parseColumnKey(target.targetKey);
        void (async () => {
          await dispatch(
            appHandleDrop({
              id: parsed.id,
              modelType: parsed.type,
              dropId: habit.id,
              dropModelType: habitType,
              edge: target.edge,
            }),
          );
          focusCard();
        })();
        return;
      }

      const [up, down] = getDOMSiblings(focusKey, { forMove: true });
      const targetKey = direction === "up" ? up : down;
      if (!targetKey) return;
      const target = parseColumnKey(targetKey);
      if (target.type !== habitType) return;
      void (async () => {
        await dispatch(
          appHandleDrop({
            id: target.id,
            modelType: target.type,
            dropId: habit.id,
            dropModelType: habitType,
            edge: direction === "up" ? "top" : "bottom",
          }),
        );
        focusCard();
      })();
    },
    [dispatch, focusCard, focusKey, habit.id],
  );

  const deleteHabit = useCallback(() => {
    if (!window.confirm("Permanently delete this habit and its history?"))
      return false;
    const [up, down] = getDOMSiblings(focusKey);
    void dispatch(deleteHabits({ ids: [habit.id] }));
    const next = down ?? up;
    if (next) useFocusStore.getState().focusByKey(next);
    else useFocusStore.getState().resetFocus();
    return true;
  }, [dispatch, focusKey, habit.id]);

  const archive = useCallback(() => {
    if (!window.confirm("Archive this habit?")) return false;
    void dispatch(archiveHabit({ id: habit.id }));
    useFocusStore.getState().resetFocus();
    return true;
  }, [dispatch, habit.id]);

  const addAdjacent = useCallback(
    (edge: "top" | "bottom") => {
      void (async () => {
        const created = await dispatch(
          createHabit({
            habit: { title: "New habit", routineId: habit.routineId },
          }),
        );
        await dispatch(
          moveHabit({
            id: created.id,
            routineId: habit.routineId,
            position: { targetId: habit.id, edge },
          }),
        );
        useFocusStore
          .getState()
          .editByKey(buildFocusKey(created.id, habitType));
      })();
    },
    [dispatch, habit.id, habit.routineId],
  );

  const addAfter = useCallback(() => addAdjacent("bottom"), [addAdjacent]);

  const setTargetTime = useCallback(() => {
    void (async () => {
      const value = await promptDialog(
        "Target time (HH:MM, leave empty to clear)",
        habit.targetTime ?? "",
      );
      if (value === null) return;
      const targetTime = normalizeTargetTimeInput(value);
      if (targetTime === undefined) {
        window.alert("Enter a valid 24-hour time in HH:MM format.");
        focusCard();
        return;
      }
      await dispatch(
        updateHabit({
          id: habit.id,
          habit: { targetTime },
        }),
      );
      focusCard();
    })();
  }, [dispatch, focusCard, habit.id, habit.targetTime]);

  const runShortcut = useCallback(
    (shortcut: HabitShortcut) => {
      if (shortcut === "toggle") toggle();
      else if (shortcut === "edit") beginEdit();
      else if (shortcut === "actions") setActionsOpen(true);
      else if (shortcut === "details")
        useItemDetailsOpen.getState().toggle();
      else if (shortcut === "move-routine") openMoveRoutineModal();
      else if (shortcut === "add-after") addAdjacent("bottom");
      else if (shortcut === "add-before") addAdjacent("top");
      else if (shortcut === "delete") deleteHabit();
      else if (shortcut === "escape") useFocusStore.getState().resetFocus();
      else {
        move(shortcut.replace("move-", "") as "up" | "down" | "left" | "right");
      }
    },
    [addAdjacent, beginEdit, deleteHabit, move, openMoveRoutineModal, toggle],
  );

  const handleShortcut = useCallback(
    (event: KeyboardEvent) => {
      if (!isFocused || actionsOpen || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target && isInputElement(target)) return;
      const shortcut = getHabitShortcut(event);
      if (!shortcut) return;
      event.preventDefault();

      runShortcut(shortcut);
    },
    [actionsOpen, isFocused, runShortcut],
  );
  useGlobalListener("keydown", handleShortcut);

  const handleActionsShortcut = useCallback(
    (event: ReactKeyboardEvent) => {
      const shortcut = getHabitShortcut(event);
      if (!shortcut || shortcut === "actions" || shortcut === "escape") return;
      event.preventDefault();
      event.stopPropagation();
      setActionsOpen(false);
      window.setTimeout(() => runShortcut(shortcut), 0);
    },
    [runShortcut],
  );

  const suspendCardDragForInput = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target =
        event.target instanceof Element ? event.target : document.activeElement;
      if (target && isInputElement(target)) {
        ref.current?.setAttribute("draggable", "false");
      }
    },
    [],
  );

  const restoreCardDrag = useCallback(() => {
    ref.current?.setAttribute("draggable", "true");
  }, []);

  useEffect(() => {
    const element = ref.current;
    invariant(element);
    return combine(
      draggable({
        element,
        getInitialData: (): DndModelData => ({
          modelId: habit.id,
          modelType: habitType,
        }),
        onGenerateDragPreview: ({ location, source, nativeSetDragImage }) => {
          const rect = source.element.getBoundingClientRect();
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: preserveOffsetOnSource({
              element,
              input: location.current.input,
            }),
            render({ container }) {
              const preview = createElementDragPreview({
                source: source.element,
                rect,
              });
              container.appendChild(preview);
              return () => preview.remove();
            },
          });
        },
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          isModelDNDData(source.data) &&
          source.data.modelType === habitType &&
          source.data.modelId !== habit.id,
        getIsSticky: () => true,
        getData: ({ input, element: targetElement }) =>
          attachClosestEdge(
            { modelId: habit.id, modelType: habitType } satisfies DndModelData,
            { input, element: targetElement, allowedEdges: ["top", "bottom"] },
          ),
        onDragEnter: ({ self }) =>
          setClosestEdge(extractClosestEdge(self.data)),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      }),
    );
  }, [habit.id]);

  return (
    <div className="relative">
      {closestEdge === "top" && <DropTaskIndicator direction="top" />}
      <div
        ref={ref}
        tabIndex={0}
        data-focusable-key={focusKey}
        data-order-token={habit.orderToken}
        className={taskCardClassName({
          isFocused,
          isDone: habit.isDoneToday,
        })}
        onClick={() => useFocusStore.getState().focusByKey(focusKey, true)}
        onBlur={(event) => {
          if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
          ) {
            return;
          }
          event.currentTarget.removeAttribute("data-suppress-focus-visible");
        }}
        onDoubleClick={beginEdit}
        onPointerDownCapture={suspendCardDragForInput}
        onPointerUpCapture={restoreCardDrag}
        onPointerCancelCapture={restoreCardDrag}
      >
        <div
          className={taskCardBodyClassName({
            isFocused,
            isDone: habit.isDoneToday,
          })}
        >
          <div className="absolute right-1.5 top-1.5 z-10">
            <HabitActionsMenu
              habit={habit}
              columns={columns}
              isFocused={isFocused}
              open={actionsOpen}
              onOpenChange={setActionsOpen}
              onToggle={toggle}
              onEdit={() => {
                skipNextMenuCloseFocusRef.current = true;
                beginEdit();
              }}
              onSetTime={() => {
                skipNextMenuCloseFocusRef.current = true;
                setTargetTime();
              }}
              onMoveRoutine={(routineId) =>
                void dispatch(
                  moveHabit({ id: habit.id, routineId, position: "append" }),
                )
              }
              onAddAfter={() => {
                skipNextMenuCloseFocusRef.current = true;
                addAfter();
              }}
              onAddBefore={() => {
                skipNextMenuCloseFocusRef.current = true;
                addAdjacent("top");
              }}
              onMove={move}
              onArchive={() => {
                if (archive()) skipNextMenuCloseFocusRef.current = true;
              }}
              onDelete={() => {
                if (deleteHabit()) skipNextMenuCloseFocusRef.current = true;
              }}
              onShortcutKeyDown={handleActionsShortcut}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                if (skipNextMenuCloseFocusRef.current) {
                  skipNextMenuCloseFocusRef.current = false;
                  return;
                }
                focusCard();
              }}
            />
          </div>
          <div className="flex items-start gap-1.5 rounded-t-lg px-2 pt-2 pr-6 font-medium">
            <div className="flex justify-end">
              <CheckboxComp
                checked={habit.isDoneToday}
                onChange={toggle}
                ariaLabel={
                  habit.isDoneToday
                    ? `Mark ${habit.title} as todo`
                    : `Mark ${habit.title} as done`
                }
              />
            </div>
            {isEditing ? (
              <TextareaAutosize
                ref={titleRef}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={() => {
                  persistTitle();
                  useFocusStore.getState().resetEdit();
                }}
                onKeyDown={(event) => {
                  if (
                    (event.key === "Enter" && !event.shiftKey) ||
                    event.key === "Escape"
                  ) {
                    event.preventDefault();
                    event.stopPropagation();
                    persistTitle();
                    useFocusStore.getState().resetEdit();
                    focusCard();
                  }
                }}
                onPointerDown={(event) => event.stopPropagation()}
                data-task-title-input
                aria-label="Edit habit title"
                className="min-h-5 w-full resize-none bg-transparent focus:outline-none"
              />
            ) : (
              <div
                className={cn("min-h-5", habit.isDoneToday && "line-through")}
              >
                {habit.title}
              </div>
            )}
          </div>
        </div>
        <div
          className={cn(
            taskCardFooterClassName({ isDone: habit.isDoneToday }),
            "flex items-center justify-between gap-2",
          )}
        >
          <span>{habit.targetTime ?? "Any time"}</span>
          <span className="min-w-0 truncate">
            {habit.lastCompletedAt
              ? formatDistanceToNow(habit.lastCompletedAt, { addSuffix: true })
              : "Never completed"}
          </span>
          <span
            className="flex shrink-0 items-center gap-1 tabular-nums"
            title="Current streak"
          >
            <Flame
              className={cn(
                "size-3.5",
                habit.currentStreak > 0 && "fill-accent text-accent",
              )}
            />
            {habit.currentStreak}
          </span>
        </div>
      </div>
      {closestEdge === "bottom" && <DropTaskIndicator direction="bottom" />}
      {isMoveRoutineModalOpen && (
        <MoveDestinationModal
          setIsOpen={setIsMoveRoutineModalOpen}
          handleMove={(destinationId) => {
            setIsMoveRoutineModalOpen(false);
            void (async () => {
              await dispatch(
                moveHabit({
                  id: habit.id,
                  routineId:
                    destinationId === UNASSIGNED_ROUTINE_ID
                      ? null
                      : destinationId,
                  position: "append",
                }),
              );

              window.requestAnimationFrame(() => {
                document
                  .querySelector<HTMLElement>(
                    `[data-focusable-key="${focusKey}"]`,
                  )
                  ?.focus({ preventScroll: true });
              });
            })();
          }}
          destinations={[
            { id: UNASSIGNED_ROUTINE_ID, title: "Unassigned" },
            ...columns.flatMap((column) =>
              column.routine
                ? [{ id: column.routine.id, title: column.routine.title }]
                : [],
            ),
          ]}
          title="Choose routine"
          searchPlaceholder="Search routines..."
        />
      )}
    </div>
  );
};
