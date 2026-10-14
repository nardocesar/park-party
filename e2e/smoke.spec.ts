import { expect, test } from "@playwright/test";

test("home renderiza o título", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Park Party" })).toBeVisible();
});
