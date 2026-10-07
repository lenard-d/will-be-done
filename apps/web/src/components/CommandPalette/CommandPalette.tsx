import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  FolderKanban,
  FolderInput,
  Keyboard,
  PanelLeft,
  Pencil,
  Plus,
  Repeat2,
  Settings,
  SlidersHorizontal,
  SquareKanban,
  Trash2,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { format, startOfWeek } from "date-fns";
import {
  useAsyncDispatch,
  useAsyncSelector,
} from "@will-be-done/hyperdb/react";
import {
  activeHabits,
  activeRoutines,
  addToDailyList,
  allProjectsSorted,
  allTasksForDisplay,
  allTasks,
  archiveHabit,
  createDailyListIfNotPresent,
  createProject,
  dailyEntryType,
  deleteHabits,
  deleteTasks,
  getDMY,
  habitType,
  isTask,
  moveHabit,
  moveTaskToProject,
  stashEntryType,
  taskType,
  toggleHabitToday,
  toggleTaskState,
} from "@will-be-done/slices/space";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { promptDialog } from "@/components/ui/prompt-dialog-service";
import { isDemoMode, authUtils } from "@/lib/auth";
import { useItemDetailsOpen } from "@/components/ItemDetails/ItemDetailsStore";
import { parseColumnKey, useFocusStore } from "@/store/focusSlice";
import { useTaskCommandHistory } from "@/hooks/useTaskCommandHistory";
import { useSpaceSettingsStore } from "@/components/SpaceSettings/spaceSettingsStore";
import { useStashOpen } from "@/components/DaysBoard/StashStore";
import { Route } from "@/routes/spaces.$spaceId";
import { getShortcutLabel } from "@/components/SpaceSettings/shortcutCatalog";
import {
  COMMAND_PALETTE_GROUPS,
  isCommandPaletteShortcut,
  type CommandPaletteGroupId,
} from "./commandPaletteCatalog";

import {
  FocusedTaskShortcutCommands,
  type TaskShortcutEvent,
} from "./FocusedTaskShortcutCommands";

export const TOGGLE_SIDEBAR_EVENT = "wbd:toggle-sidebar";

type PaletteCommandId =
  | "create-project"
  | "switch-space"
  | "tasks-tab"
  | "timeline-tab"
  | "habits-tab"
  | "space-settings"
  | "toggle-sidebar"
  | "toggle-stash"
  | "toggle-details"
  | "stats-view"
  | "keyboard-shortcuts"
  | "cycle-task-sort"
  | "undo-task"
  | "redo-task";

type PaletteCommand = {
  id: PaletteCommandId;
  group: CommandPaletteGroupId;
  label: string;
  keywords: string;
  icon: LucideIcon;
  shortcut?: string;
};

const PALETTE_COMMANDS: readonly PaletteCommand[] = [
  {
    id: "keyboard-shortcuts",
    group: "settings",
    label: "Keyboard shortcuts",
    keywords: "keys shortcuts reference help",
    icon: Keyboard,
  },
  {
    id: "cycle-task-sort",
    group: "views",
    label: "Cycle task sort",
    keywords: "sort planned day alphabetical manual",
    icon: SlidersHorizontal,
    shortcut: getShortcutLabel("task-sort-cycle"),
  },
  {
    id: "undo-task",
    group: "actions",
    label: "Undo task change",
    keywords: "undo restore",
    icon: Clock3,
    shortcut: getShortcutLabel("task-undo"),
  },
  {
    id: "redo-task",
    group: "actions",
    label: "Redo task change",
    keywords: "redo repeat",
    icon: Clock3,
    shortcut: getShortcutLabel("task-redo"),
  },
  {
    id: "create-project",
    group: "actions",
    label: "Create project",
    keywords: "new add project",
    icon: Plus,
  },
  {
    id: "switch-space",
    group: "actions",
    label: "Switch space",
    keywords: "spaces workspace",
    icon: SquareKanban,
  },
  {
    id: "tasks-tab",
    group: "tabs",
    label: "Tasks",
    keywords: "tasks projects all plan",
    icon: FolderKanban,
  },
  {
    id: "timeline-tab",
    group: "tabs",
    label: "Timeline",
    keywords: "timeline week schedule",
    icon: CalendarDays,
  },
  {
    id: "habits-tab",
    group: "tabs",
    label: "Habits",
    keywords: "habits routines",
    icon: Repeat2,
  },
  {
    id: "space-settings",
    group: "settings",
    label: "Space settings",
    keywords: "settings preferences configuration",
    icon: Settings,
  },
  {
    id: "toggle-sidebar",
    group: "views",
    label: "Toggle main sidebar",
    keywords: "sidebar navigation panel",
    icon: PanelLeft,
    shortcut: getShortcutLabel("sidebar-toggle"),
  },
  {
    id: "toggle-stash",
    group: "views",
    label: "Toggle stash",
    keywords: "stash tasks later",
    icon: WalletCards,
    shortcut: getShortcutLabel("stash-toggle"),
  },
  {
    id: "toggle-details",
    group: "views",
    label: "Toggle card details",
    keywords: "details inspector card",
    icon: SlidersHorizontal,
    shortcut: getShortcutLabel("card-details-toggle"),
  },
  {
    id: "stats-view",
    group: "views",
    label: "Open statistics",
    keywords: "stats habits metrics",
    icon: BarChart3,
  },
];

function getSpaceName(spaceId: string) {
  return isDemoMode()
    ? "Demo Space"
    : (authUtils.getSpaceName(spaceId) ?? spaceId);
}

export function CommandPalette() {
  const { spaceId } = Route.useParams();
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const dispatch = useAsyncDispatch();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const actionAfterClose = useRef<(() => void) | null>(null);
  const { data: projects = [] } = useAsyncSelector({
    selector: allProjectsSorted,
    args: {},
  });
  const { data: tasks = [] } = useAsyncSelector({
    selector: allTasks,
    args: {},
  });
  const { data: taskResults = [] } = useAsyncSelector({
    selector: allTasksForDisplay,
    args: {},
  });
  const matchingTasks = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    if (!search) return [];
    return taskResults
      .filter(({ item, project }) =>
        `${item.title} ${project.title}`.toLocaleLowerCase().includes(search),
      )
      .slice(0, 50);
  }, [query, taskResults]);
  const { data: habits = [] } = useAsyncSelector({
    selector: activeHabits,
    args: {},
  });
  const { data: routines = [] } = useAsyncSelector({
    selector: activeRoutines,
    args: {},
  });
  const focusItemKey = useFocusStore((state) => state.focusItemKey);
  const focusedItem = useMemo(
    () => (focusItemKey ? parseColumnKey(focusItemKey) : null),
    [focusItemKey],
  );
  const focusedTask = useMemo(
    () =>
      focusedItem &&
      (focusedItem.type === taskType ||
        focusedItem.type === dailyEntryType ||
        focusItemKey?.startsWith(`${stashEntryType}^^`))
        ? tasks.find((task) => task.id === focusedItem.id)
        : undefined,
    [focusItemKey, focusedItem, tasks],
  );
  const focusedHabit = useMemo(
    () =>
      focusedItem?.type === habitType
        ? habits.find((habit) => habit.id === focusedItem.id)
        : undefined,
    [focusedItem, habits],
  );
  const focusedTaskIsScheduled = !!taskResults.find(
    ({ item, dailyList }) => item.id === focusedTask?.id && dailyList,
  );
  const openSettings = useSpaceSettingsStore((state) => state.openSettings);
  const openShortcuts = useSpaceSettingsStore((state) => state.openShortcuts);
  const isEditing = useFocusStore(
    (state) => !!state.editItemKey || state.isFocusDisabled,
  );
  const toggleStash = useStashOpen((state) => state.toggle);
  const toggleDetails = useItemDetailsOpen((state) => state.toggle);
  const setDetailsOpen = useItemDetailsOpen((state) => state.setOpen);
  const { executeTaskCommand, undoTaskCommand, redoTaskCommand } =
    useTaskCommandHistory();

  const runShortcut = useCallback(
    (shortcut: TaskShortcutEvent) => {
      actionAfterClose.current = () => {
        if (focusItemKey) {
          document
            .querySelector<HTMLElement>(
              `[data-focusable-key="${focusItemKey}"]`,
            )
            ?.focus({ preventScroll: true });
        } else if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            ...shortcut,
            bubbles: true,
            cancelable: true,
          }),
        );
      };
      setOpen(false);
    },
    [focusItemKey],
  );

  const openTaskResult = useCallback(
    (taskId: string) => {
      setOpen(false);
      void navigate({
        to: "/spaces/$spaceId/item-details/$itemId",
        params: { spaceId, itemId: taskId },
      });
    },
    [navigate, spaceId],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isCommandPaletteShortcut(event)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      setQuery("");
      setOpen((isOpen) => !isOpen);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  const navigateToTasks = useCallback(() => {
    void navigate({
      to: "/spaces/$spaceId/all-tasks",
      params: { spaceId },
    });
  }, [navigate, spaceId]);

  const navigateToTimeline = useCallback(() => {
    void navigate({
      to: "/spaces/$spaceId/timeline/$date",
      params: {
        spaceId,
        date: format(
          startOfWeek(new Date(), { weekStartsOn: 1 }),
          "yyyy-MM-dd",
        ),
      },
      search: { projectId: "inbox" },
    });
  }, [navigate, spaceId]);

  const navigateToHabits = useCallback(() => {
    void navigate({ to: "/spaces/$spaceId/habits", params: { spaceId } });
  }, [navigate, spaceId]);

  const createNewProject = useCallback(async () => {
    const title = await promptDialog("Enter project title");
    if (!title?.trim()) return;
    await dispatch(
      createProject({ project: { title: title.trim() }, position: "append" }),
    );
  }, [dispatch]);

  const editFocusedItem = useCallback(() => {
    if (!focusItemKey) return;
    actionAfterClose.current = () =>
      useFocusStore.getState().editByKey(focusItemKey);
    setOpen(false);
  }, [focusItemKey]);

  const openFocusedItemDetails = useCallback(() => {
    setOpen(false);
    setDetailsOpen(true);
  }, [setDetailsOpen]);

  const toggleFocusedTask = useCallback(() => {
    if (!focusedTask) return;
    setOpen(false);
    void executeTaskCommand([focusedTask.id], () =>
      dispatch(toggleTaskState({ taskId: focusedTask.id })),
    );
  }, [dispatch, executeTaskCommand, focusedTask]);

  const scheduleFocusedTaskToday = useCallback(() => {
    if (!focusedTask) return;
    setOpen(false);
    void executeTaskCommand([focusedTask.id], async () => {
      const dailyList = await dispatch(
        createDailyListIfNotPresent({ date: getDMY(new Date()) }),
      );
      await dispatch(
        addToDailyList({
          taskId: focusedTask.id,
          dailyListId: dailyList.id,
          position: "append",
        }),
      );
    });
  }, [dispatch, executeTaskCommand, focusedTask]);

  const moveFocusedTask = useCallback(
    (projectId: string) => {
      if (!focusedTask) return;
      setOpen(false);
      void executeTaskCommand([focusedTask.id], () =>
        dispatch(moveTaskToProject({ taskId: focusedTask.id, projectId })),
      );
    },
    [dispatch, executeTaskCommand, focusedTask],
  );

  const deleteFocusedTask = useCallback(() => {
    if (
      !focusedTask ||
      !window.confirm(`Permanently delete "${focusedTask.title}"?`)
    ) {
      return;
    }
    setOpen(false);
    void executeTaskCommand([focusedTask.id], () =>
      dispatch(deleteTasks({ ids: [focusedTask.id] })),
    );
    useFocusStore.getState().resetFocus();
  }, [dispatch, executeTaskCommand, focusedTask]);

  const toggleFocusedHabit = useCallback(() => {
    if (!focusedHabit) return;
    setOpen(false);
    void dispatch(toggleHabitToday({ habitId: focusedHabit.id }));
  }, [dispatch, focusedHabit]);

  const moveFocusedHabit = useCallback(
    (routineId: string | null) => {
      if (!focusedHabit) return;
      setOpen(false);
      void dispatch(
        moveHabit({ id: focusedHabit.id, routineId, position: "append" }),
      );
    },
    [dispatch, focusedHabit],
  );

  const archiveFocusedHabit = useCallback(() => {
    if (!focusedHabit || !window.confirm(`Archive "${focusedHabit.title}"?`))
      return;
    setOpen(false);
    void dispatch(archiveHabit({ id: focusedHabit.id }));
    useFocusStore.getState().resetFocus();
  }, [dispatch, focusedHabit]);

  const deleteFocusedHabit = useCallback(() => {
    if (
      !focusedHabit ||
      !window.confirm(
        `Permanently delete "${focusedHabit.title}" and its history?`,
      )
    ) {
      return;
    }
    setOpen(false);
    void dispatch(deleteHabits({ ids: [focusedHabit.id] }));
    useFocusStore.getState().resetFocus();
  }, [dispatch, focusedHabit]);

  const runCommand = useCallback(
    (commandId: PaletteCommandId) => {
      setOpen(false);

      switch (commandId) {
        case "keyboard-shortcuts":
          openShortcuts(getSpaceName(spaceId));
          break;
        case "cycle-task-sort":
          runShortcut({ code: "KeyQ" });
          break;
        case "undo-task":
          void undoTaskCommand();
          break;
        case "redo-task":
          void redoTaskCommand();
          break;
        case "create-project":
          void createNewProject();
          break;
        case "switch-space":
          void navigate({ to: "/spaces" });
          break;
        case "tasks-tab":
          navigateToTasks();
          break;
        case "timeline-tab":
          navigateToTimeline();
          break;
        case "habits-tab":
          navigateToHabits();
          break;
        case "space-settings":
          openSettings(getSpaceName(spaceId));
          break;
        case "toggle-sidebar":
          window.dispatchEvent(new Event(TOGGLE_SIDEBAR_EVENT));
          break;
        case "toggle-stash":
          toggleStash();
          break;
        case "toggle-details":
          toggleDetails();
          break;
        case "stats-view":
          void navigate({ to: "/spaces/$spaceId/stats", params: { spaceId } });
          break;
        default: {
          const exhaustiveCommandId: never = commandId;
          return exhaustiveCommandId;
        }
      }
    },
    [
      createNewProject,
      navigate,
      navigateToHabits,
      navigateToTasks,
      navigateToTimeline,
      openSettings,
      openShortcuts,
      runShortcut,
      undoTaskCommand,
      redoTaskCommand,
      spaceId,
      toggleDetails,
      toggleStash,
    ],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
      onCloseAutoFocus={(event) => {
        const action = actionAfterClose.current;
        if (!action) return;
        actionAfterClose.current = null;
        event.preventDefault();
        action();
      }}
      title="Command bar"
      description="Search tasks, projects, views, and actions."
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search tasks, actions, projects..."
      />
      <CommandList>
        <CommandEmpty>No matching tasks or commands.</CommandEmpty>
        {matchingTasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {matchingTasks.map(({ item, project, dailyList }) => (
              <CommandItem
                key={item.id}
                value={`task ${item.id} ${item.title} ${project.title}`}
                onSelect={() => openTaskResult(item.id)}
              >
                {isTask(item) && item.state === "done" ? (
                  <Check />
                ) : (
                  <FolderKanban />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {item.title || "Untitled task"}
                  </span>
                  <span className="block truncate text-xs text-content-tinted">
                    {project.title}
                    {dailyList ? ` · ${dailyList.date}` : ""}
                    {isTask(item) && item.state === "done" ? " · Done" : ""}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {focusedTask && (
          <CommandGroup heading={`Task · ${focusedTask.title}`}>
            <FocusedTaskShortcutCommands
              task={focusedTask}
              isScheduled={focusedTaskIsScheduled}
              isStashed={!!focusItemKey?.startsWith(`${stashEntryType}^^`)}
              isEditing={isEditing}
              onRunShortcut={runShortcut}
            />
            <CommandItem
              disabled={isEditing}
              value={`${focusedTask.state === "done" ? "Mark as todo" : "Mark as done"} task toggle complete`}
              onSelect={toggleFocusedTask}
            >
              <Check />
              <span>
                {focusedTask.state === "done" ? "Mark as todo" : "Mark as done"}
              </span>
              <CommandShortcut>
                {getShortcutLabel("task-toggle-state")}
              </CommandShortcut>
            </CommandItem>
            <CommandItem
              disabled={isEditing}
              value="Edit task title rename"
              onSelect={editFocusedItem}
            >
              <Pencil />
              <span>Edit task title</span>
              <CommandShortcut>
                {getShortcutLabel("task-edit-title")}
              </CommandShortcut>
            </CommandItem>
            <CommandItem
              disabled={isEditing}
              value="Open task details inspect"
              onSelect={openFocusedItemDetails}
            >
              <SlidersHorizontal />
              <span>Open task details</span>
              <CommandShortcut>
                {getShortcutLabel("card-details-toggle")}
              </CommandShortcut>
            </CommandItem>
            <CommandItem
              disabled={isEditing}
              value="Schedule for today task date"
              onSelect={scheduleFocusedTaskToday}
            >
              <Clock3 />
              <span>Schedule for today</span>
              <CommandShortcut>
                {getShortcutLabel("task-schedule-today")}
              </CommandShortcut>
            </CommandItem>
            {projects.map((project) => (
              <CommandItem
                disabled={isEditing}
                key={`move-task-${project.id}`}
                value={`task move project ${project.title}`}
                onSelect={() => moveFocusedTask(project.id)}
              >
                <span className="w-4 shrink-0 text-center text-base leading-none">
                  {project.icon || "🟡"}
                </span>
                <span>Move task to {project.title}</span>
              </CommandItem>
            ))}
            <CommandItem
              className="text-red-400 data-[selected=true]:text-white"
              disabled={isEditing}
              value="Delete task remove permanently"
              onSelect={deleteFocusedTask}
            >
              <Trash2 />
              <span>Delete task</span>
              {focusedItem?.type === dailyEntryType ? (
                <CommandShortcut>
                  {getShortcutLabel("task-delete-scheduled")}
                </CommandShortcut>
              ) : focusedItem?.type === taskType ? (
                <CommandShortcut>
                  {getShortcutLabel("task-remove")}
                </CommandShortcut>
              ) : null}
            </CommandItem>
          </CommandGroup>
        )}
        {focusedHabit && (
          <CommandGroup heading={`Habit · ${focusedHabit.title}`}>
            <CommandItem
              value="Toggle today’s completion habit done todo"
              onSelect={toggleFocusedHabit}
            >
              <Check />
              <span>Toggle today’s completion</span>
              <CommandShortcut>
                {getShortcutLabel("task-toggle-state")}
              </CommandShortcut>
            </CommandItem>
            <CommandItem
              value="Edit habit title rename"
              onSelect={editFocusedItem}
            >
              <Pencil />
              <span>Edit habit title</span>
              <CommandShortcut>
                {getShortcutLabel("task-edit-title")}
              </CommandShortcut>
            </CommandItem>
            <CommandItem
              value="Open habit details inspect"
              onSelect={openFocusedItemDetails}
            >
              <SlidersHorizontal />
              <span>Open habit details</span>
              <CommandShortcut>
                {getShortcutLabel("card-details-toggle")}
              </CommandShortcut>
            </CommandItem>
            <CommandItem
              value="Move habit to unassigned routine"
              onSelect={() => moveFocusedHabit(null)}
            >
              <FolderInput />
              <span>Move habit to unassigned</span>
            </CommandItem>
            {routines.map((routine) => (
              <CommandItem
                key={`move-habit-${routine.id}`}
                value={`habit move routine ${routine.title}`}
                onSelect={() => moveFocusedHabit(routine.id)}
              >
                <FolderInput />
                <span>Move habit to {routine.title}</span>
              </CommandItem>
            ))}
            <CommandItem value="Archive habit" onSelect={archiveFocusedHabit}>
              <Archive />
              <span>Archive habit</span>
            </CommandItem>
            <CommandItem
              className="text-red-400 data-[selected=true]:text-white"
              value="Delete habit remove permanently"
              onSelect={deleteFocusedHabit}
            >
              <Trash2 />
              <span>Delete habit</span>
              <CommandShortcut>
                {getShortcutLabel("task-remove")}
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}
        {COMMAND_PALETTE_GROUPS.map((group) => {
          const commands = PALETTE_COMMANDS.filter(
            (command) => command.group === group.id,
          );
          const projectsForGroup = group.id === "projects" ? projects : [];

          return (
            <CommandGroup key={group.id} heading={group.label}>
              {commands.map((command) => {
                const Icon = command.icon;
                return (
                  <CommandItem
                    key={command.id}
                    value={`${command.label} ${command.keywords}`}
                    disabled={
                      (command.id === "toggle-details" &&
                        !focusedTask &&
                        !focusedHabit) ||
                      (command.id === "cycle-task-sort" &&
                        !/\/(all-tasks|projects|timeline|dates)(\/|$)/.test(
                          pathname,
                        ))
                    }
                    onSelect={() => runCommand(command.id)}
                  >
                    <Icon />
                    <span>{command.label}</span>
                    {command.shortcut && (
                      <CommandShortcut>{command.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                );
              })}
              {projectsForGroup.map((project) => {
                return (
                  <CommandItem
                    key={`project-${project.id}`}
                    value={`project ${project.title}`}
                    onSelect={() => {
                      setOpen(false);
                      void navigate({
                        to: "/spaces/$spaceId/projects/$projectId",
                        params: { spaceId, projectId: project.id },
                      });
                    }}
                  >
                    <span className="w-4 shrink-0 text-center text-base leading-none">
                      {project.icon || "🟡"}
                    </span>
                    <span className="truncate">{project.title}</span>
                    {project.isInbox && (
                      <CommandShortcut>Inbox</CommandShortcut>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
