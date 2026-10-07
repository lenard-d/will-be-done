import { expect, test, type Locator, type Page } from "playwright/test";
import {
  createProject,
  createProjectTask,
  createSpace,
  openSpace,
  openTaskActions,
  projectSidebarLink,
  signInUser,
  signupUser,
  uniqueE2EName,
} from "./helpers";

const projectColumns = (page: Page) =>
  page.locator('[data-column-model-type="projectSection"][data-focus-column]');
const rows = (column: Locator) =>
  column.locator('[data-focusable-key^="task^^"]');

async function createColumnTask(column: Locator, title: string) {
  await column.locator("[data-focus-placeholder]").focus();
  await column.page().keyboard.press("KeyO");
  await column.page().getByLabel("Edit task title").fill(title);
  await column.page().keyboard.press("Enter");
  await expect(rows(column).filter({ hasText: title })).toBeVisible();
}

for (const mode of ["Planned day", "Alphabetical", "Manual"]) {
  for (const destination of ["empty column", "task row"]) {
    test(`moves between project columns with ${mode} onto ${destination}`, async ({
      page,
      browser,
    }) => {
      const user = await signupUser(page);
      const space = uniqueE2EName("Project drag");
      const project = uniqueE2EName("Drag project");
      await createSpace(page, space);
      await openSpace(page, space);
      await createProject(page, project);
      await projectSidebarLink(page, project).click();
      const source = projectColumns(page).first();
      const target = projectColumns(page).nth(1);
      await createProjectTask(page, "Move this task");
      await openTaskActions(page, "Move this task");
      await page.getByRole("menuitem", { name: /schedule today/i }).click();
      if (destination === "task row")
        await createColumnTask(target, "Target task");
      const sort = page.getByRole("button", {
        name: "Sort tasks",
        exact: true,
      });
      await sort.click();
      await page
        .getByRole("menuitemradio", { name: mode, exact: true })
        .click();
      const task = rows(source).filter({ hasText: "Move this task" });
      const date = await task
        .getByRole("button", { name: /^[A-Z][a-z]{2} \d/ })
        .innerText();
      const otherDevice = await browser.newContext({
        baseURL: new URL(page.url()).origin,
      });
      const observer = await otherDevice.newPage();
      await signInUser(observer, user);
      await observer.goto(page.url());
      const observerSource = projectColumns(observer).first();
      const observerTarget = projectColumns(observer).nth(1);
      await expect(
        rows(observerSource).filter({ hasText: "Move this task" }),
      ).toContainText(date);
      await task.dragTo(
        destination === "empty column" ? target : rows(target).first(),
      );
      await expect(rows(source)).toHaveCount(0);
      await expect(
        rows(target).filter({ hasText: "Move this task" }),
      ).toContainText(date);
      await expect(
        rows(observerTarget).filter({ hasText: "Move this task" }),
      ).toContainText(date);
      await page.keyboard.press("Control+KeyZ");
      await expect(
        rows(source).filter({ hasText: "Move this task" }),
      ).toContainText(date);
      await expect(
        rows(observerSource).filter({ hasText: "Move this task" }),
      ).toContainText(date);
      await page.keyboard.press("Control+Shift+KeyZ");
      await expect(rows(source)).toHaveCount(0);
      await expect(
        rows(target).filter({ hasText: "Move this task" }),
      ).toContainText(date);
      await expect(
        rows(observerTarget).filter({ hasText: "Move this task" }),
      ).toContainText(date);
      await page.reload();
      await expect(
        rows(target).filter({ hasText: "Move this task" }),
      ).toContainText(date);
      await otherDevice.close();
    });
  }
}

test("rejects task moves between saved All tasks views", async ({ page }) => {
  await signupUser(page);
  const space = uniqueE2EName("View drag boundaries");
  await createSpace(page, space);
  await openSpace(page, space);
  await page.getByRole("link", { name: /^Inbox/ }).click();
  await createProjectTask(page, "Alpha task");
  await openTaskActions(page, "Alpha task");
  await page.getByRole("menuitem", { name: /schedule today/i }).click();
  await createProjectTask(page, "Bravo task");
  await openTaskActions(page, "Bravo task");
  await page.getByRole("menuitem", { name: /schedule today/i }).click();
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await page.getByRole("button", { name: "Add column", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Column name", exact: true });
  await dialog.getByRole("textbox").fill("Second view");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  const views = page.locator("[data-all-tasks-column]");
  const first = views.first();
  const second = views.nth(1);
  const initial = await rows(first).allTextContents();
  await rows(first)
    .filter({ hasText: "Alpha task" })
    .dragTo(rows(second).filter({ hasText: "Bravo task" }));
  await expect(rows(first)).toHaveText(initial);
  await expect(rows(second)).toHaveText(initial);
  await page.reload();
  await expect(rows(first)).toHaveText(initial);
  await expect(rows(second)).toHaveText(initial);
});
