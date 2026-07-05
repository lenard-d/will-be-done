import { expect, test } from "playwright/test";

import {
  createProject,
  createProjectTask,
  createSpace,
  openSpace,
  projectSidebarLink,
  projectTaskCard,
  signupUser,
  uniqueE2EName,
} from "./helpers";

test("creates projects and moves a task between them", async ({ page }) => {
  const spaceName = uniqueE2EName("E2E Project Space");
  const sourceProject = uniqueE2EName("E2E Source Project");
  const destinationProject = uniqueE2EName("E2E Destination Project");
  const taskTitle = uniqueE2EName("E2E project task");

  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);

  await createProject(page, sourceProject);
  await createProject(page, destinationProject);

  await expect(projectSidebarLink(page, sourceProject)).toBeVisible();
  await expect(projectSidebarLink(page, destinationProject)).toBeVisible();

  await projectSidebarLink(page, sourceProject).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/projects\/[^/]+$/);
  await expect(
    page.getByRole("heading", { name: sourceProject }),
  ).toBeVisible();

  await createProjectTask(page, taskTitle);
  await expect(projectTaskCard(page, taskTitle)).toBeVisible();
  await expect(projectSidebarLink(page, sourceProject, 1)).toBeVisible();
  await expect(projectSidebarLink(page, destinationProject, 1)).toHaveCount(0);

  await projectTaskCard(page, taskTitle).click();
  await page.keyboard.press("KeyV");

  const detailsPanel = page.getByTestId("card-details-panel");
  await expect(detailsPanel).toHaveAttribute("aria-hidden", "false");
  await expect(detailsPanel.getByText(sourceProject)).toBeVisible();

  await detailsPanel.getByRole("button", { name: "Move to project" }).click();

  const projectSearch = page.getByPlaceholder("Search projects...");
  await expect(projectSearch).toBeVisible();
  await projectSearch.fill(destinationProject);
  await page
    .getByRole("dialog", { name: "Choose project" })
    .getByRole("button", { name: destinationProject })
    .click();

  await expect(projectSearch).toHaveCount(0);
  await expect(projectTaskCard(page, taskTitle)).toHaveCount(0);
  await expect(projectSidebarLink(page, sourceProject, 1)).toHaveCount(0);
  await expect(projectSidebarLink(page, destinationProject, 1)).toBeVisible();

  await projectSidebarLink(page, destinationProject, 1).click();
  await expect(
    page.getByRole("heading", { name: destinationProject }),
  ).toBeVisible();
  await expect(projectTaskCard(page, taskTitle)).toBeVisible();

  await page.reload();
  await expect(projectTaskCard(page, taskTitle)).toBeVisible();
  await expect(projectSidebarLink(page, destinationProject, 1)).toBeVisible();
  await expect(projectSidebarLink(page, sourceProject, 1)).toHaveCount(0);
});
