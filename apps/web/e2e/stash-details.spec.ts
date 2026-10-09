import { expect, test } from "playwright/test";
import {
  createSpace,
  createTodayTask,
  openSpace,
  openTaskActions,
  projectTaskItem,
  signupUser,
  stashPanel,
  stashTaskItem,
  uniqueE2EName,
} from "./helpers";

test("opens and edits the task behind a Stash entry", async ({ page }) => {
  const title = uniqueE2EName("Stash details task");
  const spaceName = uniqueE2EName("Stash details space");
  const description = "Keep these notes with the task";
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await createTodayTask(page, title);
  await openTaskActions(page, title);
  await page.getByRole("menuitem", { name: /stash task/i }).click();
  await expect(page.getByTestId("stash-count")).toHaveText("1");
  await page.keyboard.press("Backslash");
  await expect(stashPanel(page)).toHaveAttribute("aria-hidden", "false");

  const stashedTask = stashTaskItem(page, title);
  await stashedTask.click();
  await expect(stashedTask).toBeFocused();
  await page.keyboard.press("KeyV");
  const details = page.getByTestId("item-details-panel");
  await expect(details).toHaveAttribute("aria-hidden", "false");
  await expect(details.getByLabel("Edit task description")).toBeVisible();
  await expect(details).toContainText(title);
  await details.getByLabel("Edit task description").fill(description);
  await details.getByLabel("Edit task description").blur();

  await page.getByRole("link", { name: /^Inbox/ }).click();
  const projectTask = projectTaskItem(page, title);
  await expect(projectTask).toBeVisible();
  await projectTask.click();
  await expect(details.getByLabel("Edit task description")).toHaveValue(
    description,
  );
  await stashedTask.click();
  await expect(details.getByLabel("Edit task description")).toHaveValue(
    description,
  );
  await page.reload();
  await expect(stashedTask).toBeVisible();
  await stashedTask.click();
  await expect(details.getByLabel("Edit task description")).toHaveValue(
    description,
  );
  await page.keyboard.press("KeyV");
  await expect(details).toHaveAttribute("aria-hidden", "true");
});
