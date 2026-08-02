import { expect, test } from "@playwright/test";

test("shows consecutive user prompts and streams agent responses", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Connected")).toBeVisible();
  await page.getByLabel("Message Pi").fill("hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("hello", { exact: true })).toBeVisible();
  await expect(page.getByText("Echo: hello")).toBeVisible();

  await page.getByLabel("Message Pi").fill("second prompt");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("second prompt", { exact: true })).toBeVisible();
  await expect(page.getByText("Echo: second prompt")).toBeVisible();
});
