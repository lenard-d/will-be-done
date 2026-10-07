import { expect, test } from "playwright/test";
import {
  createSpace,
  createTodayTask,
  openSpace,
  openTaskActions,
  signupUser,
  uniqueE2EName,
} from "./helpers";

for (const deletion of ["keyboard", "menu"]) {
  for (const view of ["all-tasks", "project", "day"]) {
    test(`restores the last deleted task with Cmd+Z after ${deletion} deletion in ${view}`, async ({
      page,
    }) => {
      const space = uniqueE2EName("Delete undo");
      await signupUser(page);
      await createSpace(page, space);
      await openSpace(page, space);
      await createTodayTask(page, "Restore deleted task");
      if (view === "all-tasks") {
        await page.getByRole("link", { name: "Tasks", exact: true }).click();
      } else if (view === "project") {
        await page.getByRole("link", { name: /^Inbox(?:\s+\d+)?$/ }).click();
      }
      await expect(page).toHaveURL(
        view === "all-tasks"
          ? /\/all-tasks$/
          : view === "project"
            ? /\/projects\/[^/]+$/
            : /\/dates\/[^/]+$/,
      );
      const task = page
        .locator(
          '[data-focusable-key^="task^^"], [data-focusable-key^="dailyEntry^^"]',
        )
        .filter({ hasText: "Restore deleted task" });
      if (deletion === "keyboard") {
        await task.click();
        await page.keyboard.press("Backspace");
      } else {
        await openTaskActions(page, "Restore deleted task");
        const remove = page.getByRole("menuitem", { name: /^Delete/ });
        await remove.focus();
        await remove.press("Enter");
      }
      await expect(task).toHaveCount(0);
      if (view === "all-tasks") {
        await page
          .getByRole("button", { name: "Filters and sorting", exact: true })
          .focus();
      }
      await page.keyboard.press("Meta+KeyZ");
      await expect(task).toBeVisible();
      await page.keyboard.press("Meta+Shift+KeyZ");
      await expect(task).toHaveCount(0);
    });
  }
}

test("undoes a checkbox change while the checkbox has focus", async ({
  page,
}) => {
  const space = uniqueE2EName("Checkbox undo");
  await signupUser(page);
  await createSpace(page, space);
  await openSpace(page, space);
  const task = await createTodayTask(page, "Restore completion");
  const checkbox = task.getByRole("checkbox").first();
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await checkbox.focus();
  await page.keyboard.press("Meta+KeyZ");
  await expect(checkbox).not.toBeChecked();
  await page.keyboard.press("Meta+Shift+KeyZ");
  await expect(checkbox).toBeChecked();
});

test("keeps text undo in the title editor separate from task undo", async ({
  page,
}) => {
  const space = uniqueE2EName("Editor undo");
  await signupUser(page);
  await createSpace(page, space);
  await openSpace(page, space);
  const task = await createTodayTask(page, "Editor task");
  await task.getByRole("checkbox").first().click();
  await task.dblclick();
  const editor = page.getByLabel("Edit task title");
  await expect(editor).toBeFocused();
  await editor.press("End");
  await page.keyboard.type("!");
  await page.keyboard.press("Control+KeyZ");
  await expect(editor).toHaveValue("Editor task");
  await expect(task.getByRole("checkbox").first()).toBeChecked();
});

test("undoes and redoes same-day keyboard and drag reordering in Tasks", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("Task command integration");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await createTodayTask(page, "Bravo command task");
  await createTodayTask(page, "Alpha command task");
  await page.getByRole("link", { name: "Tasks", exact: true }).click();

  const rows = page.locator(
    '[data-task-sort-view="all-tasks"] [data-focusable-key^="task^^"]',
  );
  const alpha = rows.filter({ hasText: "Alpha command task" });
  const bravo = rows.filter({ hasText: "Bravo command task" });
  await expect(rows).toHaveText([/Alpha command task/, /Bravo command task/]);
  await bravo.click();
  await page.keyboard.press("Control+ArrowUp");
  await expect(rows).toHaveText([/Bravo command task/, /Alpha command task/]);
  await page.keyboard.press("Control+KeyZ");
  await expect(rows).toHaveText([/Alpha command task/, /Bravo command task/]);
  await page.keyboard.press("Control+Shift+KeyZ");
  await expect(rows).toHaveText([/Bravo command task/, /Alpha command task/]);

  const targetBox = await bravo.boundingBox();
  if (!targetBox) throw new Error("The target task is not visible");
  await alpha.dragTo(bravo, {
    targetPosition: { x: targetBox.width / 2, y: 4 },
  });
  await expect(rows).toHaveText([/Alpha command task/, /Bravo command task/]);
  await page.keyboard.press("Control+KeyZ");
  await expect(rows).toHaveText([/Bravo command task/, /Alpha command task/]);
  await page.keyboard.press("Control+Shift+KeyZ");
  await expect(rows).toHaveText([/Alpha command task/, /Bravo command task/]);
});

test("opens Tasks and toggles the sidebar through the command palette", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("Palette Tasks integration");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);

  await expect(
    page.getByRole("button", { name: "Add task", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+KeyK");
  const palette = page.getByRole("dialog");
  await expect(palette).toBeVisible();
  await palette.getByRole("combobox").fill("Tasks");
  await palette.getByRole("option", { name: "Tasks", exact: true }).click();
  await expect(page).toHaveURL(/\/all-tasks$/);
  await expect(
    page.getByRole("heading", { name: "All tasks", exact: true }),
  ).toBeVisible();
  await expect(palette).toBeHidden();

  const sidebarTrigger = page.locator('[data-sidebar="trigger"]');
  await expect(sidebarTrigger).toHaveAttribute("data-open", "true");
  await page.keyboard.press("Control+KeyK");
  await palette.getByRole("combobox").fill("Toggle main sidebar");
  await palette.getByRole("option", { name: /Toggle main sidebar/ }).click();
  await expect(sidebarTrigger).toHaveAttribute("data-open", "false");
  await expect(palette).toBeHidden();
  await page.keyboard.press("Control+KeyK");
  await palette.getByRole("combobox").fill("Toggle main sidebar");
  await palette.getByRole("option", { name: /Toggle main sidebar/ }).click();
  await expect(sidebarTrigger).toHaveAttribute("data-open", "true");
});
