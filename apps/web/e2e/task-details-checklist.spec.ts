import { expect, test } from "playwright/test";

import {
  checklistItemRow,
  createSpace,
  createTodayTask,
  openSpace,
  openTaskDetails,
  signupUser,
  taskCard,
  uniqueE2EName,
} from "./helpers";

test("edits task details and persists checklist items", async ({ page }) => {
  const spaceName = uniqueE2EName("E2E Details Space");
  const taskTitle = uniqueE2EName("E2E details task");
  const description = uniqueE2EName("E2E persisted description");
  const checklistItem = uniqueE2EName("E2E persisted checklist item");

  await page.setViewportSize({ width: 390, height: 844 });

  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);

  await createTodayTask(page, taskTitle);

  const details = await openTaskDetails(page, taskTitle);
  await details.description.fill(description);

  await page
    .locator("[data-checklist-container]")
    .getByText("Add checklist item", { exact: true })
    .click();

  const checklistInput = page.getByRole("textbox", {
    name: "Checklist item",
  });
  await expect(checklistInput).toBeVisible();
  await checklistInput.fill(checklistItem);
  await checklistInput.blur();

  await expect(checklistInput).toHaveValue(checklistItem);

  const row = checklistItemRow(page);
  await expect(row).toBeVisible();
  await row.getByRole("checkbox").click();
  await expect(row.getByRole("checkbox")).toBeChecked();

  await page.waitForTimeout(500);

  await page.reload();

  await expect(page).toHaveURL(/\/spaces\/[^/]+\/card-details\/[^/]+$/);
  await expect(page.getByLabel("Edit task description")).toHaveValue(
    description,
  );

  await expect(
    page.getByRole("textbox", { name: "Checklist item" }),
  ).toHaveValue(checklistItem);

  const reloadedRow = checklistItemRow(page);
  await expect(reloadedRow).toBeVisible();
  await expect(reloadedRow.getByRole("checkbox")).toBeChecked();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/dates\/\d{4}-\d{2}-\d{2}$/);
  await expect(
    taskCard(page, taskTitle).getByText(checklistItem),
  ).toBeVisible();
});
