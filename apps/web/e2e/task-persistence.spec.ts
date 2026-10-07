import { expect, test } from "playwright/test";

import {
  createSpace,
  createTodayTask,
  openSpace,
  signInUser,
  signupUser,
  taskItem,
  uniqueE2EName,
} from "./helpers";

test("signs up, signs in, creates a space, and keeps today's task after reload", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("E2E Space");
  const taskTitle = uniqueE2EName("E2E task");
  const user = await signupUser(page);

  await page.getByRole("button", { name: "Sign Out" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();

  await signInUser(page, user);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await createTodayTask(page, taskTitle);

  await page.reload();

  await expect(page).toHaveURL(/\/spaces\/[^/]+\/dates\/\d{4}-\d{2}-\d{2}$/);
  await expect(taskItem(page, taskTitle)).toBeVisible();
});

test("persists a title before Enter or Escape finishes editing", async ({
  page,
}) => {
  const space = uniqueE2EName("Immediate title persistence");
  await signupUser(page);
  await createSpace(page, space);
  await openSpace(page, space);
  await createTodayTask(page, "Title saved with Enter");
  await page.reload();
  const task = taskItem(page, "Title saved with Enter");
  await expect(task).toBeVisible();
  await task.click();
  await page.keyboard.press("Enter");
  await page.getByLabel("Edit task title").fill("Title saved with Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Edit task title")).toHaveCount(0);
  await page.reload();
  await expect(taskItem(page, "Title saved with Escape")).toBeVisible();
});
