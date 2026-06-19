import { expect, test } from "playwright/test";

test("left edge of the sidebar trigger toggles the sidebar", async ({
  page,
}) => {
  const runId = `${Date.now()}-${test.info().workerIndex}`;
  const email = `e2e-sidebar-${runId}@example.com`;
  const password = "Playwright123!";
  const spaceName = `E2E Sidebar Space ${runId}`;

  await page.goto("/signup");

  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();

  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page).toHaveURL(/\/spaces\/?$/);
  await expect(
    page.getByRole("heading", { name: "Your Spaces" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Create your first space" }).click();

  const dialog = page.getByRole("dialog", { name: "Enter space name:" });
  await dialog.getByRole("textbox").fill(spaceName);
  await dialog.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText(spaceName, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(spaceName) }).click();

  await expect(page).toHaveURL(/\/spaces\/[^/]+\/dates\/\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByRole("link", { name: /today/i })).toBeVisible();

  const sidebarTrigger = page.locator('[data-sidebar="trigger"]');

  await expect(sidebarTrigger).toHaveAttribute("data-open", "true");

  let triggerBox = await sidebarTrigger.boundingBox();
  if (!triggerBox) {
    throw new Error("Sidebar trigger is not visible");
  }

  await sidebarTrigger.click({
    position: { x: 3, y: triggerBox.height / 2 },
    timeout: 2_000,
  });
  await expect(sidebarTrigger).toHaveAttribute("data-open", "false");

  triggerBox = await sidebarTrigger.boundingBox();
  if (!triggerBox) {
    throw new Error("Sidebar trigger is not visible after collapsing");
  }

  await sidebarTrigger.click({
    position: { x: 3, y: triggerBox.height / 2 },
    timeout: 2_000,
  });
  await expect(sidebarTrigger).toHaveAttribute("data-open", "true");
});
