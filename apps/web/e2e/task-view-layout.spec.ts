import { expect, test } from "playwright/test";

import {
  createProject,
  createSpace,
  createTodayTask,
  openSpace,
  projectSidebarLink,
  signupUser,
  uniqueE2EName,
} from "./helpers";

test("keeps the All tasks sidebar toggle beside the title and adds columns from the end of the board", async ({
  page,
}) => {
  const space = uniqueE2EName("Desktop task header");
  await signupUser(page);
  await createSpace(page, space);
  await openSpace(page, space);
  await createTodayTask(page, "Desktop header task");
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  const view = page.locator('[data-task-sort-view="all-tasks"]');
  const heading = view.getByRole("heading", { name: "All tasks" });
  const sidebarToggle = view
    .locator("header")
    .getByRole("button", { name: "Toggle Sidebar", exact: true });
  const add = view.getByRole("button", { name: "Add column", exact: true });
  await expect(view.locator("header").getByRole("status")).toHaveText("1 task");
  await expect(sidebarToggle).toHaveCount(1);
  const toggleBounds = await sidebarToggle.boundingBox();
  await page.getByTestId("stash-toggle").click();
  await expect(page.getByTestId("stash-toggle")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(await sidebarToggle.boundingBox()).toEqual(toggleBounds);
  await sidebarToggle.click();
  await expect(sidebarToggle).toHaveAttribute("data-open", "false");
  await sidebarToggle.click();
  await expect(sidebarToggle).toHaveAttribute("data-open", "true");
  await page.getByTestId("stash-toggle").click();
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const titleBounds = await heading.boundingBox();
    const addBounds = await add.boundingBox();
    if (!titleBounds || !addBounds) throw new Error("Task header is missing");
    expect(addBounds.y).toBeGreaterThan(titleBounds.y + titleBounds.height);
    await expect(add).toBeInViewport();
    await expect(
      view.locator('[data-focusable-key^="task^^"]'),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
  await add.click();
  const dialog = page.getByRole("dialog", { name: "Column name", exact: true });
  await dialog.getByRole("textbox").fill("More tasks");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "More tasks column", exact: true }),
  ).toBeVisible();
});

test("keeps long desktop project titles on one line with usable controls", async ({
  page,
}) => {
  await signupUser(page);
  const space = uniqueE2EName("Project title layout");
  await createSpace(page, space);
  await openSpace(page, space);
  const title = "Business Administration";
  await createProject(page, title);
  await projectSidebarLink(page, title).click();
  const heading = page.getByRole("heading", { name: title, exact: true });
  await expect(heading).toBeVisible();
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const dimensions = await heading.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
      visibleWidth: element.clientWidth,
      textWidth: element.scrollWidth,
    }));
    expect(dimensions.height).toBeCloseTo(dimensions.lineHeight);
    if (width === 1280)
      expect(dimensions.textWidth).toBeLessThanOrEqual(dimensions.visibleWidth);
    const sort = page.getByRole("button", { name: "Sort tasks", exact: true });
    await expect(sort).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Delete project", exact: true }),
    ).toBeInViewport();
    await sort.click();
    await page
      .getByRole("menuitemradio", { name: "Manual", exact: true })
      .click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
  await heading.click();
  const rename = page.getByRole("dialog", { name: "Enter new project title" });
  const longerTitle = `${title} ${"Very long project name ".repeat(10)}`.trim();
  await rename.getByRole("textbox").fill(longerTitle);
  await rename.getByRole("button", { name: "Confirm", exact: true }).click();
  const longHeading = page.getByRole("heading", {
    name: longerTitle,
    exact: true,
  });
  await expect(longHeading).toBeVisible();
  expect(
    await longHeading.evaluate(
      (element) => element.getBoundingClientRect().height,
    ),
  ).toBeCloseTo(
    await longHeading.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).lineHeight),
    ),
  );
  await expect(
    page.getByRole("button", { name: "Delete project", exact: true }),
  ).toBeInViewport();
});

test("keeps task details at the top while the view and sidebar remain usable", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("Details layout space");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  const task = await createTodayTask(page, "Full height details");
  await task.click();
  await page.keyboard.press("KeyV");

  const panel = page.getByTestId("item-details-panel");
  await expect(
    panel.getByText("Full height details", { exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await panel.boundingBox())?.y).toBe(0);
  await expect.poll(async () => (await panel.boundingBox())?.height).toBe(720);

  const trigger = page.locator('[data-sidebar="trigger"]');
  await trigger.click();
  await trigger.click();
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "All tasks", exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await panel.boundingBox())?.y).toBe(0);
  await page.getByRole("link", { name: /^Inbox/ }).click();
  await expect(
    page.getByRole("button", { name: "Delete project" }),
  ).toBeVisible();
  await expect.poll(async () => (await panel.boundingBox())?.y).toBe(0);
});

test("changes project sorting with a keyboard menu beside Delete", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("Sort menu space");
  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await createTodayTask(page, "Zulu menu task");
  await createTodayTask(page, "Alpha menu task");
  await page.getByRole("link", { name: /^Inbox/ }).click();

  const control = page.getByRole("button", { name: "Sort tasks" });
  const deleteProject = page.getByRole("button", { name: "Delete project" });
  await expect(deleteProject).toBeVisible();
  await expect(control).toHaveCount(1);
  await expect(control).toHaveText("Planned day");
  const sortBounds = await control.boundingBox();
  const deleteBounds = await deleteProject.boundingBox();
  if (!sortBounds || !deleteBounds)
    throw new Error("Project controls are missing");
  expect(
    Math.abs(
      sortBounds.y +
        sortBounds.height / 2 -
        deleteBounds.y -
        deleteBounds.height / 2,
    ),
  ).toBeLessThan(1);

  await control.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitemradio", { name: "Planned day" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("menuitemradio", { name: "Planned day" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitemradio", { name: "Alphabetical" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(control).toHaveText("Alphabetical");
  await expect(control).toBeFocused();
  await expect(page.locator('[data-focusable-key^="task^^"]')).toHaveText([
    /Alpha menu task/,
    /Zulu menu task/,
  ]);
});

test.describe("mobile project sorting", () => {
  test.use({ viewport: { width: 320, height: 740 }, hasTouch: true });

  test("opens sorting and project actions from the mobile header without horizontal overflow", async ({
    page,
  }) => {
    const spaceName = uniqueE2EName("Mobile sort menu space");
    await signupUser(page);
    await createSpace(page, spaceName);
    await openSpace(page, spaceName);
    await page.locator('[data-sidebar="trigger"]').tap();
    await page.getByRole("link", { name: /^Inbox/ }).tap();
    const options = page.getByRole("button", {
      name: "Filters and sorting",
      exact: true,
    });
    await expect(options).toBeInViewport();
    await options.tap();
    const control = page.getByRole("button", { name: "Sort tasks" });
    await expect(control).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Delete project" }),
    ).toBeInViewport();
    await control.tap();
    await page.getByRole("menuitemradio", { name: "Manual" }).tap();
    await expect(control).toHaveText("Manual");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(320);
  });
});

test.describe("mobile task header", () => {
  test.use({ viewport: { width: 320, height: 740 }, hasTouch: true });
  test("opens command search and keeps the task count below the title row", async ({
    page,
  }) => {
    const space = uniqueE2EName("Mobile task header");
    await signupUser(page);
    await createSpace(page, space);
    await openSpace(page, space);
    await createTodayTask(page, "Mobile header task");
    await page.locator('[data-sidebar="trigger"]').tap();
    await page.getByRole("link", { name: "Tasks", exact: true }).tap();
    const header = page
      .locator("header[data-command-palette-swipe-region]")
      .filter({ visible: true });
    await expect(header.getByRole("button")).toHaveCount(3);
    const title = await header
      .getByRole("heading", { name: "All tasks" })
      .boundingBox();
    const count = await header.getByRole("status").boundingBox();
    if (!title || !count) throw new Error("Mobile header is missing");
    expect(count.y).toBeGreaterThan(title.y + title.height);
    await header
      .getByRole("button", { name: "Search tasks and commands" })
      .tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await header.getByRole("button", { name: "Toggle Sidebar" }).tap();
    await page.getByRole("link", { name: /^Inbox/ }).tap();
    await expect(header.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(header.getByRole("status")).toHaveText("1 task to do");
    await header
      .getByRole("button", { name: "Search tasks and commands" })
      .tap();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test("keeps mobile task headers fixed while All tasks and Inbox scroll", async ({
  page,
}) => {
  const space = uniqueE2EName("Fixed mobile task header");
  await signupUser(page);
  await createSpace(page, space);
  await openSpace(page, space);
  for (let index = 0; index < 12; index++) {
    await createTodayTask(page, `Scrolling task ${index}`);
  }
  await page.setViewportSize({ width: 320, height: 640 });
  await page.locator('[data-sidebar="trigger"]').click();
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0);
  const header = page
    .locator("header[data-command-palette-swipe-region]")
    .filter({ visible: true });
  let scrollArea = page
    .locator("[data-all-tasks-column] .overflow-y-auto")
    .first();
  const originalTop = (await header.boundingBox())?.y;
  const scrollBounds = await scrollArea.boundingBox();
  if (!scrollBounds || originalTop === undefined)
    throw new Error("Task view is missing");
  await page.mouse.move(
    scrollBounds.x + scrollBounds.width / 2,
    scrollBounds.y + 100,
  );
  await page.mouse.wheel(0, 1500);
  await expect
    .poll(() => scrollArea.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await header.boundingBox())?.y)
    .toBe(originalTop);
  const lastTask = page
    .locator('[data-all-tasks-column] [data-focusable-key^="task^^"]')
    .last();
  await lastTask.click();
  const lastTaskBounds = await lastTask.boundingBox();
  const toolbarBounds = await page
    .getByRole("button", { name: "Delete", exact: true })
    .boundingBox();
  if (!lastTaskBounds || !toolbarBounds)
    throw new Error("Mobile task controls are missing");
  expect(lastTaskBounds.y + lastTaskBounds.height).toBeLessThanOrEqual(
    toolbarBounds.y,
  );
  await page.mouse.wheel(0, -1500);
  await expect
    .poll(() => scrollArea.evaluate((element) => element.scrollTop))
    .toBe(0);
  await expect
    .poll(async () => (await header.boundingBox())?.y)
    .toBe(originalTop);
  await header.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page.getByRole("link", { name: /^Inbox/ }).click();
  await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0);
  await expect(header.getByRole("heading", { name: "Inbox" })).toBeVisible();
  scrollArea = page.locator("#main-scrollable-area");
  const projectTop = (await header.boundingBox())?.y;
  const projectScrollBounds = await scrollArea.boundingBox();
  if (!projectScrollBounds || projectTop === undefined)
    throw new Error("Project view is missing");
  await page.mouse.move(
    projectScrollBounds.x + projectScrollBounds.width / 2,
    projectScrollBounds.y + 100,
  );
  await page.mouse.wheel(0, 1500);
  await expect
    .poll(() => scrollArea.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await header.boundingBox())?.y)
    .toBe(projectTop);
  await page.mouse.wheel(0, -1500);
  await expect
    .poll(() => scrollArea.evaluate((element) => element.scrollTop))
    .toBe(0);
  await expect
    .poll(async () => (await header.boundingBox())?.y)
    .toBe(projectTop);
});

test.describe("mobile project actions", () => {
  test.use({ viewport: { width: 320, height: 740 }, hasTouch: true });
  test("keeps project rename and icon editing in the options menu", async ({
    page,
  }) => {
    const space = uniqueE2EName("Mobile project actions");
    await signupUser(page);
    await createSpace(page, space);
    await openSpace(page, space);
    await page.locator('[data-sidebar="trigger"]').tap();
    await page.getByRole("link", { name: /^Inbox/ }).tap();
    const options = page.getByRole("button", {
      name: "Filters and sorting",
      exact: true,
    });
    await options.tap();
    await page
      .getByRole("button", { name: "Rename project", exact: true })
      .tap();
    const prompt = page.getByRole("dialog", {
      name: "Enter new project title",
    });
    await prompt.getByRole("textbox").fill("Renamed mobile inbox");
    await prompt.getByRole("button", { name: "Confirm", exact: true }).tap();
    await expect(
      page.getByRole("heading", { name: "Renamed mobile inbox", exact: true }),
    ).toBeVisible();
    if ((await options.getAttribute("data-state")) !== "open")
      await options.tap();
    await page
      .getByRole("button", { name: "Change project icon", exact: true })
      .tap();
    await expect(page.getByPlaceholder("Search")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Change project icon", exact: true }),
    ).toBeFocused();
  });
});
