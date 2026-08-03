import { expect, test } from "playwright/test";

import {
  createSpace,
  openSpace,
  openSpaceSettings,
  signupUser,
  uniqueE2EName,
} from "./helpers";

test("shows a selectable fourth settings tab with the shortcut reference", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("E2E Shortcut Settings Space");

  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);

  const settings = await openSpaceSettings(page);
  const tabs = settings.getByRole("tab");

  await expect(tabs).toHaveCount(4);
  await expect(tabs).toHaveText(["General", "Backup", "Import", "Shortcuts"]);

  const shortcutsTab = settings.getByRole("tab", { name: "Shortcuts" });
  await shortcutsTab.click();

  await expect(shortcutsTab).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowLeft");
  await expect(settings.getByRole("tab", { name: "Import" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("ArrowRight");
  await expect(shortcutsTab).toHaveAttribute("aria-selected", "true");

  const panel = settings.getByRole("tabpanel");
  await expect(panel).toHaveAttribute(
    "aria-labelledby",
    "settings-tab-shortcuts",
  );
  await expect(
    panel.getByRole("heading", { name: "Navigation" }),
  ).toBeVisible();
  await expect(panel.getByText("Toggle main sidebar")).toBeVisible();
  await expect(
    panel.getByText("Ctrl/Cmd", { exact: true }).first(),
  ).toBeVisible();

  const canScroll = await panel.evaluate(
    (element) => element.scrollHeight > element.clientHeight,
  );
  expect(canScroll).toBe(true);

  await panel.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() => panel.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect(
    panel.getByRole("heading", { name: "Editing, menus and dialogs" }),
  ).toBeVisible();
});
