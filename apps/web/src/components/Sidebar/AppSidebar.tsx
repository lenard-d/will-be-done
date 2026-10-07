import { useState } from "react";
import { useAsyncSelector } from "@will-be-done/hyperdb/react";
import { useAsyncDispatch } from "@will-be-done/hyperdb/react";
import {
  createProject,
  loadSpaceBackup,
  projectsWithTaskStats,
} from "@will-be-done/slices/space";
import { SidebarProjectItem } from "./SidebarProjectItem.tsx";
import { SpaceBlock } from "./SpaceBlock.tsx";
import {
  Sidebar,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar.tsx";
import { Link, useRouterState } from "@tanstack/react-router";
import { Route } from "@/routes/spaces.$spaceId.tsx";
import { startOfDay } from "date-fns";
import { useCurrentDate } from "@/components/DaysBoard/hooks.tsx";
import { cn } from "@/lib/utils.ts";
import { ListTodo } from "lucide-react";
import { promptDialog } from "@/components/ui/prompt-dialog-service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { generateTestBackup } from "@/lib/generateTestData.ts";

const AllTasksNavItem = () => {
  const { spaceId } = Route.useParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const isActive = useRouterState({
    select: (state) => state.location.pathname.endsWith("/all-tasks"),
  });

  return (
    <Link
      to="/spaces/$spaceId/all-tasks"
      params={{ spaceId }}
      onClick={isMobile ? () => setOpenMobile(false) : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors w-full min-h-[40px]",
        isActive
          ? "text-accent bg-accent/10"
          : "text-content-tinted hover:text-content hover:bg-surface-elevated",
      )}
    >
      <ListTodo className="size-4 shrink-0" />
      <span>All tasks</span>
    </Link>
  );
};

export const AppSidebar = () => {
  const dispatch = useAsyncDispatch();
  const today = useCurrentDate();
  const currentDate = startOfDay(today).getTime();
  const { data: projects = [] } = useAsyncSelector({
    selector: projectsWithTaskStats,
    args: { currentDate },
  });
  const inbox = projects.find(({ project }) => project.isInbox);

  const handleAddProjectClick = async () => {
    const title = await promptDialog("Enter project title");
    if (title) {
      await dispatch(createProject({ project: { title }, position: "append" }));
    }
  };

  return (
    <Sidebar
      side="left"
      collapsible="offcanvas"
      className="[&_[data-slot=sidebar-container]]:border-r-0 [&_[data-slot=sidebar-inner]]:bg-surface-elevated [&_[data-slot=sidebar-inner]]:ring-1 [&_[data-slot=sidebar-inner]]:ring-ring"
    >
      <SidebarRail />
      <SidebarHeader className="px-2 pt-3 pb-0 gap-1">
        <AllTasksNavItem />
        {inbox && (
          <SidebarProjectItem
            project={inbox.project}
            notDoneCount={inbox.notDoneCount}
            overdueCount={inbox.overdueCount}
          />
        )}
        <div className="mx-3 my-2 h-px bg-ring/40" />
      </SidebarHeader>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 flex flex-col py-1 gap-1">
        {projects
          .filter(({ project }) => !project.isInbox)
          .map(({ project, notDoneCount, overdueCount }) => (
            <SidebarProjectItem
              key={project.id}
              project={project}
              notDoneCount={notDoneCount}
              overdueCount={overdueCount}
            />
          ))}
      </div>

      <div className="flex items-center justify-center pb-3 pt-2 border-t border-ring/40">
        <button
          type="button"
          onClick={() => void handleAddProjectClick()}
          className="cursor-pointer text-[12px] text-content-tinted/60 hover:text-accent transition-colors"
        >
          + Add Project
        </button>
      </div>

      {import.meta.env.DEV && <GenerateTestDataButton />}

      <SpaceBlock />
    </Sidebar>
  );
};

const GenerateTestDataButton = () => {
  const dispatch = useAsyncDispatch();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState("5");
  const [sections, setSections] = useState("3");
  const [done, setDone] = useState("10");
  const [todo, setTodo] = useState("10");

  const handleGenerate = () => {
    const n = parseInt(projects, 10) || 0;
    const m = parseInt(sections, 10) || 0;
    const k = parseInt(done, 10) || 0;
    const l = parseInt(todo, 10) || 0;

    const backup = generateTestBackup(n, m, k, l);
    void dispatch(loadSpaceBackup({ backup: backup }));
    setOpen(false);
  };

  const inputClass =
    "w-full rounded-md border border-ring bg-surface px-3 py-2 text-sm text-content placeholder:text-content-tinted/50 outline-none transition-shadow focus:ring-2 focus:ring-accent/40 focus:border-accent/60";

  return (
    <>
      <div className="flex items-center justify-center pb-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cursor-pointer text-[11px] text-content-tinted/40 hover:text-accent transition-colors"
        >
          [DEV] Generate Test Data
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-popover backdrop-blur-xl ring-1 ring-ring border-none gap-5 safari:bg-popover/95 safari:backdrop-blur-none sm:max-w-sm [&>button]:text-content-tinted">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-semibold text-content">
              Generate Test Data
            </DialogTitle>
            <DialogDescription className="text-[13px] text-content-tinted">
              This will replace all existing data in this space.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerate();
            }}
            className="flex flex-col gap-3"
          >
            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-content-tinted">Projects</span>
              <input
                type="number"
                min="0"
                value={projects}
                onChange={(e) => setProjects(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-content-tinted">
                Sections per project
              </span>
              <input
                type="number"
                min="0"
                value={sections}
                onChange={(e) => setSections(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-content-tinted">
                Done tasks per section
              </span>
              <input
                type="number"
                min="0"
                value={done}
                onChange={(e) => setDone(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-content-tinted">
                Todo tasks per section
              </span>
              <input
                type="number"
                min="0"
                value={todo}
                onChange={(e) => setTodo(e.target.value)}
                className={inputClass}
              />
            </label>

            <DialogFooter className="mt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-md px-3.5 py-1.5 text-[13px] font-medium text-content-tinted transition-colors hover:text-content hover:bg-white/[0.05]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="cursor-pointer rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent/85"
              >
                Generate
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
