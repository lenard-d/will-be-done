import { useIsMobile } from "@/hooks/use-mobile";
import { useRef, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TaskSortMenu } from "@/components/TaskSorting/TaskSortControl";
import { useTaskSortShortcut } from "@/components/TaskSorting/useTaskSortShortcut";
import { useTaskSorting } from "@/components/TaskSorting/useTaskSorting";
import { taskSortLabels } from "@/components/TaskSorting/taskSorting";

export function TaskOptionsMenu({
  viewKey,
  children,
  activeFilterCount = 0,
}: {
  viewKey: string;
  children?: ReactNode;
  activeFilterCount?: number;
}) {
  const isMobile = useIsMobile();
  const contentRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLButtonElement>(null);
  const { sortMode } = useTaskSorting(viewKey);
  useTaskSortShortcut({ viewKey, controlRef });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          ref={controlRef}
          type="button"
          aria-label="Filters and sorting"
          title={`Sort: ${taskSortLabels[sortMode]}`}
          className="relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded text-content hover:bg-panel-hover outline-none focus-visible:ring-2 focus-visible:ring-accent sm:size-9 sm:border sm:border-content-tinted/20"
        >
          <SlidersHorizontal className="size-5" aria-hidden />
          {activeFilterCount > 0 && (
            <span className="absolute right-1 top-1 size-2 rounded-full bg-accent" />
          )}
          <span className="sr-only">
            {activeFilterCount > 0
              ? `${activeFilterCount} active filters. `
              : ""}
            Sort: {taskSortLabels[sortMode]}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        onOpenAutoFocus={(event) => {
          if (!isMobile) return;
          event.preventDefault();
          contentRef.current?.querySelector("button")?.focus();
        }}
        align="end"
        aria-label="Filters and sorting"
        className="z-1100 w-72 max-w-[calc(100vw-1rem)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-3"
        onKeyDown={(event) => event.stopPropagation()}
      >
        {children}
        <div className={children ? "mt-3 border-t border-ring pt-3" : ""}>
          <p className="mb-2 text-sm font-semibold">Sorting</p>
          <div className="[&>button]:min-h-10 sm:[&>button]:min-h-0">
            <TaskSortMenu viewKey={viewKey} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
