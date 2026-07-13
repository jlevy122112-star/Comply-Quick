import { expect, test } from "@playwright/test";

test.describe("public user experience", () => {
  test("renders the distinct login actions", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In with Email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Email Me a Magic Link Instead" })).toBeVisible();
    await expect(page).toHaveScreenshot("login-desktop.png", { fullPage: true });
  });

  test("preserves the login experience on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");

    await expect(page.getByRole("button", { name: "Sign In with Email" })).toBeVisible();
    await expect(page).toHaveScreenshot("login-mobile.png", { fullPage: true });
  });

  test("renders the landing page", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveScreenshot("landing.png", { fullPage: true });
  });
});
