import { expect, test } from "@playwright/test";

test("connects locally and streams an agent response", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Connected")).toBeVisible();
  await page.getByLabel("Message Pi").fill("hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Echo: hello")).toBeVisible();
});
