import { randomUUID } from "node:crypto";

import { expect, type Locator, type Page } from "playwright/test";

export const E2E_PASSWORD = "Playwright123!";

type UserOptions = {
  email?: string;
  password?: string;
};

type UserCredentials = {
  email: string;
  password: string;
};

export function uniqueE2EName(prefix: string) {
  return `${prefix} ${Date.now()} ${randomUUID().slice(0, 8)}`;
}

export async function signupUser(
  page: Page,
  options: UserOptions = {},
): Promise<UserCredentials> {
  const email =
    options.email ?? `e2e-${Date.now()}-${randomUUID()}@example.com`;
  const password = options.password ?? E2E_PASSWORD;

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

  return { email, password };
}

export async function signInUser(
  page: Page,
  { email, password }: UserCredentials,
) {
  await page.goto("/login");

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
}

export async function createSpace(page: Page, spaceName: string) {
  const createFirstSpaceButton = page.getByRole("button", {
    name: "Create your first space",
  });

  if (await createFirstSpaceButton.isVisible()) {
    await createFirstSpaceButton.click();
  } else {
    await page.getByRole("button", { name: "New Space" }).click();
  }

  const dialog = page.getByRole("dialog", { name: "Enter space name:" });
  await dialog.getByRole("textbox").fill(spaceName);
  await dialog.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText(spaceName, { exact: true })).toBeVisible();
}

export async function openSpace(page: Page, spaceName: string) {
  await page
    .getByRole("link", { name: new RegExp(escapeRegExp(spaceName)) })
    .click();

  await expect(page).toHaveURL(/\/spaces\/[^/]+\/dates\/\d{4}-\d{2}-\d{2}$/);
}

export async function createTodayTask(page: Page, title: string) {
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByLabel("Edit task title").fill(title);
  await page.keyboard.press("Enter");

  const card = taskCard(page, title);
  await expect(card).toBeVisible();

  return card;
}

export async function openTaskActions(page: Page, title: string) {
  const card = taskCard(page, title);
  await expect(card).toBeVisible();
  await card.click();

  const actionsButton = card.getByRole("button", { name: "Task actions" });
  await expect(actionsButton).toBeVisible();
  await actionsButton.click();

  await expect(page.getByRole("menu")).toBeVisible();
}

export function taskCard(page: Page, title: string): Locator {
  return page.locator("[data-focusable-key]").filter({ hasText: title });
}

export function dailyTaskCard(page: Page, title: string): Locator {
  return page
    .locator('[data-focusable-key^="projection^^"]')
    .filter({ hasText: title });
}

export function projectTaskCard(page: Page, title: string): Locator {
  return page
    .locator('[data-focusable-key^="task^^"]')
    .filter({ hasText: title });
}

export function stashPanel(page: Page): Locator {
  return page.getByTestId("stash-panel");
}

export function stashTaskCard(page: Page, title: string): Locator {
  return stashPanel(page)
    .locator('[data-focusable-key^="stashProjection^^"]')
    .filter({ hasText: title });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
