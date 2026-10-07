import { expect, test, type Page } from "playwright/test";
import {
  createProject,
  createProjectTask,
  createSpace,
  createTodayTask,
  openSpace,
  projectSidebarLink,
  signupUser,
  uniqueE2EName,
} from "./helpers";

const rows = (page: Page) =>
  page.locator(
    '[data-task-sort-view="all-tasks"] [data-focusable-key^="task^^"]',
  );

async function openTaskOptions(page: Page) {
  const trigger = page.getByRole("button", {
    name: "Filters and sorting",
    exact: true,
  });
  if ((await trigger.getAttribute("data-state")) !== "open")
    await trigger.click();
}

async function chooseFilter(page: Page, label: string, option: string) {
  await openTaskOptions(page);
  await page.getByRole("button", { name: `Filter by ${label}` }).click();
  await page.getByRole("option", { name: new RegExp(`^${option}`) }).click();
  await page.keyboard.press("Escape");
}

test("combines state, project, column and planned day, and keeps filters per space", async ({
  page,
}) => {
  const space = uniqueE2EName("Filtered tasks");
  await signupUser(page);
  await createSpace(page, space);
  await openSpace(page, space);
  await page.goto(page.url().replace(/\/dates\/[^/]+$/, "/dates/2026-10-08"));
  await createTodayTask(page, "Inbox scheduled");
  const completed = await createTodayTask(page, "Inbox completed");
  await completed.getByRole("checkbox").first().click();
  await createProject(page, "Research");
  await projectSidebarLink(page, "Research").click();
  await createProjectTask(page, "Research unscheduled");
  await createProject(page, "Empty project");
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(rows(page)).toHaveCount(3);
  await chooseFilter(page, "state", "To do");
  await expect(rows(page)).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Filters and sorting", exact: true }),
  ).toHaveAccessibleDescription("1 active filter. Sort: Planned day");
  await chooseFilter(page, "project", "Research");
  await expect(rows(page)).toHaveText([/Research unscheduled/]);
  await chooseFilter(page, "column", "Week");
  await openTaskOptions(page);
  await page.getByRole("button", { name: "Filter by planned day" }).click();
  await page
    .getByRole("group", { name: "Planned day matching" })
    .getByRole("button", { name: "No date", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(rows(page)).toHaveText([/Research unscheduled/]);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(rows(page)).toHaveText([/Research unscheduled/]);
  await projectSidebarLink(page, "Research").click();
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(rows(page)).toHaveText([/Research unscheduled/]);
  await page
    .getByLabel("Search task titles")
    .filter({ visible: true })
    .fill("no matching title");
  await expect(page.getByText("No tasks match these filters.")).toBeVisible();
  await openTaskOptions(page);
  await page.getByRole("button", { name: /Reset filters/ }).click();
  await expect(rows(page)).toHaveCount(3);
  await chooseFilter(page, "project", "Empty project");
  await expect(page.getByText("No tasks match these filters.")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Switch space", exact: true }).click();
  const otherSpace = uniqueE2EName("Other filters");
  await createSpace(page, otherSpace);
  await openSpace(page, otherSpace);
  await createTodayTask(page, "Other space task");
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(rows(page)).toHaveText([/Other space task/]);
  await expect(page.getByRole("button", { name: /Reset filters/ })).toHaveCount(
    0,
  );
});

test("filters an exact day and inclusive range while keeping new task editing visible", async ({
  page,
}) => {
  const space = uniqueE2EName("Date filters");
  await signupUser(page);
  await createSpace(page, space);
  await openSpace(page, space);
  for (const date of ["2026-10-08", "2026-10-10", "2026-10-12"]) {
    await page.goto(page.url().replace(/\/dates\/[^/]+$/, `/dates/${date}`));
    await createTodayTask(page, `Scheduled ${date}`);
  }
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await openTaskOptions(page);
  await page.getByRole("button", { name: "Filter by planned day" }).click();
  await page.getByRole("button", { name: "Specific day", exact: true }).click();
  await page
    .getByRole("button", { name: /Thursday, October 8th, 2026/ })
    .click();
  await page.keyboard.press("Escape");
  await expect(rows(page)).toHaveText([/Scheduled 2026-10-08/]);
  await page.keyboard.press("Escape");
  await page
    .getByLabel("Search task titles")
    .filter({ visible: true })
    .fill("Scheduled");
  await rows(page).first().click();
  await page.keyboard.press("Shift+KeyO");
  await page
    .getByLabel("Edit task title")
    .fill("New task without the search word");
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText("Oct 8");
  await page.keyboard.press("Enter");
  await expect(rows(page)).toHaveText([/Scheduled 2026-10-08/]);
  await page.getByLabel("Search task titles").filter({ visible: true }).clear();
  await openTaskOptions(page);
  await page.getByRole("button", { name: "Filter by planned day" }).click();
  await page.getByRole("button", { name: "Date range", exact: true }).click();
  await page
    .getByRole("button", { name: /Thursday, October 8th, 2026/ })
    .click();
  await page.getByRole("button", { name: /^Through:/ }).click();
  await page
    .getByRole("button", { name: /Saturday, October 10th, 2026/ })
    .click();
  await page.keyboard.press("Escape");
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).filter({ hasText: "2026-10-12" })).toHaveCount(0);
});

test("keeps filter controls usable with the keyboard at 320 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const space = uniqueE2EName("Mobile filters");
  await signupUser(page);
  await createSpace(page, space);
  await openSpace(page, space);
  await createTodayTask(page, "Mobile scheduled");
  await page.getByRole("button", { name: "Toggle Sidebar" }).last().click();
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await rows(page).first().click();
  await openTaskOptions(page);
  await expect(
    page.getByRole("button", { name: "Filter by planned day" }),
  ).toBeFocused();
  const stateFilter = page.getByRole("button", { name: "Filter by state" });
  await stateFilter.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("combobox", { name: "Search state filters" })
    .fill("Done");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.getByText("No tasks match these filters.")).toBeVisible();
  await openTaskOptions(page);
  await page.getByRole("button", { name: /Reset filters/ }).click();
  await expect(rows(page)).toHaveText([/Mobile scheduled/]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await openTaskOptions(page);
  await page.getByRole("button", { name: "Filter by planned day" }).click();
  await page.getByRole("button", { name: "Date range", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("returns keyboard focus through nested filter and sort menus", async ({
  page,
}) => {
  const space = uniqueE2EName("Nested task options");
  await signupUser(page);
  await createSpace(page, space);
  await openSpace(page, space);
  await createTodayTask(page, "Nested options task");
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  const options = page.getByRole("button", {
    name: "Filters and sorting",
    exact: true,
  });
  await options.focus();
  await page.keyboard.press("Enter");
  const state = page.getByRole("button", { name: "Filter by state" });
  await state.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("combobox", { name: "Search state filters" })
    .fill("Done");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(state).toBeFocused();
  await expect(options).toHaveAttribute("data-state", "open");
  const sort = page.getByRole("button", { name: "Sort tasks" });
  await sort.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(sort).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(options).toBeFocused();
  await expect(options).toHaveAttribute("data-state", "closed");
  await expect(page.getByText("No tasks match these filters.")).toBeVisible();
});

test("groups Blocked columns across projects and retains the selection", async ({
  page,
}) => {
  const space = uniqueE2EName("Shared columns");
  await signupUser(page);
  await createSpace(page, space);
  await openSpace(page, space);
  await createTodayTask(page, "Unblocked inbox task");
  for (const project of ["Research", "Writing"]) {
    await createProject(page, project);
    await projectSidebarLink(page, project).click();
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await page.getByRole("button", { name: "Edit column name" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("Blocked");
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await createProjectTask(page, `${project} blocked task`);
  }
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await openTaskOptions(page);
  await page.getByRole("button", { name: "Filter by column" }).click();
  await expect(page.getByRole("option")).toHaveText([
    "BlockedNot selected",
    "IdeasNot selected",
    "InboxNot selected",
    "MonthNot selected",
  ]);
  await page.getByRole("option", { name: /^Blocked/ }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page)).toContainText([
    "Research blocked task",
    "Writing blocked task",
  ]);
  await page.reload();
  await expect(rows(page)).toHaveCount(2);
  await chooseFilter(page, "project", "Research");
  await expect(rows(page)).toHaveText([/Research blocked task/]);
});
