import { expect, test } from "playwright/test";

test("signs up, signs in, creates a space, and keeps today's task after reload", async ({
  page,
}) => {
  const runId = `${Date.now()}-${test.info().workerIndex}`;
  const email = `e2e-flow-${runId}@example.com`;
  const password = "Playwright123!";
  const spaceName = `E2E Space ${runId}`;
  const taskTitle = `E2E task ${runId}`;
  const taskCard = page
    .locator("[data-focusable-key]")
    .filter({ hasText: taskTitle });

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

  await page.getByRole("button", { name: "Sign Out" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();

  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();

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
  await page.getByRole("button", { name: "Add task" }).click();

  await page.getByLabel("Edit task title").fill(taskTitle);
  await page.keyboard.press("Enter");

  await expect(taskCard).toBeVisible();
  await page.waitForTimeout(500);

  await page.reload();

  await expect(page).toHaveURL(/\/spaces\/[^/]+\/dates\/\d{4}-\d{2}-\d{2}$/);
  await expect(taskCard).toBeVisible();
});
