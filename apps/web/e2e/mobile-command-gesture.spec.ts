import { expect, test, type Locator, type Page } from "playwright/test";
import {
  createSpace,
  createTodayTask,
  openSpace,
  signupUser,
  uniqueE2EName,
} from "./helpers";

type Point = { x: number; y: number };

async function swipe(page: Page, path: { from: Point; to: Point }) {
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...path.from, id: 1 }],
  });
  for (let step = 1; step <= 8; step++) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: path.from.x + ((path.to.x - path.from.x) * step) / 8,
          y: path.from.y + ((path.to.y - path.from.y) * step) / 8,
          id: 1,
        },
      ],
    });
    await page.waitForTimeout(20);
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
}

async function titlePoint(region: Locator): Promise<Point> {
  await expect(region).toBeVisible();
  const bounds = await region.boundingBox();
  if (!bounds) throw new Error("The title region is missing");
  return { x: bounds.x + bounds.width / 2, y: bounds.y + 6 };
}

async function createTestSpace(page: Page) {
  const name = uniqueE2EName("Mobile command gesture");
  await signupUser(page);
  await createSpace(page, name);
  await openSpace(page, name);
  const todayPath = new URL(page.url()).pathname;
  const spacePath = new URL(page.url()).pathname
    .split("/")
    .slice(0, 3)
    .join("/");
  await page.locator('[data-sidebar="trigger"]').tap();
  const inboxPath = await page
    .getByRole("link", { name: /^Inbox/ })
    .getAttribute("href");
  if (!inboxPath) throw new Error("The Inbox link is missing");
  await page.keyboard.press("Escape");
  return { spacePath, inboxPath, todayPath };
}

test.describe("mobile command palette swipe", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("opens from title areas across authenticated views", async ({
    page,
  }) => {
    const { spacePath, inboxPath, todayPath } = await createTestSpace(page);
    const task = await createTodayTask(page, "Gesture details task");
    const taskKey = await task.getAttribute("data-focusable-key");
    const taskId = taskKey?.split("^^")[1];
    if (!taskId) throw new Error("The details task id is missing");

    const views = [
      { path: todayPath, region: () => page.locator("header").first() },
      {
        path: `${spacePath}/all-tasks`,
        region: () =>
          page
            .getByRole("heading", { name: "All tasks", exact: true })
            .locator(".."),
      },
      {
        path: inboxPath,
        region: () =>
          page
            .locator("[data-command-palette-swipe-region], header")
            .filter({ visible: true })
            .first(),
      },
      {
        path: `${spacePath}/timeline/2026-10-05?projectId=inbox`,
        region: () => page.locator('header[data-task-sort-view="timeline"]'),
        startX: 378,
      },
      {
        path: `${spacePath}/habits`,
        region: () =>
          page
            .getByRole("heading", { name: "Habits", exact: true })
            .locator("../.."),
      },
      {
        path: `${spacePath}/stats`,
        region: () =>
          page
            .getByRole("heading", { name: "Stats", exact: true })
            .locator(".."),
      },
      {
        path: `${spacePath}/item-details/${taskId}`,
        region: () => page.locator("[data-command-palette-swipe-region]"),
      },
    ];
    const palette = page.getByRole("dialog", { name: "Command bar" });
    for (const view of views) {
      await page.goto(view.path);
      const titleStart = await titlePoint(view.region());
      const from = { ...titleStart, x: view.startX ?? titleStart.x };
      await swipe(page, { from, to: { x: from.x, y: from.y + 90 } });
      await expect(palette).toBeVisible();
      await expect(palette.getByRole("combobox")).toBeFocused();
      await expect.poll(async () => (await palette.boundingBox())?.y).toBe(0);
      await swipe(page, { from, to: { x: from.x, y: from.y + 90 } });
      await expect(palette).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(palette).toBeHidden();
    }
  });

  test("keeps list scrolling and ignores short pulls, other directions, multi-touch and cancellation", async ({
    page,
  }) => {
    const { spacePath } = await createTestSpace(page);
    for (let index = 0; index < 18; index++) {
      await createTodayTask(page, `Gesture scroll task ${index}`);
    }
    await page.goto(`${spacePath}/all-tasks`);
    const palette = page.getByRole("dialog", { name: "Command bar" });
    const list = page.locator("#main-scrollable-area");
    await expect(list).toBeVisible();
    const listBounds = await list.boundingBox();
    if (!listBounds) throw new Error("The task list is missing");
    const listPoint = { x: 210, y: Math.min(listBounds.y + 250, 580) };
    await swipe(page, {
      from: listPoint,
      to: { x: listPoint.x, y: listPoint.y - 160 },
    });
    await expect
      .poll(() => list.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await swipe(page, {
      from: { x: listPoint.x, y: listPoint.y - 140 },
      to: listPoint,
    });
    await expect(palette).toBeHidden();

    const from = await titlePoint(
      page
        .getByRole("heading", { name: "All tasks", exact: true })
        .locator(".."),
    );
    for (const to of [
      { x: from.x, y: from.y + 20 },
      { x: from.x + 80, y: from.y + 30 },
      { x: from.x, y: from.y - 40 },
    ]) {
      await swipe(page, { from, to });
      await expect(palette).toBeHidden();
    }
    const control = await titlePoint(
      page.getByRole("button", { name: "Toggle Sidebar" }),
    );
    await swipe(page, {
      from: control,
      to: { x: control.x, y: control.y + 90 },
    });
    await expect(palette).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Sidebar" })).toBeHidden();
    await page.keyboard.press("Escape");

    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...from, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { ...from, id: 1 },
        { x: from.x + 30, y: from.y, id: 2 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: from.x, y: from.y + 90, id: 1 },
        { x: from.x + 30, y: from.y + 90, id: 2 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(palette).toBeHidden();
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...from, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await session.detach();
    await expect(palette).toBeHidden();

    await page.keyboard.press("Control+KeyK");
    await expect(palette).toBeVisible();
    await page.keyboard.press("Control+KeyK");
    await expect(palette).toBeHidden();
  });

  test("follows a slow diagonal pull and retracts before cancelling", async ({
    page,
  }) => {
    const { spacePath } = await createTestSpace(page);
    await page.goto(`${spacePath}/all-tasks`);
    const from = await titlePoint(
      page
        .getByRole("heading", { name: "All tasks", exact: true })
        .locator(".."),
    );
    const session = await page.context().newCDPSession(page);
    const move = async (point: Point) => {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ ...point, id: 1 }],
      });
    };
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...from, id: 1 }],
    });
    await page.waitForTimeout(1000);
    await move({ x: from.x, y: from.y + 30 });
    const panel = page.locator(".command-palette-mobile");
    const opacity = () =>
      panel.evaluate((element) => Number(getComputedStyle(element).opacity));
    await expect.poll(opacity).toBeCloseTo(0.3, 2);
    await expect(panel).toHaveAttribute("aria-hidden", "true");
    await expect(
      panel.getByRole("combobox", { includeHidden: true }),
    ).not.toBeFocused();
    await page.waitForTimeout(1000);
    await move({ x: from.x + 120, y: from.y + 100 });
    await expect.poll(opacity).toBeCloseTo(0.9, 2);
    await expect(panel).toHaveAttribute("data-state", "closed");
    await move({ x: from.x + 120, y: from.y + 20 });
    await expect.poll(opacity).toBeCloseTo(0.2, 2);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(panel).toBeHidden();
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...from, id: 1 }],
    });
    await move({ x: from.x, y: from.y + 30 });
    await page.waitForTimeout(1000);
    await move({ x: from.x + 120, y: from.y + 100 });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const palette = page.getByRole("dialog", { name: "Command bar" });
    await expect.poll(async () => (await palette.boundingBox())?.y).toBe(0);
    await expect(palette).toHaveCSS("opacity", "1");
    await expect(palette.getByRole("combobox")).toBeFocused();
    await session.detach();
  });

  test("never flashes fully open in the first frames of repeated short pulls", async ({
    page,
  }) => {
    const { spacePath } = await createTestSpace(page);
    await page.goto(`${spacePath}/all-tasks`);
    const from = await titlePoint(
      page
        .getByRole("heading", { name: "All tasks", exact: true })
        .locator(".."),
    );
    const session = await page.context().newCDPSession(page);
    for (let attempt = 0; attempt < 3; attempt++) {
      const probe = await page.evaluateHandle(() => {
        const frames: { opacity: number; open: boolean; focused: boolean }[] =
          [];
        const observer = new MutationObserver(() => {
          const panel = document.querySelector(".command-palette-mobile");
          if (!panel) return;
          observer.disconnect();
          const sample = () => {
            frames.push({
              opacity: Number(getComputedStyle(panel).opacity),
              open: panel.getAttribute("data-state") === "open",
              focused: panel.contains(document.activeElement),
            });
            if (frames.length < 6) requestAnimationFrame(sample);
          };
          sample();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return { frames, observer };
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ ...from, id: 1 }],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: from.x, y: from.y + 30, id: 1 }],
      });
      await expect
        .poll(() => probe.evaluate(({ frames }) => frames.length))
        .toBe(6);
      const frames = await probe.evaluate(({ frames, observer }) => {
        observer.disconnect();
        return frames;
      });
      expect(
        frames.every(
          (frame) => frame.opacity <= 0.31 && !frame.open && !frame.focused,
        ),
      ).toBe(true);
      await probe.dispose();
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect(page.locator(".command-palette-mobile")).toBeHidden();
    }
    await session.detach();
  });

  test("swipes on header buttons do not click, and small-movement taps still work", async ({
    page,
  }) => {
    const { spacePath } = await createTestSpace(page);
    await page.goto(`${spacePath}/all-tasks`);
    const button = page.getByRole("button", { name: "Toggle Sidebar" });
    const bounds = await button.boundingBox();
    if (!bounds) throw new Error("The sidebar button is missing");
    const from = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
    await button.focus();
    await swipe(page, { from, to: { x: from.x, y: from.y + 90 } });
    const palette = page.getByRole("dialog", { name: "Command bar" });
    await expect(palette).toBeVisible();
    await expect(
      page.locator('[data-sidebar="sidebar"]').filter({ visible: true }),
    ).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(button).toBeFocused();
    await swipe(page, { from, to: { x: from.x, y: from.y + 30 } });
    await swipe(page, { from, to: { x: from.x + 2, y: from.y + 3 } });
    await expect(page.getByRole("link", { name: /^Inbox/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await button.tap();
    await expect(page.getByRole("link", { name: /^Inbox/ })).toBeVisible();
  });

  test("pulls from search and filter buttons and supports reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { spacePath } = await createTestSpace(page);
    await page.goto(`${spacePath}/all-tasks`);
    const palette = page.getByRole("dialog", { name: "Command bar" });
    for (const name of ["Search tasks and commands", "Filters and sorting"]) {
      const button = page.getByRole("button", { name, exact: true });
      const from = await titlePoint(button);
      await swipe(page, { from, to: { x: from.x, y: from.y + 90 } });
      await expect.poll(async () => (await palette.boundingBox())?.y).toBe(0);
      await expect(palette.getByRole("combobox")).toBeFocused();
      await expect(
        page.getByRole("dialog", { name: "Filters and sorting", exact: true }),
      ).toBeHidden();
      await page.keyboard.press("Escape");
    }
    const filter = page.getByRole("button", {
      name: "Filters and sorting",
      exact: true,
    });
    await filter.tap();
    await expect(
      page.getByRole("dialog", { name: "Filters and sorting", exact: true }),
    ).toBeVisible();
  });

  test("ignores editing and dialogs and removes the listener on desktop", async ({
    page,
  }) => {
    const { spacePath } = await createTestSpace(page);
    await createTodayTask(page, "Gesture editing task");
    await page.goto(`${spacePath}/all-tasks`);
    const title = page.getByRole("heading", { name: "All tasks", exact: true });
    const from = await titlePoint(title.locator(".."));
    const palette = page.getByRole("dialog", { name: "Command bar" });
    await page.locator('[data-focusable-key^="task^^"]').first().click();
    await page.keyboard.press("KeyI");
    const editor = page.getByLabel("Edit task title");
    await expect(editor).toBeVisible();
    await editor.focus();
    await swipe(page, { from, to: { x: from.x, y: from.y + 90 } });
    await expect(palette).toBeHidden();
    await page.keyboard.press("Escape");

    await page.keyboard.press("Control+KeyK");
    await expect.poll(async () => (await palette.boundingBox())?.y).toBe(0);
    await palette.getByRole("combobox").fill("Create project");
    await palette
      .getByRole("option", { name: "Create project", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Enter project title" });
    await expect(dialog).toBeVisible();
    await swipe(page, { from, to: { x: from.x, y: from.y + 90 } });
    await expect(palette).toBeHidden();
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 900, height: 844 });
    const desktopFrom = await titlePoint(title.locator(".."));
    await swipe(page, {
      from: desktopFrom,
      to: { x: desktopFrom.x, y: desktopFrom.y + 90 },
    });
    await expect(palette).toBeHidden();
    await page.keyboard.press("Meta+KeyK");
    await expect(palette).toBeVisible();
  });
});
