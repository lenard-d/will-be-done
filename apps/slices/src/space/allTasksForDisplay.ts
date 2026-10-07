import { selector } from "../builders";
import { projectSectionItemsForDisplay } from "./projectSectionItems";
import { allTasks } from "./tasks";

/** Read each task once from the current space, with its project and schedule. */
export const allTasksForDisplay = selector({
  name: "allTasksForDisplay",
  args: {},
  handler: function* () {
    const tasks = yield* allTasks({});
    const items = yield* projectSectionItemsForDisplay({
      items: tasks,
      listItems: tasks,
    });

    return items.sort((left, right) => {
      const orderPairs = [
        [left.project.orderToken, right.project.orderToken],
        [left.section.orderToken, right.section.orderToken],
        [left.item.orderToken, right.item.orderToken],
      ];
      for (const [leftToken, rightToken] of orderPairs) {
        if (leftToken !== rightToken) return leftToken < rightToken ? -1 : 1;
      }
      return 0;
    });
  },
});
