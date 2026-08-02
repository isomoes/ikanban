import { expect, test } from "@playwright/test";

test("shows consecutive user prompts and streams agent responses", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Connected")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ikanban" })).toBeVisible();
  await page.getByRole("button", { name: /Open session:/ }).first().click();
  await expect(page).toHaveURL(/\/[A-Za-z0-9_-]+\/fake-session$/);
  await page.getByLabel("Message Pi").fill("hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("hello", { exact: true })).toBeVisible();
  await expect(page.getByText("Echo: hello")).toBeVisible();

  await page.getByLabel("Message Pi").fill("second prompt");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("second prompt", { exact: true })).toBeVisible();
  await expect(page.getByText("Echo: second prompt")).toBeVisible();
});

test("opens another workspace and keeps sessions grouped by path", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Connected")).toBeVisible();
  const board = page.getByRole("main");
  await expect(board.getByRole("heading", { name: "Ikanban" })).toBeVisible();

  await board.getByRole("button", { name: "Open workspace" }).click();
  const picker = page.getByRole("dialog", { name: "Open workspace" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "apps" }).click();
  await picker.getByRole("button", { name: /Open .*\/apps$/ }).click();

  await expect(board.locator(".board-card")).toHaveCount(2);
  const appsSession = board.locator(".board-card").filter({ hasText: "ikanban/apps" });
  await appsSession.getByRole("button", { name: /Open session:/ }).click();
  await expect(page).toHaveURL(/\/[A-Za-z0-9_-]+\/fake-session$/);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Ikanban" })).toBeVisible();
});
