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

async function openPalette(page: Page, query: string) {
  await page.keyboard.press("Control+KeyK");
  const palette = page.getByRole("dialog", { name: "Command bar" });
  await expect(palette).toBeVisible();
  await palette.getByRole("combobox").fill(query);
  return palette;
}

test("finds scheduled, completed, and unscheduled project tasks from another view", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("Command search");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await createTodayTask(page, "Scheduled search target");
  const completed = await createTodayTask(page, "Completed search target");
  await completed.getByRole("checkbox").first().click();
  await createProject(page, "Research");
  await projectSidebarLink(page, "Research").click();
  await createProjectTask(page, "Unscheduled search target");
  await page.getByRole("link", { name: "Stats", exact: true }).click();
  await expect(page).toHaveURL(/\/stats$/);

  for (const title of [
    "Scheduled search target",
    "Completed search target",
    "Unscheduled search target",
  ]) {
    const palette = await openPalette(page, title);
    await palette.getByRole("option", { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(/\/item-details\/[^/]+$/);
    await expect(page.getByRole("textbox").first()).toHaveValue(title);
    await expect(page.getByLabel("Edit task description")).toBeVisible();
    await expect(palette).toBeHidden();
    const shortcutsPalette = await openPalette(page, "Keyboard shortcuts");
    await shortcutsPalette
      .getByRole("option", { name: "Keyboard shortcuts", exact: true })
      .click();
    const settings = page.getByRole("dialog");
    await expect(
      settings.getByRole("tab", { name: "Shortcuts", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await settings.getByRole("button", { name: "Close settings" }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/\/stats$/);
  }
  const palette = await openPalette(page, "no task with this title");
  await expect(
    palette.getByText("No matching tasks or commands."),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Switch space", exact: true }).click();
  const otherSpace = uniqueE2EName("Other search space");
  await createSpace(page, otherSpace);
  await openSpace(page, otherSpace);
  const otherPalette = await openPalette(page, "Scheduled search target");
  await expect(
    otherPalette.getByText("No matching tasks or commands."),
  ).toBeVisible();
});

test("runs focused creation and sort commands after closing the command bar", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("Command shortcuts");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await createTodayTask(page, "Alpha command task");
  await createTodayTask(page, "Bravo command task");
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  const rows = page.locator(
    '[data-task-sort-view="all-tasks"] [data-focusable-key^="task^^"]',
  );
  await expect(rows).toHaveText([/Bravo command task/, /Alpha command task/]);
  const sortPalette = await openPalette(page, "Cycle task sort");
  const sortCommand = sortPalette.getByRole("option", {
    name: /Cycle task sort/,
  });
  await expect(sortCommand).toContainText("Q");
  await sortCommand.click();
  await expect(rows).toHaveText([/Alpha command task/, /Bravo command task/]);

  const inputPalette = await openPalette(page, "");
  await inputPalette.getByRole("combobox").pressSequentially("oq");
  await page.keyboard.press("Escape");
  await expect(rows).toHaveText([/Alpha command task/, /Bravo command task/]);

  for (const position of ["before", "after"]) {
    await rows.filter({ hasText: "Alpha command task" }).click();
    const palette = await openPalette(page, `Add task ${position}`);
    const command = palette.getByRole("option", {
      name: new RegExp(`Add task ${position}`),
    });
    await expect(command).toContainText(
      position === "before" ? "Shift + O" : "O",
    );
    await command.click();
    const titleInput = page.getByLabel("Edit task title");
    await expect(titleInput).toBeFocused();
    await titleInput.fill(`Created ${position}`);
    await page.keyboard.press("Enter");
    await expect(rows.filter({ hasText: `Created ${position}` })).toBeVisible();
  }
  await rows.filter({ hasText: "Alpha command task" }).click();
  const detailsPalette = await openPalette(page, "Edit task description");
  const editDescription = detailsPalette.getByRole("option", {
    name: /Edit task description/,
  });
  await expect(editDescription).toContainText("E");
  await editDescription.click();
  await expect(page.getByLabel("Edit task description")).toBeFocused();
});

test("opens the shortcut reference in one click and from the command bar on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const spaceName = uniqueE2EName("Mobile shortcut access");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await page.locator('[data-sidebar="trigger"]').click();
  await page
    .getByRole("button", { name: "Keyboard shortcuts", exact: true })
    .click();
  const settings = page.getByRole("dialog");
  await expect(
    settings.getByRole("tab", { name: "Shortcuts", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    settings.getByRole("heading", { name: "Navigation", exact: true }),
  ).toBeVisible();
  await settings.getByRole("button", { name: "Close settings" }).click();
  const palette = await openPalette(page, "Keyboard shortcuts");
  await palette
    .getByRole("option", { name: "Keyboard shortcuts", exact: true })
    .click();
  await expect(
    settings.getByRole("tab", { name: "Shortcuts", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    settings.getByRole("heading", { name: "Navigation", exact: true }),
  ).toBeVisible();
});
