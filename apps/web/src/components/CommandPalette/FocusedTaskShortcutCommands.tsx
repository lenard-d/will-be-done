import {
  CalendarDays,
  FolderInput,
  ListChecks,
  Palette,
  Pencil,
  Plus,
  Repeat2,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Task } from "@will-be-done/slices/space";
import { CommandItem, CommandShortcut } from "@/components/ui/command";
import { getShortcutLabel } from "@/components/SpaceSettings/shortcutCatalog";

export type TaskShortcutEvent = Pick<KeyboardEventInit, "code" | "shiftKey">;

type ShortcutAction = {
  label: string;
  shortcutId: string;
  keyboard: TaskShortcutEvent;
  icon: LucideIcon;
  availableFor: "task" | "todo" | "scheduled" | "unstashedTodo" | "oneOff";
};

const ACTIONS: readonly ShortcutAction[] = [
  {
    label: "Add task after",
    shortcutId: "task-add-after",
    keyboard: { code: "KeyO" },
    icon: Plus,
    availableFor: "todo",
  },
  {
    label: "Add task before",
    shortcutId: "task-add-before",
    keyboard: { code: "KeyO", shiftKey: true },
    icon: Plus,
    availableFor: "todo",
  },
  {
    label: "Open task actions",
    shortcutId: "task-open-actions",
    keyboard: { code: "KeyA" },
    icon: SlidersHorizontal,
    availableFor: "task",
  },
  {
    label: "Edit task description",
    shortcutId: "task-edit-description",
    keyboard: { code: "KeyE" },
    icon: Pencil,
    availableFor: "task",
  },
  {
    label: "Choose schedule date",
    shortcutId: "task-schedule-date",
    keyboard: { code: "KeyS" },
    icon: CalendarDays,
    availableFor: "task",
  },
  {
    label: "Remove from schedule",
    shortcutId: "task-reset-schedule",
    keyboard: { code: "KeyR" },
    icon: CalendarDays,
    availableFor: "scheduled",
  },
  {
    label: "Move task to project",
    shortcutId: "task-move-project",
    keyboard: { code: "KeyM" },
    icon: FolderInput,
    availableFor: "task",
  },
  {
    label: "Move task to stash",
    shortcutId: "task-stash",
    keyboard: { code: "KeyS", shiftKey: true },
    icon: WalletCards,
    availableFor: "unstashedTodo",
  },
  {
    label: "Convert to repeating template",
    shortcutId: "task-convert-template",
    keyboard: { code: "KeyT", shiftKey: true },
    icon: Repeat2,
    availableFor: "oneOff",
  },
  {
    label: "Add checklist item",
    shortcutId: "task-add-checklist",
    keyboard: { code: "KeyC" },
    icon: ListChecks,
    availableFor: "task",
  },
  {
    label: "Set nature to red",
    shortcutId: "task-nature-red",
    keyboard: { code: "Digit1" },
    icon: Palette,
    availableFor: "task",
  },
  {
    label: "Set nature to green",
    shortcutId: "task-nature-green",
    keyboard: { code: "Digit2" },
    icon: Palette,
    availableFor: "task",
  },
  {
    label: "Clear nature",
    shortcutId: "task-nature-unknown",
    keyboard: { code: "Digit3" },
    icon: Palette,
    availableFor: "task",
  },
];

export function FocusedTaskShortcutCommands({
  task,
  isScheduled,
  isStashed,
  isEditing,
  onRunShortcut,
}: {
  task: Task;
  isScheduled: boolean;
  isStashed: boolean;
  isEditing: boolean;
  onRunShortcut: (keyboard: TaskShortcutEvent) => void;
}) {
  const availability = {
    task: true,
    todo: task.state === "todo",
    scheduled: isScheduled,
    unstashedTodo: task.state === "todo" && !isStashed,
    oneOff: !task.templateId,
  };
  return ACTIONS.map((action) => {
    const Icon = action.icon;
    return (
      <CommandItem
        key={action.shortcutId}
        value={action.label}
        disabled={isEditing || !availability[action.availableFor]}
        onSelect={() => onRunShortcut(action.keyboard)}
      >
        <Icon />
        <span>{action.label}</span>
        <CommandShortcut>{getShortcutLabel(action.shortcutId)}</CommandShortcut>
      </CommandItem>
    );
  });
}
