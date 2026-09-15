import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  FolderKanban,
  FolderInput,
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
import { useNavigate } from "@tanstack/react-router";
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
  allTasks,
  archiveHabit,
  createDailyListIfNotPresent,
  createProject,
  dailyEntryType,
  deleteHabits,
  deleteTasks,
  getDMY,
  habitType,
  moveHabit,
  moveTaskToProject,
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
import {
  COMMAND_PALETTE_GROUPS,
  isCommandPaletteShortcut,
  type CommandPaletteGroupId,
} from "./commandPaletteCatalog";

export const TOGGLE_SIDEBAR_EVENT = "wbd:toggle-sidebar";

type PaletteCommandId =
  | "create-project"
  | "switch-space"
  | "projects-tab"
  | "timeline-tab"
  | "habits-tab"
  | "space-settings"
  | "toggle-sidebar"
  | "toggle-stash"
  | "toggle-details"
  | "stats-view";

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
    id: "projects-tab",
    group: "tabs",
    label: "Projects",
    keywords: "projects today plan",
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
    shortcut: "⌘/Ctrl B",
  },
  {
    id: "toggle-stash",
    group: "views",
    label: "Toggle stash",
    keywords: "stash tasks later",
    icon: WalletCards,
    shortcut: "\\",
  },
  {
    id: "toggle-details",
    group: "views",
    label: "Toggle card details",
    keywords: "details inspector card",
    icon: SlidersHorizontal,
    shortcut: "V",
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
  const dispatch = useAsyncDispatch();
  const [open, setOpen] = useState(false);
  const { data: projects = [] } = useAsyncSelector({
    selector: allProjectsSorted,
    args: {},
  });
  const { data: tasks = [] } = useAsyncSelector({ selector: allTasks, args: {} });
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
      (focusedItem.type === taskType || focusedItem.type === dailyEntryType)
        ? tasks.find((task) => task.id === focusedItem.id)
        : undefined,
    [focusedItem, tasks],
  );
  const focusedHabit = useMemo(
    () =>
      focusedItem?.type === habitType
        ? habits.find((habit) => habit.id === focusedItem.id)
        : undefined,
    [focusedItem, habits],
  );
  const openSettings = useSpaceSettingsStore((state) => state.openSettings);
  const toggleStash = useStashOpen((state) => state.toggle);
  const toggleDetails = useItemDetailsOpen((state) => state.toggle);
  const setDetailsOpen = useItemDetailsOpen((state) => state.setOpen);
  const { executeTaskCommand } = useTaskCommandHistory();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isCommandPaletteShortcut(event)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen((isOpen) => !isOpen);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  const navigateToProjects = useCallback(() => {
    void navigate({
      to: "/spaces/$spaceId/dates/$date",
      params: { spaceId, date: format(new Date(), "yyyy-MM-dd") },
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
    setOpen(false);
    window.setTimeout(() => useFocusStore.getState().editByKey(focusItemKey), 0);
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
        case "create-project":
          void createNewProject();
          break;
        case "switch-space":
          void navigate({ to: "/spaces" });
          break;
        case "projects-tab":
          navigateToProjects();
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
      navigateToProjects,
      navigateToTimeline,
      openSettings,
      spaceId,
      toggleDetails,
      toggleStash,
    ],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Quick navigation"
      description="Navigate to a view, project, setting, or action."
    >
      <CommandInput placeholder="Search actions, views, projects..." />
      <CommandList>
        <CommandEmpty>No matching navigation found.</CommandEmpty>
        {focusedTask && (
          <CommandGroup heading={`Task · ${focusedTask.title}`}>
            <CommandItem value="task toggle done todo complete" onSelect={toggleFocusedTask}>
              <Check />
              <span>{focusedTask.state === "done" ? "Mark as todo" : "Mark as done"}</span>
            </CommandItem>
            <CommandItem value="task edit title rename" onSelect={editFocusedItem}>
              <Pencil />
              <span>Edit task title</span>
            </CommandItem>
            <CommandItem value="task details inspect open" onSelect={openFocusedItemDetails}>
              <SlidersHorizontal />
              <span>Open task details</span>
            </CommandItem>
            <CommandItem value="task schedule today date" onSelect={scheduleFocusedTaskToday}>
              <Clock3 />
              <span>Schedule for today</span>
            </CommandItem>
            {projects.map((project) => (
              <CommandItem
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
              value="task delete remove permanently"
              onSelect={deleteFocusedTask}
            >
              <Trash2 />
              <span>Delete task</span>
            </CommandItem>
          </CommandGroup>
        )}
        {focusedHabit && (
          <CommandGroup heading={`Habit · ${focusedHabit.title}`}>
            <CommandItem value="habit toggle done todo complete today" onSelect={toggleFocusedHabit}>
              <Check />
              <span>Toggle today’s completion</span>
            </CommandItem>
            <CommandItem value="habit edit title rename" onSelect={editFocusedItem}>
              <Pencil />
              <span>Edit habit title</span>
            </CommandItem>
            <CommandItem value="habit details inspect open" onSelect={openFocusedItemDetails}>
              <SlidersHorizontal />
              <span>Open habit details</span>
            </CommandItem>
            <CommandItem value="habit move routine unassigned" onSelect={() => moveFocusedHabit(null)}>
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
            <CommandItem value="habit archive" onSelect={archiveFocusedHabit}>
              <Archive />
              <span>Archive habit</span>
            </CommandItem>
            <CommandItem
              className="text-red-400 data-[selected=true]:text-white"
              value="habit delete remove permanently"
              onSelect={deleteFocusedHabit}
            >
              <Trash2 />
              <span>Delete habit</span>
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
