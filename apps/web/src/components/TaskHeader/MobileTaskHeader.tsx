import { useIsMobile } from "@/hooks/use-mobile";
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { openCommandPalette } from "@/components/CommandPalette/commandPaletteEvents";

export function MobileTaskHeader({
  title,
  count,
  menu,
}: {
  title: string;
  count: ReactNode;
  menu: ReactNode;
}) {
  const isMobile = useIsMobile();
  if (!isMobile) return null;
  return (
    <header
      data-command-palette-swipe-region
      className="shrink-0 px-2 pt-1 pb-3 sm:hidden [app-region:no-drag]"
    >
      <div className="flex min-w-0 items-center gap-1">
        <SidebarTrigger className="size-11 shrink-0 cursor-pointer text-content-tinted hover:text-content" />
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-content">
          {title}
        </h1>
        <button
          type="button"
          aria-label="Search tasks and commands"
          onClick={openCommandPalette}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded text-content hover:bg-panel-hover outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Search className="size-5" aria-hidden />
        </button>
        {menu}
      </div>
      <p role="status" className="px-2 pt-1 text-xs text-content-tinted">
        {count}
      </p>
    </header>
  );
}
