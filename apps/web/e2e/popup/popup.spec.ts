import { expect, test } from "playwright/test";

import {
  createSpace,
  openSpace,
  projectTaskCard,
  signupUser,
  uniqueE2EName,
} from "../helpers";

test("shows an error and stays keyboard accessible without a selected space", async ({
  page,
}) => {
  await installDesktopPopupMock(page);
  await page.goto("/popup");

  const popup = page.getByTestId("popup");
  const titleInput = page.getByRole("textbox", { name: "Task title" });

  await expect(popup).toHaveAttribute("data-status", "error");
  await expect(
    page.getByText("No space selected. Open the main app first."),
  ).toBeVisible();
  await expect(titleInput).toBeFocused();

  await titleInput.fill("Task without a space");
  await titleInput.press("Enter");
  await expect(titleInput).toHaveValue("Task without a space");
  await expect.poll(() => popupCloseCount(page)).toBe(0);

  await titleInput.press("Escape");
  await expect.poll(() => popupCloseCount(page)).toBe(1);
});

test("creates inbox tasks and resets when the popup is shown again", async ({
  context,
  page,
}) => {
  const spaceName = uniqueE2EName("E2E Popup Space");
  const firstTitle = uniqueE2EName("E2E popup task");
  const secondTitle = uniqueE2EName("E2E popup second task");

  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await page.getByRole("link", { name: /^Inbox(?:\s+\d+)?$/ }).click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+\/projects\/[^/]+$/);

  const popupPage = await context.newPage();
  await installDesktopPopupMock(popupPage);
  await popupPage.goto("/popup");

  const popup = popupPage.getByTestId("popup");
  const titleInput = popupPage.getByRole("textbox", { name: "Task title" });

  await expect(popup).toHaveAttribute("data-status", "idle");
  await expect(titleInput).toBeFocused();

  await titleInput.fill(firstTitle);
  await titleInput.press("Shift+Enter");
  await expect(titleInput).toHaveValue(firstTitle);
  await expect.poll(() => popupCloseCount(popupPage)).toBe(0);

  await titleInput.press("Enter");
  await expect.poll(() => popupCloseCount(popupPage)).toBe(1);
  await expect(projectTaskCard(page, firstTitle)).toBeVisible();

  await showPopupAgain(popupPage);
  await expect(popup).toHaveAttribute("data-status", "idle");
  await expect(titleInput).toBeEmpty();
  await expect(titleInput).toBeFocused();

  await titleInput.fill(secondTitle);
  await titleInput.press("Enter");
  await expect.poll(() => popupCloseCount(popupPage)).toBe(2);
  await expect(projectTaskCard(page, secondTitle)).toBeVisible();
});

async function installDesktopPopupMock(page: import("playwright/test").Page) {
  await page.addInitScript(() => {
    let onPopupShow: (() => void) | undefined;
    const popupState = {
      closeCount: 0,
      show() {
        onPopupShow?.();
      },
    };

    Object.defineProperty(window, "__e2ePopup", {
      value: popupState,
      configurable: true,
    });
    Object.defineProperty(window, "desktopApi", {
      value: {
        closePopup() {
          popupState.closeCount += 1;
        },
        onPopupShow(callback: () => void) {
          onPopupShow = callback;
          return () => {
            onPopupShow = undefined;
          };
        },
      },
      configurable: true,
    });
  });
}

async function popupCloseCount(page: import("playwright/test").Page) {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __e2ePopup: { closeCount: number };
        }
      ).__e2ePopup.closeCount,
  );
}

async function showPopupAgain(page: import("playwright/test").Page) {
  await page.evaluate(() => {
    (
      window as typeof window & {
        __e2ePopup: { show: () => void };
      }
    ).__e2ePopup.show();
  });
}
