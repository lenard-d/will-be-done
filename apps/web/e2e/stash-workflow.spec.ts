import { expect, test } from "playwright/test";

import {
  createSpace,
  createTodayTask,
  dailyTaskCard,
  openSpace,
  openTaskActions,
  projectTaskCard,
  signupUser,
  stashPanel,
  stashTaskCard,
  uniqueE2EName,
} from "./helpers";

test("stashes a task and keeps it available across Today and Inbox", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("E2E Stash Space");
  const taskTitle = uniqueE2EName("E2E stashed task");
  const stashToggle = page.getByTestId("stash-toggle");
  const stashCount = page.getByTestId("stash-count");

  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);

  await createTodayTask(page, taskTitle);
  await expect(dailyTaskCard(page, taskTitle)).toBeVisible();
  await expect(stashToggle).toHaveAttribute("aria-expanded", "false");

  await openTaskActions(page, taskTitle);
  await page.getByRole("menuitem", { name: /stash task/i }).click();

  await expect(dailyTaskCard(page, taskTitle)).toHaveCount(0);
  await expect(stashCount).toHaveText("1");
  await expect(stashPanel(page)).toHaveAttribute("aria-hidden", "true");

  await page.keyboard.press("Backslash");
  await expect(stashToggle).toHaveAttribute("aria-expanded", "true");
  await expect(stashPanel(page)).toHaveAttribute("aria-hidden", "false");
  await expect(stashTaskCard(page, taskTitle)).toBeVisible();

  await page.keyboard.press("Backslash");
  await expect(stashToggle).toHaveAttribute("aria-expanded", "false");
  await expect(stashPanel(page)).toHaveAttribute("aria-hidden", "true");

  await page.keyboard.press("Backslash");
  await expect(stashToggle).toHaveAttribute("aria-expanded", "true");
  await expect(stashTaskCard(page, taskTitle)).toBeVisible();

  await page.getByRole("link", { name: /^Inbox(?:\s+\d+)?$/ }).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/projects\/[^/]+$/);
  await expect(projectTaskCard(page, taskTitle)).toBeVisible();
  await expect(stashTaskCard(page, taskTitle)).toBeVisible();
  await expect(stashCount).toHaveText("1");

  await page.reload();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/projects\/[^/]+$/);
  await expect(stashToggle).toHaveAttribute("aria-expanded", "true");
  await expect(stashTaskCard(page, taskTitle)).toBeVisible();
  await expect(stashCount).toHaveText("1");

  await page.getByRole("link", { name: /today/i }).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/dates\/\d{4}-\d{2}-\d{2}$/);
  await expect(dailyTaskCard(page, taskTitle)).toHaveCount(0);
  await expect(stashTaskCard(page, taskTitle)).toBeVisible();
});
