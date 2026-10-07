import { expect, test, type Locator, type Page } from "playwright/test";
import {
  createProjectTask,
  createSpace,
  createTodayTask,
  openSpace,
  signupUser,
  uniqueE2EName,
} from "./helpers";

async function setupScheduledTask(page: Page) {
  const spaceName = uniqueE2EName("Planned insertion space");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  const spaceUrl = page.url().replace(/\/dates\/[^/]+$/, "");
  await page.goto(`${spaceUrl}/dates/2026-10-08`);
  await createTodayTask(page, "Selected October task");
  return spaceUrl;
}

async function taskTitles(rows: Locator) {
  return rows.evaluateAll((elements) =>
    elements.map((element) => {
      const title = element.querySelector("[data-task-title-input]");
      return title instanceof HTMLTextAreaElement
        ? title.value
        : element.querySelector("[data-task-title]")?.textContent;
    }),
  );
}

async function insertSibling(
  page: Page,
  anchor: Locator,
  { key, title }: { key: string; title: string },
) {
  await anchor.click();
  await page.keyboard.press(key);
  const editor = page.getByLabel("Edit task title");
  await expect(editor).toBeFocused();
  await editor.fill(title);
}

test("All tasks inherits the planned day above and below the selected task", async ({
  page,
}) => {
  const spaceUrl = await setupScheduledTask(page);
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  const rows = page.locator(
    '[data-task-sort-view="all-tasks"] [data-focusable-key^="task^^"]',
  );
  const anchor = rows.filter({ hasText: "Selected October task" });

  await insertSibling(page, anchor, {
    key: "KeyO",
    title: "Zulu inserted below",
  });
  await expect
    .poll(() => taskTitles(rows))
    .toEqual(["Selected October task", "Zulu inserted below"]);
  await expect(
    page.getByRole("heading", { name: "Unscheduled", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Edit task title")).toHaveCount(0);
  await insertSibling(page, anchor, {
    key: "Shift+KeyO",
    title: "Alpha inserted above",
  });
  await expect
    .poll(() => taskTitles(rows))
    .toEqual([
      "Alpha inserted above",
      "Selected October task",
      "Zulu inserted below",
    ]);
  await expect(
    page.getByRole("heading", { name: "Unscheduled", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Edit task title")).toHaveCount(0);

  await page.reload();
  await expect(rows).toHaveText([
    /Alpha inserted above/,
    /Selected October task/,
    /Zulu inserted below/,
  ]);
  await page.goto(`${spaceUrl}/dates/2026-10-08`);
  await expect(page.locator('[data-focusable-key^="dailyEntry^^"]')).toHaveText(
    [/Alpha inserted above/, /Selected October task/, /Zulu inserted below/],
  );
  await page.goto(`${spaceUrl}/timeline/2026-10-08`);
  await expect(page.locator('[data-focusable-key^="dailyEntry^^"]')).toHaveText(
    [/Alpha inserted above/, /Selected October task/, /Zulu inserted below/],
  );
});

test("project Planned day insertion keeps its saved day after changing views", async ({
  page,
}) => {
  const spaceUrl = await setupScheduledTask(page);
  await page.getByRole("link", { name: /^Inbox/ }).click();
  const rows = page.locator('[data-focusable-key^="task^^"]');
  await insertSibling(page, rows.filter({ hasText: "Selected October task" }), {
    key: "KeyO",
    title: "Project day sibling",
  });
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Edit task title")).toHaveCount(0);
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Unscheduled", exact: true }),
  ).toHaveCount(0);
  await page.goto(`${spaceUrl}/dates/2026-10-08`);
  await expect(page.locator('[data-focusable-key^="dailyEntry^^"]')).toHaveText(
    [/Selected October task/, /Project day sibling/],
  );
});

test("unscheduled and empty project insertion do not acquire a date", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("Unscheduled insertion space");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await page.getByRole("link", { name: /^Inbox/ }).click();
  await createProjectTask(page, "Unscheduled anchor");
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  const rows = page.locator(
    '[data-task-sort-view="all-tasks"] [data-focusable-key^="task^^"]',
  );
  await insertSibling(page, rows.filter({ hasText: "Unscheduled anchor" }), {
    key: "Shift+KeyO",
    title: "Unscheduled sibling",
  });
  await expect
    .poll(() => taskTitles(rows))
    .toEqual(["Unscheduled sibling", "Unscheduled anchor"]);
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Edit task title")).toHaveCount(0);
  await page.reload();
  await expect(rows).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Unscheduled", exact: true }),
  ).toBeVisible();
});

test("alphabetical project insertion stays in place until Enter and does not inherit the day", async ({
  page,
}) => {
  await setupScheduledTask(page);
  await page.getByRole("link", { name: /^Inbox/ }).click();
  const rows = page.locator('[data-focusable-key^="task^^"]');
  const anchor = rows.filter({ hasText: "Selected October task" });
  await anchor.click();
  await page.keyboard.press("KeyQ");
  await insertSibling(page, anchor, { key: "KeyO", title: "Alpha sibling" });
  await expect
    .poll(() => taskTitles(rows))
    .toEqual(["Selected October task", "Alpha sibling"]);
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Edit task title")).toHaveCount(0);
  await expect(rows).toHaveText([/Alpha sibling/, /Selected October task/]);
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Unscheduled", exact: true }),
  ).toBeVisible();
});
