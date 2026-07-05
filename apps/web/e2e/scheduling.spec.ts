import { expect, test } from "playwright/test";

import {
  createProjectTask,
  createSpace,
  dailyTaskCard,
  openSpace,
  openTaskActions,
  projectTaskCard,
  signupUser,
  uniqueE2EName,
} from "./helpers";

test("schedules an Inbox task for Today and clears the schedule", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("E2E Schedule Space");
  const taskTitle = uniqueE2EName("E2E scheduled task");
  const inboxWithOneTask = page.getByRole("link", { name: /^Inbox\s+1$/ });

  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);

  await page.getByRole("link", { name: /^Inbox(?:\s+\d+)?$/ }).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/projects\/[^/]+$/);

  await createProjectTask(page, taskTitle);
  await expect(projectTaskCard(page, taskTitle)).toBeVisible();
  await expect(inboxWithOneTask).toBeVisible();

  await openTaskActions(page, taskTitle);
  await page.getByRole("menuitem", { name: /schedule today/i }).click();

  await page.getByRole("link", { name: /today/i }).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/dates\/\d{4}-\d{2}-\d{2}$/);
  await expect(dailyTaskCard(page, taskTitle)).toBeVisible();

  await openTaskActions(page, taskTitle);
  await page.getByRole("menuitem", { name: /reset schedule/i }).click();

  await expect(dailyTaskCard(page, taskTitle)).toHaveCount(0);
  await expect(inboxWithOneTask).toBeVisible();

  await page.getByRole("link", { name: /^Inbox(?:\s+\d+)?$/ }).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/projects\/[^/]+$/);
  await expect(projectTaskCard(page, taskTitle)).toBeVisible();

  await page.reload();
  await expect(projectTaskCard(page, taskTitle)).toBeVisible();
  await expect(inboxWithOneTask).toBeVisible();

  await page.getByRole("link", { name: /today/i }).click();
  await expect(dailyTaskCard(page, taskTitle)).toHaveCount(0);
});
