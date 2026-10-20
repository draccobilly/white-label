import { expect, test } from "@playwright/test";

const campaignPath = process.env.E2E_CAMPAIGN_PATH;

test.describe("affiliate campaign flow", () => {
  test.skip(!campaignPath, "Set E2E_CAMPAIGN_PATH after seeding the test database");

  test("campaign opens checkout with an amount selected", async ({ page }) => {
    await page.goto(campaignPath!);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const amount = page.locator(".amount-button").first();
    if (await amount.isVisible()) {
      await amount.click();
    } else {
      await page.getByRole("link", { name: "Donate now" }).last().click();
    }
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByRole("heading", { name: "Choose an amount" })).toBeVisible();
    await expect(page.locator(".amount-button[aria-pressed='true']")).toHaveCount(1);
  });

  test("public route contains no administrator navigation", async ({ page }) => {
    await page.goto(campaignPath!);
    await expect(page.getByRole("link", { name: "Campaigns" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Affiliates" })).toHaveCount(0);
  });
});
