import { expect, test, type Locator, type Page } from "playwright/test";

import {
  createSpace,
  createTodayTask,
  openSpace,
  signupUser,
  uniqueE2EName,
} from "./helpers";

test.use({ timezoneId: "Europe/Berlin" });

async function activityDateLabels(page: Page) {
  return page.evaluate(() => {
    const today = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const labelForDaysAgo = (daysAgo: number) => {
      const date = new Date(today);
      date.setDate(date.getDate() - daysAgo);
      return `${formatter.format(date)}: 0 activities`;
    };

    return {
      emptyToday: labelForDaysAgo(0),
      activeToday: `${formatter.format(today)}: 1 activity`,
      firstDailyDay: labelForDaysAgo(29),
      nextDailyDay: labelForDaysAgo(28),
      firstHistoryDay: labelForDaysAgo(90),
      nextHistoryDay: labelForDaysAgo(89),
    };
  });
}

function chart(page: Page, title: string): Locator {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
}

async function createStatsSpace(page: Page) {
  const spaceName = uniqueE2EName("E2E Activity Stats Space");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);

  return new URL(page.url()).pathname.split("/")[2];
}

async function checkDayDetails({
  page,
  activityChart,
  firstDay,
  nextDay,
  today,
}: {
  page: Page;
  activityChart: Locator;
  firstDay: string;
  nextDay: string;
  today: string;
}) {
  const firstButton = activityChart.getByRole("button", {
    name: firstDay,
    exact: true,
  });
  const tooltip = page.getByRole("tooltip");
  await expect(firstButton).not.toHaveAttribute("title");
  await firstButton.hover();
  await expect(tooltip).toHaveText(firstDay, { timeout: 1_000 });

  await page.getByRole("heading", { name: "Stats", exact: true }).hover();
  await page.mouse.move(0, 0, { steps: 5 });
  await expect(tooltip).toBeHidden();
  await firstButton.focus();
  await page.keyboard.press("Tab");
  const nextButton = activityChart.getByRole("button").nth(1);
  await expect(nextButton).toBeFocused();
  await expect(
    page.getByRole("tooltip", { name: firstDay, exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("tooltip", { name: nextDay, exact: true }),
  ).toBeVisible();

  await activityChart.getByRole("button", { name: today, exact: true }).click();
  const details = page.getByRole("dialog");
  await expect(details).toHaveText(today);
  await expect(tooltip).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
}

test("shows inclusive rolling activity windows with hover, keyboard, and click details", async ({
  page,
}) => {
  await createStatsSpace(page);
  const dates = await activityDateLabels(page);
  const item = await createTodayTask(
    page,
    uniqueE2EName("Stats completed task"),
  );
  await item.getByRole("checkbox").click();
  await expect(item.getByRole("checkbox")).toBeChecked();
  await page.getByRole("link", { name: "Stats", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Stats", exact: true }),
  ).toBeVisible();

  const daily = chart(page, "Daily activity");
  const history = chart(page, "Activity history");
  await expect(daily).toContainText("Last 30 days");
  await expect(history).toContainText("Last 13 weeks");
  await expect(daily.getByRole("button")).toHaveCount(30);
  await expect(history.getByRole("button")).toHaveCount(91);
  await expect(daily.getByRole("button").first()).toHaveAccessibleName(
    dates.firstDailyDay,
  );
  await expect(daily.getByRole("button").last()).toHaveAccessibleName(
    dates.activeToday,
  );
  await expect(history.getByRole("button").first()).toHaveAccessibleName(
    dates.firstHistoryDay,
  );
  await expect(history.getByRole("button").last()).toHaveAccessibleName(
    dates.activeToday,
  );

  await checkDayDetails({
    page,
    activityChart: daily,
    firstDay: dates.firstDailyDay,
    nextDay: dates.nextDailyDay,
    today: dates.activeToday,
  });
  await checkDayDetails({
    page,
    activityChart: history,
    firstDay: dates.firstHistoryDay,
    nextDay: dates.nextHistoryDay,
    today: dates.activeToday,
  });
});

test.describe("small touch screen", () => {
  test.use({
    viewport: { width: 320, height: 740 },
    hasTouch: true,
    isMobile: true,
  });

  test("keeps today visible without horizontal scrolling and opens tap details", async ({
    page,
  }) => {
    const spaceId = await createStatsSpace(page);
    const dates = await activityDateLabels(page);
    await page.goto(`/spaces/${spaceId}/stats`);
    await expect(
      page.getByRole("heading", { name: "Stats", exact: true }),
    ).toBeVisible();

    for (const title of ["Daily activity", "Activity history"]) {
      const activityChart = chart(page, title);
      const today = activityChart.getByRole("button", {
        name: dates.emptyToday,
        exact: true,
      });
      await today.scrollIntoViewIfNeeded();
      await expect(today).toBeInViewport();
      const box = await today.boundingBox();
      if (!box) throw new Error("Today's activity has no visible position");
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      const width = await activityChart.evaluate((element) => ({
        visible: element.clientWidth,
        content: element.scrollWidth,
      }));
      expect(width.content).toBeLessThanOrEqual(width.visible);

      await today.tap();
      const details = page.getByRole("dialog");
      await expect(details).toHaveText(dates.emptyToday);
      await expect(details).toBeInViewport();
      await activityChart.getByRole("heading").tap();
      await expect(details).toBeHidden();
    }

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  });
});
