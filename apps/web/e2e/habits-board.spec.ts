import { expect, test } from "playwright/test";

import { createSpace, openSpace, signupUser, uniqueE2EName } from "./helpers";

const columnWithTitle = (page: import("playwright/test").Page, title: string) =>
  page.locator("[data-focus-column]").filter({
    has: page.getByText(title, { exact: true }),
  });

const habitCard = (page: import("playwright/test").Page, title: string) =>
  page
    .locator('[data-focusable-key^="habit^^"]')
    .filter({ hasText: title });

test("uses the shared board, details, move, and DnD workflows for habits", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const spaceName = uniqueE2EName("E2E Habits Space");

  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);

  const spaceId = new URL(page.url()).pathname.split("/")[2];
  expect(spaceId).toBeTruthy();
  await page.goto(`/spaces/${spaceId}/habits`);

  await expect(
    page.getByRole("heading", { level: 1, name: "Habits" }),
  ).toBeVisible();
  await expect(columnWithTitle(page, "HABITS")).toHaveCount(0);

  // The empty board keeps routine creation on the standard vertical rail.
  await page.getByRole("button", { name: "ROUTINES" }).click();
  const routineDialog = page.getByRole("dialog", { name: "Routine name" });
  await routineDialog.getByRole("textbox").fill("Morning");
  await routineDialog.getByRole("button", { name: "Confirm" }).click();

  const morningHeading = page.getByText("MORNING", { exact: true });
  await expect(morningHeading).toBeVisible();
  await expect(columnWithTitle(page, "HABITS")).toHaveCount(0);
  await morningHeading.hover();
  await page.getByRole("button", { name: "Add habit to MORNING" }).click();

  const title = page.getByLabel("Edit habit title", { exact: true });
  await expect(title).toBeVisible();
  await title.fill("Drink water");
  await page.keyboard.press("Enter");

  const card = habitCard(page, "Drink water");
  await card.focus();
  await page.keyboard.press("Space");
  await expect(card.getByRole("checkbox")).toBeChecked();

  // Create an empty destination column using the same rail actions as projects.
  await morningHeading.hover();
  await page.getByRole("button", { name: "Add routine to the right" }).click();
  await routineDialog.getByRole("textbox").fill("Evening");
  await routineDialog.getByRole("button", { name: "Confirm" }).click();
  const eveningColumn = columnWithTitle(page, "EVENING");
  await expect(eveningColumn).toBeVisible();

  // M uses the shared destination modal. One ArrowDown must advance exactly once;
  // focus returns to the moved/remounted card so keyboard work can continue.
  await card.focus();
  await page.keyboard.press("KeyM");
  const moveDialog = page.getByRole("dialog", { name: "Choose routine" });
  await expect(moveDialog).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(columnWithTitle(page, "MORNING")).toContainText("Drink water");
  await expect(card).toBeFocused();

  // Unassigning materializes the optional HABITS column.
  await page.keyboard.press("KeyM");
  await expect(moveDialog).toBeVisible();
  await moveDialog.getByRole("button", { name: "Unassigned" }).click();
  const unassignedColumn = columnWithTitle(page, "HABITS");
  await expect(unassignedColumn).toContainText("Drink water");

  await page.waitForTimeout(500);
  await page.reload();
  await expect(columnWithTitle(page, "HABITS")).toContainText("Drink water");

  // V opens the shared Card Details panel; edits persist while the card moves.
  const unassignedCard = habitCard(page, "Drink water");
  await unassignedCard.focus();
  await page.keyboard.press("KeyV");
  const details = page.getByTestId("item-details-panel");
  await expect(details).toBeVisible();
  await expect(details).toContainText("Item Details");
  const heatmap = details.getByLabel("Habit completion heatmap");
  await expect(heatmap).toBeVisible();
  await expect(
    heatmap.locator('[role="checkbox"][aria-checked="true"]'),
  ).toHaveCount(1);
  const todayCell = heatmap.locator('[role="checkbox"]:not(:disabled)').last();
  await todayCell.click();
  await expect(todayCell).toHaveAttribute("aria-checked", "false");
  await todayCell.click();
  await expect(todayCell).toHaveAttribute("aria-checked", "true");
  const oldestVisibleCell = heatmap.locator('[role="checkbox"]').first();
  await expect(oldestVisibleCell).toBeEnabled();
  await oldestVisibleCell.click();
  await expect(oldestVisibleCell).toHaveAttribute("aria-checked", "true");

  const detailsTitle = details.getByLabel("Edit habit title in details");
  await detailsTitle.fill("Drink water daily");
  await detailsTitle.press("Enter");
  await details.getByLabel("Habit target time").fill("25:00");
  await details.getByLabel("Habit target time").press("Enter");
  await expect(details.getByRole("alert")).toHaveText(
    "Use 24-hour HH:MM format.",
  );
  await details.getByLabel("Habit target time").fill("08:30");
  await details.getByLabel("Habit target time").press("Enter");
  await details.getByLabel("Habit routine").selectOption({ label: "Evening" });

  await expect(columnWithTitle(page, "HABITS")).toHaveCount(0);
  await expect(eveningColumn).toContainText("Drink water daily");
  await expect(eveningColumn).toContainText("08:30");

  const eveningCard = habitCard(page, "Drink water daily");
  await eveningCard.focus();
  await page.keyboard.press("KeyV");
  await expect(details).toHaveAttribute("aria-hidden", "true");

  // A second habit must get its own empty heatmap, not the first habit's data.
  const eveningHeading = page.getByText("EVENING", { exact: true });
  await eveningHeading.hover();
  await page.getByRole("button", { name: "Add habit to EVENING" }).click();
  const secondTitle = page.getByLabel("Edit habit title", { exact: true });
  await secondTitle.fill("Read");
  await secondTitle.press("Enter");
  const secondCard = habitCard(page, "Read");
  await secondCard.focus();
  await page.keyboard.press("KeyV");
  await expect(details.getByLabel("Habit completion heatmap")).toBeVisible();
  await expect(
    details.locator(
      '[aria-label="Habit completion heatmap"] [role="checkbox"][aria-checked="true"]',
    ),
  ).toHaveCount(0);
  await secondCard.focus();
  await page.keyboard.press("KeyV");
  await expect(details).toHaveAttribute("aria-hidden", "true");

  await page.waitForTimeout(500);
  await page.reload();
  const persistedCard = habitCard(page, "Drink water daily");
  await expect(eveningColumn).toContainText("Drink water daily");
  await expect(persistedCard).toContainText("08:30");
  await expect(persistedCard.getByRole("checkbox")).toBeChecked();

  // Drag into an empty column, then reload to verify the persisted placement.
  const morningColumn = columnWithTitle(page, "MORNING");
  await persistedCard.dragTo(morningColumn);
  await expect(morningColumn).toContainText("Drink water daily");
  await page.waitForTimeout(500);
  await page.reload();
  await expect(columnWithTitle(page, "MORNING")).toContainText(
    "Drink water daily",
  );
  await expect(columnWithTitle(page, "HABITS")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "MORNING actions" }),
  ).toBeVisible();
});
