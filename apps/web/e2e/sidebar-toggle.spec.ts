import { expect, test } from "playwright/test";

import { createSpace, openSpace, signupUser, uniqueE2EName } from "./helpers";

test("left edge of the sidebar trigger toggles the sidebar", async ({
  page,
}) => {
  const spaceName = uniqueE2EName("E2E Sidebar Space");

  await signupUser(page);
  await createSpace(page, spaceName);
  await openSpace(page, spaceName);
  await expect(page.getByRole("link", { name: /today/i })).toBeVisible();

  const sidebarTrigger = page.locator('[data-sidebar="trigger"]');

  await expect(sidebarTrigger).toHaveAttribute("data-open", "true");

  let triggerBox = await sidebarTrigger.boundingBox();
  if (!triggerBox) {
    throw new Error("Sidebar trigger is not visible");
  }

  await sidebarTrigger.click({
    position: { x: 3, y: triggerBox.height / 2 },
    timeout: 2_000,
  });
  await expect(sidebarTrigger).toHaveAttribute("data-open", "false");

  triggerBox = await sidebarTrigger.boundingBox();
  if (!triggerBox) {
    throw new Error("Sidebar trigger is not visible after collapsing");
  }

  await sidebarTrigger.click({
    position: { x: 3, y: triggerBox.height / 2 },
    timeout: 2_000,
  });
  await expect(sidebarTrigger).toHaveAttribute("data-open", "true");
});
