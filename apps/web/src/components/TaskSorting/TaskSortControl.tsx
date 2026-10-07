import { useRef, useState, type RefObject } from "react";
import { useTaskSortShortcut } from "./useTaskSortShortcut";
import { isTaskSortMode, taskSortLabels, taskSortModes } from "./taskSorting";
import { useTaskSorting } from "./useTaskSorting";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TaskSortControl({ viewKey }: { viewKey: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  useTaskSortShortcut({ viewKey, controlRef: ref });
  return <TaskSortMenu viewKey={viewKey} controlRef={ref} />;
}

export function TaskSortMenu({
  viewKey,
  controlRef,
}: {
  viewKey: string;
  controlRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { sortMode, setSortMode } = useTaskSorting(viewKey);
  const fallbackRef = useRef<HTMLButtonElement>(null);
  const triggerRef = controlRef ?? fallbackRef;
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Sort tasks"
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded border border-content-tinted/20 bg-surface px-2 py-1 text-xs text-content outline-none hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span>{taskSortLabels[sortMode]}</span>
          <ChevronDown className="size-3" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      {open && (
        <DropdownMenuContent
          align="end"
          className="z-1100"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <DropdownMenuLabel>Sort tasks</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={sortMode}
            onValueChange={(value) => {
              if (isTaskSortMode(value)) setSortMode(value);
            }}
          >
            {taskSortModes.map((mode) => (
              <DropdownMenuRadioItem key={mode} value={mode}>
                {taskSortLabels[mode]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-4">
            Cycle sort
            <DropdownMenuShortcut>Q</DropdownMenuShortcut>
          </DropdownMenuLabel>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
