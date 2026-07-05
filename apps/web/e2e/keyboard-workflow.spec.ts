import { expect, type Locator, test } from "playwright/test";

import {
  createProjectTask,
  createSpace,
  dailyTaskCard,
  openSpace,
  projectTaskCard,
  signupUser,
  stashPanel,
  stashTaskCard,
  uniqueE2EName,
} from "./helpers";

test("supports a keyboard-only planning loop", async ({ page }) => {
  const spaceName = uniqueE2EName("E2E Keyboard Space");
  const firstTitle = uniqueE2EName("E2E keyboard first task");
  const aboveTitle = uniqueE2EName("E2E keyboard above task");
  const belowTitle = uniqueE2EName("E2E keyboard below task");

  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);

  await page.getByRole("link", { name: /^Inbox(?:\s+\d+)?$/ }).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/projects\/[^/]+$/);

  const firstCard = await createProjectTask(page, firstTitle);
  await firstCard.click();
  await expectFocused(firstCard);

  await page.keyboard.press("KeyO");
  await page.getByLabel("Edit task title").fill(belowTitle);
  await page.keyboard.press("Enter");
  await expect(projectTaskCard(page, belowTitle)).toBeVisible();

  await projectTaskCard(page, belowTitle).click();
  await page.keyboard.down("Shift");
  await page.keyboard.press("KeyO");
  await page.keyboard.up("Shift");
  await page.getByLabel("Edit task title").fill(aboveTitle);
  await page.keyboard.press("Enter");
  await expect(projectTaskCard(page, aboveTitle)).toBeVisible();

  await projectTaskCard(page, firstTitle).click();
  await page.keyboard.press("KeyJ");
  await expectFocused(projectTaskCard(page, aboveTitle));

  await page.keyboard.press("KeyK");
  await expectFocused(projectTaskCard(page, firstTitle));

  await page.keyboard.press("Space");
  await expect(projectTaskCard(page, firstTitle)).toHaveAttribute(
    "data-ignore-drop",
    "true",
  );

  await projectTaskCard(page, aboveTitle).click();
  await page.keyboard.press("KeyT");

  await page.getByRole("link", { name: /today/i }).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/dates\/\d{4}-\d{2}-\d{2}$/);
  await expect(dailyTaskCard(page, aboveTitle)).toBeVisible();

  await dailyTaskCard(page, aboveTitle).click();
  await page.keyboard.press("KeyR");
  await expect(dailyTaskCard(page, aboveTitle)).toHaveCount(0);

  await page.getByRole("link", { name: /^Inbox(?:\s+\d+)?$/ }).click();
  await expect(projectTaskCard(page, aboveTitle)).toBeVisible();

  await projectTaskCard(page, belowTitle).click();
  await page.keyboard.down("Shift");
  await page.keyboard.press("KeyS");
  await page.keyboard.up("Shift");
  await expect(page.getByTestId("stash-count")).toHaveText("1");

  await page.keyboard.press("Backslash");
  await expect(stashPanel(page)).toHaveAttribute("aria-hidden", "false");
  await expect(stashTaskCard(page, belowTitle)).toBeVisible();

  await page.getByRole("link", { name: "timeline" }).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/timeline\/\d{4}-\d{2}-\d{2}/);
  await expect(stashPanel(page)).toHaveAttribute("aria-hidden", "false");
  await stashTaskCard(page, belowTitle).click();
  await page.keyboard.press("KeyV");
  await expect(page.getByTestId("card-details-panel")).toHaveAttribute(
    "aria-hidden",
    "false",
  );

  await page.keyboard.press("KeyZ");
  await expect(stashPanel(page)).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByTestId("card-details-panel")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

async function expectFocused(card: Locator) {
  await expect(card).toHaveClass(/ring-2 ring-accent/);
}
