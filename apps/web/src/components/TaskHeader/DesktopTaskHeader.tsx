import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function DesktopTaskHeader({
  title,
  count,
  icon,
  actions,
}: {
  title: ReactNode;
  count: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header
      data-command-palette-swipe-region
      className="flex h-12 shrink-0 items-center gap-3 px-2 [app-region:no-drag]"
    >
      <SidebarTrigger className="shrink-0 cursor-pointer text-content-tinted hover:text-primary" />
      {icon}
      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        <h1 className="min-w-0 truncate text-3xl font-bold leading-tight text-content">
          {title}
        </h1>
        <p role="status" className="shrink-0 text-xs text-content-tinted">
          {count}
        </p>
      </div>
      {actions}
    </header>
  );
}
