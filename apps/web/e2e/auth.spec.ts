import { expect, test } from "playwright/test";

test("signs up, signs out, and signs in", async ({ page }) => {
  const email = `e2e-${Date.now()}-${test.info().workerIndex}@example.com`;
  const password = "Playwright123!";

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
});
