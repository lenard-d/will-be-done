import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSidebarStore } from "@/store/sidebarStore.ts";
import { AppSidebar } from "@/components/Sidebar/AppSidebar.tsx";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar.tsx";
import { TOGGLE_SIDEBAR_EVENT } from "@/components/CommandPalette/CommandPalette.tsx";

function SidebarCommandBridge() {
  const { toggleSidebar } = useSidebar();

  useEffect(() => {
    window.addEventListener(TOGGLE_SIDEBAR_EVENT, toggleSidebar);
    return () =>
      window.removeEventListener(TOGGLE_SIDEBAR_EVENT, toggleSidebar);
  }, [toggleSidebar]);

  return null;
}

export const LayoutWithSidebar = ({
  children,
  sidePanel,
}: {
  children: React.ReactNode;
  sidePanel?: React.ReactNode;
}) => {
  const pathname = useLocation({ select: (location) => location.pathname });
  const hasTaskHeader = /\/(all-tasks|projects\/[^/]+)\/?$/.test(pathname);
  const sidebarWidth = useSidebarStore((s) => s.width);
  const setSidebarWidth = useSidebarStore((s) => s.setWidth);

  return (
    <SidebarProvider
      defaultOpen={true}
      className="min-h-0 h-full w-full"
      width={sidebarWidth}
      onWidthChange={setSidebarWidth}
    >
      <SidebarCommandBridge />
      <AppSidebar />
      <SidebarInset className="min-h-0 min-w-0 flex-row bg-transparent">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!hasTaskHeader && (
            <header className="flex h-12 shrink-0 items-center gap-2 px-2 [app-region:no-drag]">
              <SidebarTrigger className="shrink-0 cursor-pointer text-content-tinted hover:text-primary" />
            </header>
          )}
          <div className="relative flex-1 min-h-0">{children}</div>
        </div>
        {sidePanel}
      </SidebarInset>
    </SidebarProvider>
  );
};
