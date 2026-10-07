import { expect, test } from "playwright/test";
import {
  createSpace,
  createTodayTask,
  openSpace,
  signupUser,
  uniqueE2EName,
} from "./helpers";

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
