import { expect, test, type Locator, type Page } from "playwright/test";
import {
  createSpace,
  createTodayTask,
  openSpace,
  signInUser,
  signupUser,
  uniqueE2EName,
} from "./helpers";

const columns = (page: Page) => page.locator("[data-all-tasks-column]");
const rows = (column: Locator) =>
  column.locator('[data-focusable-key^="task^^"]');

async function addColumn(page: Page, title: string) {
  await page.getByRole("button", { name: "Add column", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Column name", exact: true });
  await dialog.getByRole("textbox").fill(title);
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("region", { name: `${title} column`, exact: true }),
  ).toBeVisible();
}

async function filterOption(
  page: Page,
  column: Locator,
  label: string,
  option: string,
) {
  await column
    .getByRole("button", { name: "Filters and sorting", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Filter by ${label}`, exact: true })
    .click();
  await page.getByRole("option", { name: new RegExp(`^${option}`) }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
}

test("syncs independent column filters to a fresh phone and back", async ({
  page,
  browser,
}) => {
  const diagnostics: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      diagnostics.push(`desktop: ${message.text()}`);
  });
  const credentials = await signupUser(page);
  const space = uniqueE2EName("Synced columns");
  await createSpace(page, space);
  await openSpace(page, space);
  await createTodayTask(page, "Open task");
  const completed = await createTodayTask(page, "Finished task");
  await completed.getByRole("checkbox").first().click();
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await addColumn(page, "Finished");
  const first = columns(page).first();
  const finished = page.getByRole("region", {
    name: "Finished column",
    exact: true,
  });
  await filterOption(page, finished, "state", "Done");
  await expect(rows(first)).toHaveCount(2);
  await expect(rows(finished)).toHaveText([/Finished task/]);

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  try {
    const mobile = await phone.newPage();
    mobile.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning")
        diagnostics.push(`phone: ${message.text()}`);
    });
    await signInUser(mobile, credentials);
    await openSpace(mobile, space);
    await mobile.goto(page.url());
    await expect(columns(mobile)).toHaveCount(2);
    const mobileFinished = mobile.getByRole("region", {
      name: "Finished column",
      exact: true,
    });
    await expect(rows(mobileFinished)).toHaveText([/Finished task/]);
    await mobileFinished
      .getByRole("button", { name: "Filters and sorting", exact: true })
      .click();
    await mobile
      .getByRole("button", { name: "Filter by planned day", exact: true })
      .click();
    await mobile
      .getByRole("group", { name: "Planned day matching" })
      .getByRole("button", { name: "No date", exact: true })
      .click();
    await mobile.keyboard.press("Escape");
    await mobile.keyboard.press("Escape");
    await expect(rows(mobileFinished)).toHaveCount(0);
    await expect(rows(finished)).toHaveCount(0, { timeout: 15_000 });
    await expect(rows(first)).toHaveCount(2);
    await page.reload();
    await expect(
      rows(page.getByRole("region", { name: "Finished column", exact: true })),
    ).toHaveCount(0);
  } finally {
    await test.info().attach("sync diagnostics", {
      body: diagnostics.join("\n"),
      contentType: "text/plain",
    });
    await phone.close();
  }
});

test("scopes duplicate task focus, insertion, details and delete undo to the selected column", async ({
  page,
}) => {
  await signupUser(page);
  const space = uniqueE2EName("Duplicate task focus");
  await createSpace(page, space);
  await openSpace(page, space);
  await page.goto(page.url().replace(/\/dates\/[^/]+$/, "/dates/2026-10-08"));
  await createTodayTask(page, "Anchor task");
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await addColumn(page, "Selected");
  const first = columns(page).first();
  const selected = page.getByRole("region", {
    name: "Selected column",
    exact: true,
  });
  await rows(selected).first().click();
  await page.keyboard.press("KeyI");
  await expect(selected.getByLabel("Edit task title")).toBeVisible();
  await expect(page.getByLabel("Edit task title")).toHaveCount(1);
  await selected.getByLabel("Edit task title").fill("Anchor renamed");
  await page.keyboard.press("Enter");
  await expect(rows(first)).toContainText("Anchor renamed");
  await rows(selected).first().click();
  await page.keyboard.press("KeyV");
  await expect(
    page
      .getByTestId("item-details-panel")
      .getByText("Anchor renamed", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await selected
    .getByRole("button", { name: "Filters and sorting", exact: true })
    .click();
  await page.getByLabel("Filter task titles").fill("Anchor");
  await page.keyboard.press("Escape");
  await rows(selected).first().click();
  await page.keyboard.press("KeyO");
  const editor = selected.getByLabel("Edit task title");
  await editor.fill("Inserted task");
  await expect(rows(selected)).toHaveCount(2);
  await expect(rows(selected).last()).toContainText("Oct 8");
  await page.keyboard.press("Enter");
  await expect(rows(selected)).toHaveText([/Anchor renamed/]);
  await expect(rows(first)).toHaveCount(2);
  await rows(selected).first().click();
  await page.keyboard.press("Backspace");
  await expect(rows(selected)).toHaveCount(0);
  await expect(rows(first)).toHaveText([/Inserted task/]);
  await page.keyboard.press("Meta+KeyZ");
  await expect(rows(selected)).toHaveText([/Anchor renamed/]);
  await expect(rows(first)).toHaveCount(2);
  await page.keyboard.press("Meta+Shift+KeyZ");
  await expect(rows(selected)).toHaveCount(0);
});

test("renames, moves, collapses and deletes saved columns without deleting tasks", async ({
  page,
}) => {
  await signupUser(page);
  const space = uniqueE2EName("Column controls");
  await createSpace(page, space);
  await openSpace(page, space);
  await createTodayTask(page, "Keep original task");
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await addColumn(page, "Work");
  await addColumn(page, "Personal");
  const work = page.getByRole("region", { name: "Work column", exact: true });
  await work.hover();
  await work
    .getByRole("button", { name: "Edit column name", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Column name", exact: true });
  await dialog.getByRole("textbox").fill("Blocked");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  const blocked = page.getByRole("region", {
    name: "Blocked column",
    exact: true,
  });
  await blocked.hover();
  await blocked
    .getByRole("button", { name: "Move column left", exact: true })
    .click();
  await expect(columns(page).first()).toHaveAccessibleName("Blocked column");
  await blocked.getByRole("button", { name: "Blocked", exact: true }).click();
  await expect(rows(blocked)).toBeHidden();
  await blocked.getByRole("button", { name: "Blocked", exact: true }).click();
  await page.reload();
  await expect(columns(page).first()).toHaveAccessibleName("Blocked column");
  for (const name of ["Blocked", "Personal"]) {
    const column = page.getByRole("region", {
      name: `${name} column`,
      exact: true,
    });
    await column.hover();
    await column
      .getByRole("button", { name: "Delete column", exact: true })
      .click();
    await expect(column).toHaveCount(0);
  }
  await expect(rows(columns(page).first())).toHaveText([/Keep original task/]);
  await columns(page).first().hover();
  await expect(
    columns(page)
      .first()
      .getByRole("button", { name: "Delete column", exact: true }),
  ).toBeDisabled();
});
