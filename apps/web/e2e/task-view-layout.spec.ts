import { expect, test } from "playwright/test";

import {
  createSpace,
  createTodayTask,
  openSpace,
  signupUser,
  uniqueE2EName,
} from "./helpers";

test("keeps task details at the top while the view and sidebar remain usable", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("Details layout space");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  const task = await createTodayTask(page, "Full height details");
  await task.click();
  await page.keyboard.press("KeyV");

  const panel = page.getByTestId("item-details-panel");
  await expect(
    panel.getByText("Full height details", { exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await panel.boundingBox())?.y).toBe(0);
  await expect.poll(async () => (await panel.boundingBox())?.height).toBe(720);

  const trigger = page.locator('[data-sidebar="trigger"]');
  await trigger.click();
  await trigger.click();
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "All tasks", exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await panel.boundingBox())?.y).toBe(0);
  await page.getByRole("link", { name: /^Inbox/ }).click();
  await expect(
    page.getByRole("button", { name: "Delete project" }),
  ).toBeVisible();
  await expect.poll(async () => (await panel.boundingBox())?.y).toBe(0);
});

test("changes project sorting with a keyboard menu beside Delete", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("Sort menu space");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await createTodayTask(page, "Zulu menu task");
  await createTodayTask(page, "Alpha menu task");
  await page.getByRole("link", { name: /^Inbox/ }).click();

  const control = page.getByRole("button", { name: "Sort tasks" });
  const deleteProject = page.getByRole("button", { name: "Delete project" });
  await expect(deleteProject).toBeVisible();
  await expect(control).toHaveCount(1);
  await expect(control).toHaveText("Planned day");
  const sortBounds = await control.boundingBox();
  const deleteBounds = await deleteProject.boundingBox();
  if (!sortBounds || !deleteBounds)
    throw new Error("Project controls are missing");
  expect(
    Math.abs(
      sortBounds.y +
        sortBounds.height / 2 -
        deleteBounds.y -
        deleteBounds.height / 2,
    ),
  ).toBeLessThan(1);

  await control.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitemradio", { name: "Planned day" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("menuitemradio", { name: "Planned day" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitemradio", { name: "Alphabetical" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(control).toHaveText("Alphabetical");
  await expect(control).toBeFocused();
  await expect(page.locator('[data-focusable-key^="task^^"]')).toHaveText([
    /Alpha menu task/,
    /Zulu menu task/,
  ]);
});

test.describe("mobile project sorting", () => {
  test.use({ viewport: { width: 320, height: 740 }, hasTouch: true });

  test("opens the sort menu from the project header without horizontal overflow", async ({
    page,
  }) => {
    const spaceName = uniqueE2EName("Mobile sort menu space");
    await signupUser(page);
    await createSpace(page, spaceName);
    await openSpace(page, spaceName);
    await page.locator('[data-sidebar="trigger"]').tap();
    await page.getByRole("link", { name: /^Inbox/ }).tap();
    const control = page.getByRole("button", { name: "Sort tasks" });
    await expect(control).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Delete project" }),
    ).toBeInViewport();
    await control.tap();
    await page.getByRole("menuitemradio", { name: "Manual" }).tap();
    await expect(control).toHaveText("Manual");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(320);
  });
});
