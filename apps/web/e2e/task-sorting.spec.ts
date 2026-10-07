import { expect, test } from "playwright/test";
import {
  createSpace,
  createTodayTask,
  dailyTaskItem,
  openSpace,
  openToday,
  signupUser,
  uniqueE2EName,
} from "./helpers";

test("keeps a reordered day across sorting, project views, and reloads", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("Sorting space");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await page.goto(page.url().replace(/\/dates\/[^/]+$/, "/dates/2026-10-12"));
  await createTodayTask(page, "Bravo task");
  await createTodayTask(page, "Alpha task");
  await page.getByRole("link", { name: "Tasks", exact: true }).click();

  const allTasks = page.locator(
    '[data-task-sort-view="all-tasks"] [data-focusable-key^="task^^"]',
  );
  await expect(allTasks).toHaveText([/Alpha task/, /Bravo task/]);
  const originalProjectOrder = await allTasks.evaluateAll((rows) =>
    rows.map((row) => ({
      id: row.getAttribute("data-focusable-key"),
      token: row.getAttribute("data-order-token"),
    })),
  );
  await allTasks.filter({ hasText: "Bravo task" }).click();
  await page.keyboard.press("Control+ArrowUp");
  await expect(allTasks).toHaveText([/Bravo task/, /Alpha task/]);

  const options = page.getByRole("button", {
    name: "Filters and sorting",
    exact: true,
  });
  await options.click();
  const sortControl = page.getByRole("button", { name: "Sort tasks" });
  await sortControl.click();
  await page.getByRole("menuitemradio", { name: "Alphabetical" }).click();
  await expect(allTasks).toHaveText([/Alpha task/, /Bravo task/]);
  await sortControl.click();
  await page.getByRole("menuitemradio", { name: "Planned day" }).click();
  await expect(allTasks).toHaveText([/Bravo task/, /Alpha task/]);

  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: /^Inbox/ }).click();
  await expect(page.locator('[data-focusable-key^="task^^"]')).toHaveText([
    /Bravo task/,
    /Alpha task/,
  ]);
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await page.reload();
  await expect(allTasks).toHaveText([/Bravo task/, /Alpha task/]);
  expect(
    await allTasks.evaluateAll((rows) =>
      rows.map((row) => ({
        id: row.getAttribute("data-focusable-key"),
        token: row.getAttribute("data-order-token"),
      })),
    ),
  ).toEqual([...originalProjectOrder].reverse());

  await page.goto(page.url().replace(/\/all-tasks$/, "/dates/2026-10-12"));
  await expect(page.locator('[data-focusable-key^="dailyEntry^^"]')).toHaveText(
    [/Bravo task/, /Alpha task/],
  );
  await page.getByRole("link", { name: "Timeline", exact: true }).click();
  await expect(page.locator('[data-focusable-key^="dailyEntry^^"]')).toHaveText(
    [/Bravo task/, /Alpha task/],
  );
});

test("shows completed scheduled tasks once and deletes the task from All tasks", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("All tasks space");
  const title = "Completed scheduled task";
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  const task = await createTodayTask(page, title);
  await task.click();
  await page.keyboard.press("Space");
  await page.getByRole("link", { name: "Tasks", exact: true }).click();

  const listedTask = page
    .locator('[data-task-sort-view="all-tasks"] [data-focusable-key^="task^^"]')
    .filter({ hasText: title });
  await expect(listedTask).toHaveCount(1);
  await expect(listedTask).toHaveAttribute("data-ignore-drop", "true");
  await listedTask.click();
  await page.keyboard.press("KeyD");
  await expect(listedTask).toHaveCount(0);
  await openToday(page);
  await expect(dailyTaskItem(page, title)).toHaveCount(0);
  await page.getByRole("link", { name: /^Inbox/ }).click();
  await expect(page.locator('[data-focusable-key^="task^^"]')).toHaveCount(0);
});

test("cycles the active sort with Q without changing text being edited", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("Sort shortcut space");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  const task = await createTodayTask(page, "Shortcut task");
  const sortControl = page.getByRole("button", { name: "Sort tasks" });
  await task.click();
  await page.keyboard.press("KeyQ");
  await expect(sortControl).toHaveText("Alphabetical");
  await page.keyboard.press("KeyQ");
  await expect(sortControl).toHaveText("Manual");
  await page.keyboard.press("KeyQ");
  await expect(sortControl).toHaveText("Planned day");
  await page.keyboard.press("Enter");
  await page.getByLabel("Edit task title").fill("Q text");
  await page.keyboard.press("KeyQ");
  await expect(sortControl).toHaveText("Planned day");
});

test("moves a checklist item between tasks while All tasks uses date sorting", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("Checklist sorting space");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await createTodayTask(page, "Checklist source");
  await createTodayTask(page, "Checklist target");
  await page.getByRole("link", { name: "Tasks", exact: true }).click();

  const allTasks = page.locator('[data-task-sort-view="all-tasks"]');
  const source = allTasks
    .locator('[data-focusable-key^="task^^"]')
    .filter({ hasText: "Checklist source" });
  const target = allTasks
    .locator('[data-focusable-key^="task^^"]')
    .filter({ hasText: "Checklist target" });
  await source.click();
  await page.keyboard.press("KeyC");
  await source
    .getByRole("textbox", { name: "Checklist item" })
    .fill("Transfer this item");
  await page.keyboard.press("Escape");

  await source
    .getByRole("button", { name: "Drag checklist item" })
    .dragTo(target);
  await expect(
    target.getByText("Transfer this item", { exact: true }),
  ).toBeVisible();
  await expect(source.locator("[data-checklist-item-id]")).toHaveCount(0);
  await page.reload();
  await expect(
    target.getByText("Transfer this item", { exact: true }),
  ).toBeVisible();
});

test("cycles Timeline sorting when its focused project panel is hidden", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("Hidden panel sorting space");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await createTodayTask(page, "Hidden panel task");
  await page.getByRole("link", { name: "Timeline", exact: true }).click();

  const projectTask = page
    .locator('[data-task-sort-view^="project:"] [data-focusable-key^="task^^"]')
    .filter({ hasText: "Hidden panel task" });
  const timelineSort = page.locator(
    'header[data-task-sort-view="timeline"] button[aria-label="Sort tasks"]',
  );
  const projectSort = page.locator(
    '[data-task-sort-view^="project:"] button[aria-label="Sort tasks"]',
  );
  await projectTask.click();
  await page.keyboard.press("KeyP");
  await page.keyboard.press("KeyQ");

  await expect(timelineSort).toHaveText("Alphabetical");
  await expect(projectSort).toHaveText("Planned day");
});

test("uses the general sort default until a view saves its own choice", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("Sort default space");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await createTodayTask(page, "Alpha default task");
  await createTodayTask(page, "Bravo default task");
  await page.getByRole("button", { name: "Space settings" }).click();
  await page
    .getByRole("combobox", { name: "Default task sort" })
    .selectOption("alphabetical");
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByRole("link", { name: "Tasks", exact: true }).click();

  await page
    .getByRole("button", { name: "Filters and sorting", exact: true })
    .click();
  const sortControl = page.getByRole("button", {
    name: "Sort tasks",
    exact: true,
  });
  const tasks = page.locator(
    '[data-task-sort-view="all-tasks"] [data-focusable-key^="task^^"]',
  );
  await expect(sortControl).toHaveText("Alphabetical");
  await expect(tasks).toHaveText([/Alpha default task/, /Bravo default task/]);
  await sortControl.click();
  await page.getByRole("menuitemradio", { name: "Planned day" }).click();
  await expect(tasks).toHaveText([/Bravo default task/, /Alpha default task/]);

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Space settings" }).click();
  await page
    .getByRole("combobox", { name: "Default task sort" })
    .selectOption("manual");
  await page.getByRole("button", { name: "Close settings" }).click();
  await page
    .getByRole("button", { name: "Filters and sorting", exact: true })
    .click();
  await expect(sortControl).toHaveText("Planned day");
  await page.reload();
  await page
    .getByRole("button", { name: "Filters and sorting", exact: true })
    .click();
  await expect(sortControl).toHaveText("Planned day");
  await expect(tasks).toHaveText([/Bravo default task/, /Alpha default task/]);
});

test("cycles All tasks sorting while its options menu is closed", async ({
  page,
}) => {
  const space = uniqueE2EName("Closed sort options");
  await signupUser(page);
  await createSpace(page, space);
  await openSpace(page, space);
  await createTodayTask(page, "Zulu closed menu");
  await createTodayTask(page, "Alpha closed menu");
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  const options = page.getByRole("button", {
    name: "Filters and sorting",
    exact: true,
  });
  await page
    .locator('[data-task-sort-view="all-tasks"] [data-focusable-key^="task^^"]')
    .first()
    .click();
  await page.keyboard.press("KeyQ");
  await expect(options).toHaveAttribute("title", "Sort: Alphabetical");
  await expect(
    page.locator(
      '[data-task-sort-view="all-tasks"] [data-focusable-key^="task^^"]',
    ),
  ).toHaveText([/Alpha closed menu/, /Zulu closed menu/]);
  await expect(options).toHaveAttribute("data-state", "closed");
});
