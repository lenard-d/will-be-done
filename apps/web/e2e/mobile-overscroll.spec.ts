import { expect, test, type Locator, type Page } from "playwright/test";
import {
  createSpace,
  createTodayTask,
  openSpace,
  signupUser,
  uniqueE2EName,
} from "./helpers";

async function dispatchTitleSwipe(target: Locator) {
  return target.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const point = {
      clientX: bounds.x + bounds.width / 2,
      clientY: bounds.y + 4,
    };
    const dispatch = (type: string, distance: number) => {
      const touch = {
        ...point,
        clientY: point.clientY + distance,
        identifier: 1,
      };
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        touches: { value: type === "touchend" ? [] : [touch] },
        changedTouches: { value: [touch] },
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    };
    dispatch("touchstart", 0);
    const initialMovePrevented = dispatch("touchmove", 4);
    const completedMovePrevented = dispatch("touchmove", 90);
    dispatch("touchend", 90);
    return { initialMovePrevented, completedMovePrevented };
  });
}

async function openTaskSpace(page: Page) {
  const name = uniqueE2EName("Mobile overscroll");
  await signupUser(page);
  await createSpace(page, name);
  await openSpace(page, name);
  return new URL(page.url()).pathname.replace(/\/dates\/[^/]+$/, "");
}

const browserName =
  process.env.PLAYWRIGHT_OVERSCROLL_ENGINE === "webkit" ? "webkit" : "chromium";

test.use({ browserName });

test.describe(`mobile overscroll in ${browserName}`, () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: false,
    hasTouch: true,
  });

  test("reserves the first title movement and leaves task touches alone", async ({
    page,
  }) => {
    const spacePath = await openTaskSpace(page);
    await createTodayTask(page, "Touch target");
    await page.goto(`${spacePath}/all-tasks`);
    const title = page.getByRole("heading", {
      name: "All tasks",
      exact: true,
    });
    await expect(title.locator("..")).toHaveCSS("touch-action", "pinch-zoom");
    expect(await dispatchTitleSwipe(title)).toEqual({
      initialMovePrevented: true,
      completedMovePrevented: true,
    });
    const palette = page.getByRole("dialog", { name: "Command bar" });
    await expect(palette).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
    expect(
      await dispatchTitleSwipe(
        page.locator('[data-focusable-key^="task^^"]').first(),
      ),
    ).toEqual({ initialMovePrevented: false, completedMovePrevented: false });
    await expect(palette).toBeHidden();
  });

  test("keeps the shell in place at both list boundaries and releases page scrolling on exit", async ({
    page,
  }) => {
    const spacePath = await openTaskSpace(page);
    for (let index = 0; index < 10; index++) {
      await createTodayTask(page, `Scrollable task ${index}`);
    }
    await page.goto(`${spacePath}/all-tasks`);
    const shell = page.locator("[data-app-shell]");
    const list = page
      .locator("[data-all-tasks-column] .overflow-y-auto")
      .first();
    const header = page
      .locator("[data-command-palette-swipe-region]")
      .filter({ visible: true });
    await expect(page.locator("html")).toHaveCSS("overflow-y", "hidden");
    await expect(list).toHaveCSS("overscroll-behavior-y", "none");
    const headerBounds = await header.boundingBox();
    await list.hover();
    await page.mouse.wheel(0, 100_000);
    await expect
      .poll(() => list.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await page.mouse.wheel(0, 100_000);
    expect(await header.boundingBox()).toEqual(headerBounds);
    await page.mouse.wheel(0, -100_000);
    await expect
      .poll(() => list.evaluate((element) => element.scrollTop))
      .toBe(0);
    await page.mouse.wheel(0, -100_000);
    expect(await header.boundingBox()).toEqual(headerBounds);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.setViewportSize({ width: 390, height: 500 });
    await expect(shell).toHaveCSS("height", "500px");
    await page.goto("/spaces");
    await expect(
      page.getByRole("heading", { name: "Your Spaces" }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("overflow-y", "visible");
  });
});
