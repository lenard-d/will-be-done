import { expect, test, type Page } from "playwright/test";

import {
  createProjectTask,
  createSpace,
  openSpace,
  openTaskActions,
  projectTaskCard,
  signupUser,
  templateCard,
  uniqueE2EName,
} from "./helpers";

test("converts a task into a recurring template and persists it", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("E2E Recurring Space");
  const taskTitle = uniqueE2EName("E2E recurring task");

  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);

  await page.getByRole("link", { name: /^Inbox(?:\s+\d+)?$/ }).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/projects\/[^/]+$/);

  await createProjectTask(page, taskTitle);
  await expect(projectTaskCard(page, taskTitle)).toBeVisible();
  await expect(templateCard(page, taskTitle)).toHaveCount(0);

  await openTaskActions(page, taskTitle);
  await page.getByRole("menuitem", { name: /convert to template/i }).click();

  await expect(page.getByRole("heading", { name: "Repeat" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Daily" })).toBeVisible();
  await page.getByRole("button", { name: "Ok" }).click();

  await expect(templateCard(page, taskTitle)).toBeVisible();
  await expect(projectTaskCard(page, taskTitle)).toBeVisible();

  const detailsPanel = await openTemplateDetails(page, taskTitle);
  await expect(
    detailsPanel.getByText("Repeat:", { exact: true }),
  ).toBeVisible();
  await expect(
    detailsPanel.getByRole("button", { name: "every day" }),
  ).toBeVisible();

  await page.reload();

  await expect(templateCard(page, taskTitle)).toBeVisible();
  await expect(projectTaskCard(page, taskTitle)).toBeVisible();

  const reloadedDetailsPanel = await openTemplateDetails(page, taskTitle);
  await expect(
    reloadedDetailsPanel.getByRole("button", { name: "every day" }),
  ).toBeVisible();
});

async function openTemplateDetails(page: Page, title: string) {
  const detailsPanel = page.getByTestId("card-details-panel");

  await templateCard(page, title).click();

  if ((await detailsPanel.getAttribute("aria-hidden")) !== "false") {
    await page.keyboard.press("KeyV");
  }

  await expect(detailsPanel).toHaveAttribute("aria-hidden", "false");
  await expect(
    detailsPanel.getByRole("button", { name: "Convert to task" }),
  ).toBeVisible();

  return detailsPanel;
}
