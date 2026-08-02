import { expect, test } from "playwright/test";

import {
  createSpace,
  createTodayTask,
  openSpace,
  signupUser,
  taskItem,
  uniqueE2EName,
} from "./helpers";

test("allows local task writes while offline and keeps them after reconnect", async ({
  context,
  page,
}) => {
  const spaceName = uniqueE2EName("E2E Offline Space");
  const initialTitle = uniqueE2EName("E2E offline task");
  const editedTitle = uniqueE2EName("E2E offline edited task");

  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await expect(page.getByRole("button", { name: "Add task" })).toBeVisible();

  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);

  const offlineItem = await createTodayTask(page, initialTitle);
  await expect(offlineItem).toBeVisible();

  await offlineItem.dblclick();
  await offlineItem.getByLabel("Edit task title").fill(editedTitle);
  await page.keyboard.press("Enter");

  await expect(taskItem(page, editedTitle)).toBeVisible();
  await expect(taskItem(page, initialTitle)).toHaveCount(0);
  await page.waitForTimeout(500);

  await context.setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);

  await page.reload();

  await expect(page).toHaveURL(/\/spaces\/[^/]+\/dates\/\d{4}-\d{2}-\d{2}$/);
  await expect(taskItem(page, editedTitle)).toBeVisible();
  await expect(taskItem(page, initialTitle)).toHaveCount(0);
});
