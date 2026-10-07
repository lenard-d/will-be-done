export const COMMAND_PALETTE_GROUPS = [
  { id: "actions", label: "Actions" },
  { id: "tabs", label: "Tabs" },
  { id: "settings", label: "Settings" },
  { id: "projects", label: "Projects" },
  { id: "views", label: "Views" },
] as const;

export type CommandPaletteGroupId =
  (typeof COMMAND_PALETTE_GROUPS)[number]["id"];

export function isCommandPaletteShortcut(
  event: Pick<
    KeyboardEvent,
    "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
  >,
) {
  return (
    event.code === "KeyK" &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}
