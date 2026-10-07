import { expect, test, type Page } from "playwright/test";

import { createSpace, openSpace, signupUser, uniqueE2EName } from "./helpers";

async function openNavigationSpace(page: Page) {
  const spaceName = uniqueE2EName("Sidebar navigation");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
}

test("keeps view navigation usable when the sidebar is resized and reopened", async ({
  page,
}) => {
  await openNavigationSpace(page);
  const navigation = page.getByRole("navigation", {
    name: "Space navigation",
  });
  const rail = page.locator('[data-sidebar="rail"]');
  const railPosition = await rail.boundingBox();
  if (!railPosition) throw new Error("Sidebar resize control is missing");
  await page.mouse.move(railPosition.x + railPosition.width / 2, 200);
  await page.mouse.down();
  await page.mouse.move(230, 200);
  await page.mouse.up();

  for (const name of ["Tasks", "Habits", "Stats"]) {
    const link = navigation.getByRole("link", { name, exact: true });
    await expect(link).toBeInViewport();
    const fits = await link.evaluate((element) => {
      const sidebar = element.closest('[data-slot="sidebar-inner"]');
      if (!sidebar) return false;
      const bounds = element.getBoundingClientRect();
      const sidebarBounds = sidebar.getBoundingClientRect();
      return (
        bounds.left >= sidebarBounds.left && bounds.right <= sidebarBounds.right
      );
    });
    expect(fits).toBe(true);
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(link).toHaveAttribute("aria-current", "page");
  }

  const toggle = page.locator('[data-sidebar="trigger"]');
  await toggle.click();
  await expect(navigation).not.toBeInViewport();
  await toggle.click();
  await expect(navigation).toBeInViewport();
  await navigation.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "All tasks", exact: true }),
  ).toBeVisible();
  await navigation.getByRole("link", { name: "Timeline", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Today", exact: true }),
  ).toBeVisible();
  await navigation.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "All tasks", exact: true }),
  ).toBeVisible();
});

test.describe("mobile sidebar navigation", () => {
  test.use({ viewport: { width: 320, height: 740 }, hasTouch: true });

  test("opens each view and closes the navigation drawer after selection", async ({
    page,
  }) => {
    await openNavigationSpace(page);
    const navigation = page.getByRole("navigation", {
      name: "Space navigation",
    });
    for (const name of ["Habits", "Stats", "Tasks"]) {
      await page.getByRole("button", { name: "Toggle Sidebar" }).tap();
      const link = navigation.getByRole("link", { name, exact: true });
      await expect(link).toBeInViewport();
      await link.tap();
      await expect(navigation).toBeHidden();
      await expect(page).toHaveURL(
        new RegExp(
          `/spaces/[^/]+/${name === "Tasks" ? "all-tasks" : name.toLowerCase()}`,
        ),
      );
    }
    await expect(
      page.getByRole("heading", { name: "All tasks", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Toggle Sidebar" }).tap();
    await navigation.getByRole("link", { name: "Timeline", exact: true }).tap();
    await expect(page.getByRole("dialog", { name: "Sidebar" })).toBeHidden();
    await expect(
      page.getByRole("link", { name: "Today", exact: true }),
    ).toBeVisible();
    await navigation.getByRole("link", { name: "Tasks", exact: true }).tap();
    await expect(navigation).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "All tasks", exact: true }),
    ).toBeVisible();
  });
});
