import {
  useAsyncDispatch,
  useAsyncSelector,
} from "@will-be-done/hyperdb/react";
import {
  deleteProjects,
  inboxProjectId as getInboxProjectId,
  projectByIdOrDefault,
  projectTasksCount,
  updateProject,
} from "@will-be-done/slices/space";
import { ProjectTaskPanel } from "@/components/ProjectView/ProjectTaskPanel.tsx";
import { ProjectItemsList } from "@/components/ProjectItemsList/ProjectItemList.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerSearch,
} from "@/components/ui/emoji-picker.tsx";
import { useMemo, useRef } from "react";
import { useProjectTaskReveal } from "./useProjectTaskReveal";
import { useIsMobile } from "@/hooks/use-mobile";
import { promptDialog } from "@/components/ui/prompt-dialog-service";
import { Stash } from "@/components/Stash/Stash.tsx";
import { useStashDesktopOffset } from "@/components/Stash/useStashDesktopOffset.ts";
import { MobileTaskHeader } from "@/components/TaskHeader/MobileTaskHeader";
import { DesktopTaskHeader } from "@/components/TaskHeader/DesktopTaskHeader";
import { TaskOptionsMenu } from "@/components/TaskHeader/TaskOptionsMenu";
import { TaskSortControl } from "@/components/TaskSorting/TaskSortControl";

const DeleteIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 12 13"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9.41667 2.91667V10.5C9.41667 10.7873 9.30253 11.0629 9.09937 11.266C8.8962 11.4692 8.62065 11.5833 8.33333 11.5833H2.91667C2.62935 11.5833 2.3538 11.4692 2.15063 11.266C1.94747 11.0629 1.83333 10.7873 1.83333 10.5V2.91667M0.75 2.91667H10.5M3.45833 2.91667V1.83333C3.45833 1.54602 3.57247 1.27047 3.77563 1.0673C3.9788 0.864137 4.25435 0.75 4.54167 0.75H6.70833C6.99565 0.75 7.2712 0.864137 7.47437 1.0673C7.67753 1.27047 7.79167 1.54602 7.79167 1.83333V2.91667"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ProjectDetailContent = ({
  projectId,
  revealSectionId,
}: {
  projectId: string;
  revealSectionId?: string;
}) => {
  const dispatch = useAsyncDispatch();
  const scrollRestorationId = useMemo(
    () => `project-view-scroll-${projectId}`,
    [projectId],
  );
  const { data: project } = useAsyncSelector({
    selector: projectByIdOrDefault,
    args: { id: projectId },
  });

  const { data: taskCount = 0 } = useAsyncSelector({
    selector: projectTasksCount,
    args: { projectId },
  });

  const handleDeleteClick = () => {
    if (!project) return;
    const shouldDelete = confirm(
      "Are you sure you want to delete this project?",
    );
    if (shouldDelete) {
      void dispatch(deleteProjects({ ids: [project.id] }));
    }
  };

  const handleTitleClick = async () => {
    if (!project) return;
    const newTitle = await promptDialog(
      "Enter new project title",
      project.title,
    );
    if (newTitle == "" || newTitle == null) return;
    await dispatch(
      updateProject({ id: project.id, project: { title: newTitle } }),
    );
  };

  const isSmallScreen = useIsMobile();
  const stashOffset = useStashDesktopOffset();

  if (!project) return null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MobileTaskHeader
        title={project.title}
        count={`${taskCount} ${taskCount === 1 ? "task" : "tasks"} to do`}
        menu={
          <TaskOptionsMenu viewKey={`project:${projectId}`}>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                className="min-h-10 cursor-pointer rounded px-2 text-left text-sm hover:bg-panel-hover"
                onClick={() => void handleTitleClick()}
              >
                Rename project
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="min-h-10 cursor-pointer rounded px-2 text-left text-sm hover:bg-panel-hover"
                  >
                    Change project icon
                  </button>
                </PopoverTrigger>
                <PopoverContent className="z-1100 w-fit max-w-[calc(100vw-1rem)] p-0">
                  <EmojiPicker
                    className="h-[326px] rounded-lg"
                    onEmojiSelect={({ emoji }) => {
                      void dispatch(
                        updateProject({
                          id: project.id,
                          project: { icon: emoji },
                        }),
                      );
                    }}
                  >
                    <EmojiPickerSearch />
                    <EmojiPickerContent />
                  </EmojiPicker>
                </PopoverContent>
              </Popover>
              <button
                type="button"
                className="min-h-10 cursor-pointer rounded px-2 text-left text-sm text-notice hover:bg-panel-hover"
                onClick={handleDeleteClick}
              >
                Delete project
              </button>
            </div>
          </TaskOptionsMenu>
        }
      />
      {!isSmallScreen && (
        <DesktopTaskHeader
          title={
            <button
              type="button"
              onClick={() => void handleTitleClick()}
              className="block max-w-full truncate text-left cursor-pointer hover:text-primary transition-colors"
            >
              {project.title}
            </button>
          }
          count={`${taskCount} ${taskCount === 1 ? "task" : "tasks"} to do`}
          icon={
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-2xl flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity leading-none"
                >
                  {project.icon || "🟡"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="z-50 w-fit p-0">
                <EmojiPicker
                  className="h-[326px] rounded-lg shadow-md"
                  onEmojiSelect={({ emoji }) => {
                    void dispatch(
                      updateProject({
                        id: project.id,
                        project: { icon: emoji },
                      }),
                    );
                  }}
                >
                  <EmojiPickerSearch />
                  <EmojiPickerContent />
                </EmojiPicker>
              </PopoverContent>
            </Popover>
          }
          actions={
            <div className="flex self-center flex-shrink-0 items-center gap-3">
              <TaskSortControl viewKey={`project:${projectId}`} />
              <button
                onClick={handleDeleteClick}
                type="button"
                aria-label="Delete project"
                className="cursor-pointer text-content-tinted hover:text-notice transition-colors flex justify-center items-center"
              >
                <DeleteIcon />
              </button>
            </div>
          }
        />
      )}
      <div className="relative min-h-0 flex-1">
        <Stash />
        <div
          className="h-full min-w-0"
          style={{
            marginLeft: stashOffset ? `${stashOffset}px` : undefined,
            width: stashOffset ? `calc(100% - ${stashOffset}px)` : undefined,
            transition: "margin-left 200ms ease-out, width 200ms ease-out",
          }}
        >
          <div
            data-scroll-restoration-id={scrollRestorationId}
            id="main-scrollable-area"
            className="h-full min-h-0 overflow-y-auto overscroll-contain sm:flex sm:overflow-y-hidden"
          >
            {isSmallScreen ? (
              <div className="w-full">
                <div className="max-w-lg mx-auto px-4 pb-4">
                  <ProjectTaskPanel
                    projectId={projectId}
                    revealSectionId={revealSectionId}
                    embedded
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-1 min-h-0 overflow-x-auto pb-4">
                <div className="min-w-max h-full px-4">
                  <ProjectItemsList
                    project={project}
                    revealSectionId={revealSectionId}
                    header={null}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ProjectDetailView = ({ projectId }: { projectId: string }) => {
  const { data: inboxProjectId = "" } = useAsyncSelector({
    selector: getInboxProjectId,
    args: {},
  });
  const realProjectId = useMemo(() => {
    return projectId === "inbox" ? inboxProjectId : projectId;
  }, [projectId, inboxProjectId]);

  const rootRef = useRef<HTMLDivElement>(null);
  const revealSectionId = useProjectTaskReveal({
    projectId: realProjectId,
    rootRef,
  });

  return (
    <div ref={rootRef} className="relative h-full min-w-0 overflow-hidden">
      <ProjectDetailContent
        projectId={realProjectId}
        revealSectionId={revealSectionId}
      />
    </div>
  );
};
