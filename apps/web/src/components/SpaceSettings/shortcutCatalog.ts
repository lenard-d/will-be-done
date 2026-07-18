export type ShortcutKey =
  | "Ctrl/Cmd"
  | "Ctrl"
  | "Shift"
  | "Arrow Up"
  | "Arrow Down"
  | "Arrow Left"
  | "Arrow Right"
  | "Backspace"
  | "Enter"
  | "Escape"
  | "Space"
  | "\\"
  | "1"
  | "2"
  | "3"
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "O"
  | "P"
  | "R"
  | "S"
  | "T"
  | "V"
  | "X"
  | "Z";

export type ShortcutChord = readonly ShortcutKey[];

export type Shortcut = {
  id: string;
  label: string;
  keys: readonly ShortcutChord[];
  description?: string;
};

export type ShortcutGroup = {
  id: "navigation" | "focused-items" | "views" | "editing-dialogs";
  label: string;
  description: string;
  shortcuts: readonly Shortcut[];
};

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    id: "navigation",
    label: "Navigation",
    description: "Move focus between cards and columns without opening them.",
    shortcuts: [
      {
        id: "focus-previous-item",
        label: "Focus previous item",
        keys: [["Arrow Up"], ["K"]],
      },
      {
        id: "focus-next-item",
        label: "Focus next item",
        keys: [["Arrow Down"], ["J"]],
      },
      {
        id: "focus-previous-column",
        label: "Focus previous column",
        keys: [["Arrow Left"], ["H"]],
        description: "Available in side-by-side boards.",
      },
      {
        id: "focus-next-column",
        label: "Focus next column",
        keys: [["Arrow Right"], ["L"]],
        description: "Available in side-by-side boards.",
      },
    ],
  },
  {
    id: "focused-items",
    label: "Focused items",
    description:
      "Actions for the focused task, template, project, or empty column position.",
    shortcuts: [
      {
        id: "task-toggle-state",
        label: "Mark done or todo",
        keys: [["Space"]],
        description: "Tasks only.",
      },
      {
        id: "task-open-actions",
        label: "Open task actions",
        keys: [["A"]],
      },
      {
        id: "task-edit-title",
        label: "Edit title",
        keys: [["Enter"], ["I"]],
      },
      {
        id: "task-edit-description",
        label: "Edit description",
        keys: [["E"]],
      },
      {
        id: "task-add-after",
        label: "Add card after",
        keys: [["O"]],
        description: "Templates and todo tasks only.",
      },
      {
        id: "task-add-before",
        label: "Add card before",
        keys: [["Shift", "O"]],
        description: "Templates and todo tasks only.",
      },
      {
        id: "column-add-task",
        label: "Add task in focused column",
        keys: [["A"], ["O"]],
        description:
          "When the empty position at the end of a column is focused.",
      },
      {
        id: "task-move-project",
        label: "Move card to project",
        keys: [["M"]],
      },
      {
        id: "task-move-up",
        label: "Move up",
        keys: [
          ["Ctrl", "Arrow Up"],
          ["Ctrl", "K"],
        ],
      },
      {
        id: "task-move-down",
        label: "Move down",
        keys: [
          ["Ctrl", "Arrow Down"],
          ["Ctrl", "J"],
        ],
      },
      {
        id: "task-move-left",
        label: "Move to previous column",
        keys: [
          ["Ctrl", "Arrow Left"],
          ["Ctrl", "H"],
        ],
      },
      {
        id: "task-move-right",
        label: "Move to next column",
        keys: [
          ["Ctrl", "Arrow Right"],
          ["Ctrl", "L"],
        ],
      },
      {
        id: "task-schedule-date",
        label: "Choose schedule date",
        keys: [["S"]],
        description: "Tasks only.",
      },
      {
        id: "task-schedule-today",
        label: "Schedule for today",
        keys: [["T"]],
        description: "Tasks only.",
      },
      {
        id: "task-reset-schedule",
        label: "Remove from schedule",
        keys: [["R"]],
        description: "Scheduled tasks only.",
      },
      {
        id: "task-stash",
        label: "Move to stash",
        keys: [["Shift", "S"]],
        description: "Todo tasks outside the stash only.",
      },
      {
        id: "task-convert-template",
        label: "Convert to repeating template",
        keys: [["Shift", "T"]],
        description: "One-off tasks only.",
      },
      {
        id: "task-add-checklist",
        label: "Add checklist item",
        keys: [["C"]],
      },
      {
        id: "task-nature-red",
        label: "Set nature to red",
        keys: [["1"]],
      },
      {
        id: "task-nature-green",
        label: "Set nature to green",
        keys: [["2"]],
      },
      {
        id: "task-nature-unknown",
        label: "Clear nature",
        keys: [["3"]],
      },
      {
        id: "task-remove",
        label: "Remove card or placement",
        keys: [["Backspace"], ["D"], ["X"]],
        description:
          "A scheduled placement is removed without deleting its task.",
      },
      {
        id: "task-delete-scheduled",
        label: "Delete scheduled task",
        keys: [["Ctrl/Cmd", "Backspace"]],
        description:
          "Deletes the task itself when a scheduled placement is focused.",
      },
      {
        id: "project-edit-title",
        label: "Rename project",
        keys: [["I"]],
        description: "When a project in the project view is focused.",
      },
      {
        id: "project-delete",
        label: "Delete project",
        keys: [["Backspace"], ["D"], ["X"]],
        description: "When a project in the project view is focused.",
      },
    ],
  },
  {
    id: "views",
    label: "Views and sidebars",
    description: "Show or hide the app's navigation and planning panels.",
    shortcuts: [
      {
        id: "desktop-quick-add",
        label: "Open quick add",
        keys: [["Ctrl/Cmd", "Shift", "A"]],
        description: "Desktop app, even when it is in the background.",
      },
      {
        id: "sidebar-toggle",
        label: "Toggle main sidebar",
        keys: [["Ctrl/Cmd", "B"]],
      },
      {
        id: "stash-toggle",
        label: "Toggle stash",
        keys: [["\\"]],
      },
      {
        id: "projects-panel-toggle",
        label: "Toggle projects panel",
        keys: [["P"]],
        description: "Days board only.",
      },
      {
        id: "card-details-toggle",
        label: "Toggle card details",
        keys: [["V"]],
        description: "When a task or template is focused.",
      },
      {
        id: "planning-panels-hide",
        label: "Hide planning panels",
        keys: [["Z"]],
        description:
          "Days board only. Closes the stash and card details and hides the projects panel.",
      },
      {
        id: "card-details-close",
        label: "Close card details",
        keys: [["Escape"]],
        description:
          "When card details are visible and no field is being edited.",
      },
    ],
  },
  {
    id: "editing-dialogs",
    label: "Editing, menus and dialogs",
    description: "Controls for app-specific editing flows and open overlays.",
    shortcuts: [
      {
        id: "task-title-finish",
        label: "Finish editing card title",
        keys: [["Enter"], ["Escape"]],
      },
      {
        id: "details-title-save",
        label: "Save details title",
        keys: [["Enter"], ["Escape"]],
      },
      {
        id: "details-description-save",
        label: "Save details description",
        keys: [["Shift", "Enter"], ["Escape"]],
      },
      {
        id: "checklist-create-next",
        label: "Save checklist item and add next",
        keys: [["Enter"]],
      },
      {
        id: "checklist-delete-empty",
        label: "Delete empty checklist item",
        keys: [["Backspace"]],
      },
      {
        id: "checklist-finish",
        label: "Finish checklist editing",
        keys: [["Escape"]],
      },
      {
        id: "task-menu-next",
        label: "Focus next task action",
        keys: [["J"]],
        description: "While the task actions menu is open.",
      },
      {
        id: "task-menu-previous",
        label: "Focus previous task action",
        keys: [["K"]],
        description: "While the task actions menu is open.",
      },
      {
        id: "move-dialog-next",
        label: "Select next project",
        keys: [["Arrow Down"], ["Ctrl", "J"]],
        description: "In the Move to project dialog.",
      },
      {
        id: "move-dialog-previous",
        label: "Select previous project",
        keys: [["Arrow Up"], ["Ctrl", "K"]],
        description: "In the Move to project dialog.",
      },
      {
        id: "move-dialog-confirm",
        label: "Move to selected project",
        keys: [["Enter"]],
        description: "In the Move to project dialog.",
      },
    ],
  },
] as const;
