import { useEffect } from "react";
import { useSidebarStore } from "@/store/sidebarStore.ts";
import { AppSidebar } from "@/components/Sidebar/AppSidebar.tsx";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar.tsx";
import { useSpaceSettingsStore } from "@/components/SpaceSettings/spaceSettingsStore.ts";
import { SpaceSettingsModal } from "@/components/SpaceSettings/SpaceSettingsModal.tsx";
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
}: {
  children: React.ReactNode;
}) => {
  const sidebarWidth = useSidebarStore((s) => s.width);
  const setSidebarWidth = useSidebarStore((s) => s.setWidth);
  const { open, spaceName, closeSettings } = useSpaceSettingsStore();

  return (
    <>
      <SidebarProvider
        defaultOpen={true}
        className="min-h-0 h-full w-full"
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
      >
        <SidebarCommandBridge />
        <AppSidebar />
        <SidebarInset className="min-h-0 min-w-0 bg-transparent">
          <header className="flex h-12 shrink-0 items-center gap-2 px-2 [app-region:no-drag]">
            <SidebarTrigger className="shrink-0 cursor-pointer text-content-tinted hover:text-primary" />
          </header>
          <div className="relative flex-1 min-h-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>

      <SpaceSettingsModal
        open={open}
        onClose={closeSettings}
        spaceName={spaceName}
      />
    </>
  );
};
