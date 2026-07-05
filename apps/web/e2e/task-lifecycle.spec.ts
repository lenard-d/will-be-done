import { expect, test } from "playwright/test";

import {
  createSpace,
  createTodayTask,
  openSpace,
  openTaskActions,
  signupUser,
  taskCard,
  uniqueE2EName,
} from "./helpers";

test("creates, edits, toggles, and deletes a task across Today and Inbox", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("E2E Lifecycle Space");
  const initialTitle = uniqueE2EName("E2E lifecycle task");
  const editedTitle = uniqueE2EName("E2E lifecycle edited");
  const inboxWithOneTask = page.getByRole("link", { name: /^Inbox\s+1$/ });

  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);

  const createdCard = await createTodayTask(page, initialTitle);
  await expect(createdCard).toBeVisible();
  await expect(inboxWithOneTask).toBeVisible();

  await createdCard.dblclick();
  await createdCard.getByLabel("Edit task title").fill(editedTitle);
  await page.keyboard.press("Enter");

  await expect(taskCard(page, editedTitle)).toBeVisible();
  await expect(taskCard(page, initialTitle)).toHaveCount(0);
  await page.waitForTimeout(500);

  await page.reload();
  await expect(taskCard(page, editedTitle)).toBeVisible();
  await expect(inboxWithOneTask).toBeVisible();

  await openTaskActions(page, editedTitle);
  await page.getByRole("menuitem", { name: /mark as done/i }).click();

  const doneTodayCard = taskCard(page, editedTitle);
  await expect(doneTodayCard).toBeVisible();
  await expect(doneTodayCard).toHaveAttribute("data-ignore-drop", "true");
  await expect(inboxWithOneTask).toHaveCount(0);

  await page.getByRole("link", { name: /^Inbox$/ }).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/projects\/[^/]+$/);
  await expect(taskCard(page, editedTitle)).toBeVisible();

  await openTaskActions(page, editedTitle);
  await expect(
    page.getByRole("menuitem", { name: /mark as todo/i }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await taskCard(page, editedTitle).getByRole("checkbox").first().click();

  const todoInboxCard = taskCard(page, editedTitle);
  await expect(todoInboxCard).toBeVisible();
  await expect(todoInboxCard).not.toHaveAttribute("data-ignore-drop", "true");
  await expect(inboxWithOneTask).toBeVisible();

  await page.getByRole("link", { name: /today/i }).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/dates\/\d{4}-\d{2}-\d{2}$/);
  const todoTodayCard = taskCard(page, editedTitle);
  await expect(todoTodayCard).toBeVisible();

  await todoTodayCard.click();
  await page.keyboard.press("Control+Backspace");

  await expect(taskCard(page, editedTitle)).toHaveCount(0);
  await expect(inboxWithOneTask).toHaveCount(0);
  await page.waitForTimeout(500);

  await page.reload();
  await expect(taskCard(page, editedTitle)).toHaveCount(0);

  await page.getByRole("link", { name: /^Inbox(?:\s+\d+)?$/ }).click();
  await expect(taskCard(page, editedTitle)).toHaveCount(0);
});
