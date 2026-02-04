const { test, expect } = require("@playwright/test");

test("signup and open save/load modals", async ({ page }) => {
  const user = `user_${Date.now()}`;
  const pass = "password123";

  await page.goto("/signup");
  await page.fill("#username", user);
  await page.fill("#password", pass);
  await page.click("button[type=submit]");

  await expect(page.getByRole("heading", { name: "Controls" })).toBeVisible();

  await page.click("#openSaveModal");
  await expect(page.locator("#saveModal")).toBeVisible();
  await page.fill("#designName", `design_${Date.now()}`);
  await page.click("#saveBtn");

  await page.click("#openLoadModal");
  await expect(page.locator("#loadModal")).toBeVisible();
  await page.click("#togglePrivateView");
  await expect(page.locator("#privateGallerySection")).toBeVisible();
});

test("save then delete from private gallery", async ({ page }) => {
  const user = `user_${Date.now()}`;
  const pass = "password123";
  const designName = `design_${Date.now()}`;

  await page.goto("/signup");
  await page.fill("#username", user);
  await page.fill("#password", pass);
  await page.click("button[type=submit]");

  await page.click("#openSaveModal");
  await page.fill("#designName", designName);
  await page.click("#saveBtn");

  await page.click("#openLoadModal");
  await page.click("#togglePrivateView");
  await expect(page.locator("#privateGallerySection")).toBeVisible();

  const card = page.locator(".design-card", { hasText: designName }).first();
  await card.click({ button: "right" });
  await expect(page.locator("#designContextMenu")).toBeVisible();
  await page.click("#designDeleteBtn");
  await expect(page.locator("#deleteConfirmModal")).toBeVisible();
  await page.click("#deleteConfirmBtn");

  await expect(page.locator(".design-card", { hasText: designName })).toHaveCount(0);
});

test("public gallery search filters designs", async ({ page }) => {
  const user = `user_${Date.now()}`;
  const pass = "password123";
  const publicName = `public_${Date.now()}`;

  await page.goto("/signup");
  await page.fill("#username", user);
  await page.fill("#password", pass);
  await page.click("button[type=submit]");

  await page.click("#openSaveModal");
  await page.fill("#designName", publicName);
  await page.click("input[name='designVisibility'][value='public']");
  await page.click("#saveBtn");

  await page.click("#openLoadModal");
  await page.fill("#publicSearch", publicName);
  await expect(page.locator(".design-card", { hasText: publicName })).toBeVisible();
});
