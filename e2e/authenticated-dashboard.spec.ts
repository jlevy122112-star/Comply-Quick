import { expect, test } from "@playwright/test";

const email = process.env.PLAYWRIGHT_TEST_EMAIL;
const password = process.env.PLAYWRIGHT_TEST_PASSWORD;

test.describe("authenticated dashboard", () => {
  test.skip(
    !email || !password,
    "Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD for authenticated E2E coverage."
  );

  test("signs in and reaches the Command Center", async ({ page }) => {
    await page.goto("/login?redirect=/dashboard/home");
    await page.getByLabel("Email address").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign In with Email" }).click();

    await expect(page).toHaveURL(/\/dashboard\/home/);
    await expect(page.getByText("Command Center")).toBeVisible();
  });
});
