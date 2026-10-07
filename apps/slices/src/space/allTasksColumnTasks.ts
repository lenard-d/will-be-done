import { v } from "@will-be-done/hyperdb";
import { action } from "../builders";
import { allTasksColumnById } from "./allTasksColumns";
import { addToDailyList } from "./dailyEntries";
import { createDailyListIfNotPresent } from "./dailyLists";
import {
  allProjectSections,
  createTaskInSection,
  inboxProjectSectionId,
} from "./projectSections";
import { taskFiltersSchema } from "./taskViewFilters";

export const createTaskInAllTasksColumn = action({
  name: "createTaskInAllTasksColumn",
  args: { columnId: v.string() },
  handler: function* createTaskInAllTasksColumn({ columnId }) {
    const column = yield* allTasksColumnById({ id: columnId });
    if (!column) throw new Error("All tasks column not found");
    const filters = taskFiltersSchema.parse(JSON.parse(column.filtersJson));
    const sections = yield* allProjectSections({});
    const section =
      filters.projectIds.length === 1
        ? sections.find(
            (candidate) =>
              candidate.projectId === filters.projectIds[0] &&
              (!filters.columnNames.length ||
                filters.columnNames.includes(
                  candidate.title.trim().toLowerCase(),
                )),
          )
        : undefined;
    const projectSectionId = section?.id ?? (yield* inboxProjectSectionId({}));
    const task = yield* createTaskInSection({
      projectSectionId,
      position: "prepend",
    });
    if (filters.plannedDay.kind === "on") {
      const day = yield* createDailyListIfNotPresent({
        date: filters.plannedDay.date,
      });
      yield* addToDailyList({
        taskId: task.id,
        dailyListId: day.id,
        position: "append",
      });
    }
    return task;
  },
});
