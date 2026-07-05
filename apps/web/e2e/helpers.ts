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

export async function createProjectTask(page: Page, title: string) {
  await page.locator("[data-focus-placeholder]").first().focus();
  await page.keyboard.press("KeyO");
  await page.getByLabel("Edit task title").fill(title);
  await page.keyboard.press("Enter");

  const card = projectTaskCard(page, title);
  await expect(card).toBeVisible();

  return card;
}

export async function createProject(page: Page, title: string) {
  await page.getByRole("button", { name: /add project/i }).click();

  const dialog = page.getByRole("dialog", { name: "Enter project title" });
  await dialog.getByRole("textbox").fill(title);
  await dialog.getByRole("button", { name: "Confirm" }).click();

  await expect(projectSidebarLink(page, title)).toBeVisible();
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

export async function openTaskDetails(page: Page, title: string) {
  const card = taskCard(page, title);
  await expect(card).toBeVisible();
  await card.click();

  const detailsButton = page.getByRole("button", { name: "Task details" });
  const description = page.getByLabel("Edit task description");
  const hasDetailsRouteButton = await isVisibleInViewportSoon(
    page,
    detailsButton,
  );

  if (hasDetailsRouteButton) {
    await detailsButton.click();
    await expect(page).toHaveURL(/\/spaces\/[^/]+\/card-details\/[^/]+$/);
    await expect(description).toBeVisible();

    return { card, description };
  }

  const isAlreadyOpen = await description
    .waitFor({ state: "visible", timeout: 500 })
    .then(() => true)
    .catch(() => false);

  if (!isAlreadyOpen) {
    await page.keyboard.press("KeyV");
  }

  await expect(page.getByText("Card Details")).toBeVisible();
  await expect(description).toBeVisible();

  return { card, description };
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

export function projectSidebarLink(
  page: Page,
  title: string,
  notDoneCount?: number,
): Locator {
  const name = notDoneCount
    ? new RegExp(`${escapeRegExp(title)}\\s+${notDoneCount}$`)
    : new RegExp(escapeRegExp(title));

  return page.getByRole("link", { name });
}

export function stashPanel(page: Page): Locator {
  return page.getByTestId("stash-panel");
}

export function stashTaskCard(page: Page, title: string): Locator {
  return stashPanel(page)
    .locator('[data-focusable-key^="stashProjection^^"]')
    .filter({ hasText: title });
}

export function checklistItemRow(page: Page): Locator {
  return page
    .locator("[data-checklist-item-id]")
    .filter({ has: page.getByRole("textbox", { name: "Checklist item" }) });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function isVisibleInViewportSoon(page: Page, locator: Locator) {
  const isVisible = await locator
    .waitFor({ state: "visible", timeout: 500 })
    .then(() => true)
    .catch(() => false);

  if (!isVisible) return false;

  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  if (!box || !viewport) return false;

  return (
    box.x + box.width > 0 &&
    box.y + box.height > 0 &&
    box.x < viewport.width &&
    box.y < viewport.height
  );
}
