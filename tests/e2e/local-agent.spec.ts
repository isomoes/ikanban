import { expect, test } from "@playwright/test";

test("authenticates and streams a local agent response", async ({ page }) => {
  await page.goto("/?token=e2e-token");
  await expect(page.getByText("Connected")).toBeVisible();
  await page.getByLabel("Message Pi").fill("hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Echo: hello")).toBeVisible();
  await expect(page).not.toHaveURL(/token=/);
});
