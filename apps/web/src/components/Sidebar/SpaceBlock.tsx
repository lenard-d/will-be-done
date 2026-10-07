import { Settings, ArrowLeftRight, Keyboard } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Route } from "@/routes/spaces.$spaceId.tsx";
import { authUtils, isDemoMode } from "@/lib/auth";
import { useSpaceSettingsStore } from "@/components/SpaceSettings/spaceSettingsStore.ts";
import { useSidebar } from "@/components/ui/sidebar.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SpaceBlock() {
  const { spaceId } = Route.useParams();
  const openSettings = useSpaceSettingsStore((s) => s.openSettings);
  const openShortcuts = useSpaceSettingsStore((s) => s.openShortcuts);
  const { isMobile, setOpenMobile } = useSidebar();

  const spaceName = isDemoMode()
    ? "Demo Space"
    : (authUtils.getSpaceName(spaceId) ?? spaceId);

  const handleSettingsClick = () => {
    if (isMobile) setOpenMobile(false);
    openSettings(spaceName);
  };

  return (
    <div className="group/space w-full flex items-center gap-3 px-4 py-3 border-t border-ring/40 bg-white/[0.02]">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-accent/15 ring-1 ring-accent/20">
        <span className="text-[10px] font-bold text-accent leading-none select-none">
          {spaceName.slice(0, 2).toUpperCase()}
        </span>
      </div>

      <span className="flex-1 truncate text-left text-[12px] font-medium text-content-tinted">
        {spaceName}
      </span>

      <Link
        to="/spaces"
        aria-label="Switch space"
        className="flex-shrink-0 text-content-tinted/40 hover:text-accent transition-colors cursor-pointer"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
      </Link>

      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Keyboard shortcuts"
              onClick={() => {
                if (isMobile) setOpenMobile(false);
                openShortcuts(spaceName);
              }}
              className="flex-shrink-0 cursor-pointer text-content-tinted/70 hover:text-accent transition-colors"
            >
              <Keyboard className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Keyboard shortcuts</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <button
        type="button"
        aria-label="Space settings"
        onClick={handleSettingsClick}
        className="flex-shrink-0 cursor-pointer text-content-tinted/40 hover:text-accent transition-colors"
      >
        <Settings className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
