import { expect, test } from "@playwright/test";
import { expectAccessible, signInAs } from "./helpers";

test.describe("phone layout", () => {
  test("bottom nav, sticky register bar and filter sheet work on a phone", async ({ browser }) => {
    const { page, context } = await signInAs(browser, "pooja", "/?scope=india");
    const nav = page.getByRole("navigation", { name: "Primary" }).last();
    await expect(nav.getByRole("link", { name: "Explore" })).toHaveAttribute("aria-current", "page");

    await page.getByRole("button", { name: /^Filters/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filters" });
    await sheet.getByLabel("Fee").selectOption("free");
    await sheet.getByRole("button", { name: "Show results" }).click();
    await expect(page).toHaveURL(/fee=free/);
    await expect(page.getByRole("list", { name: "Active filters" })).toContainText("Free");

    await page.getByRole("link", { name: "COEP AI Hackathon 2026" }).first().click();
    // Pooja is already on a team for this event, so the bar offers her ticket.
    const bar = page.getByRole("link", { name: /^(Register|View ticket)$/ }).last();
    await expect(bar).toBeVisible();
    await bar.click();
    await expect(page.locator("#ticket-heading")).toBeInViewport();
    await context.close();
  });
});

test.describe("accessibility (axe, WCAG 2.1 AA)", () => {
  test("public pages", async ({ page }) => {
    for (const path of ["/", "/login", "/login?mode=signup"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectAccessible(page, path);
    }
  });

  test("signed-in pages", async ({ browser }) => {
    const { page, context } = await signInAs(browser, "neha", "/?scope=india");
    await page.waitForLoadState("networkidle");
    await expectAccessible(page, "feed");

    await page.getByRole("link", { name: "COEP AI Hackathon 2026" }).first().click();
    await page.waitForLoadState("networkidle");
    await expectAccessible(page, "event page");

    await page.goto("/me/applications");
    await expectAccessible(page, "teams & applications");
    await page.getByRole("link", { name: /Signal Shifters/ }).first().click();
    await page.waitForLoadState("networkidle");
    await expectAccessible(page, "team page");

    for (const path of ["/me/events", "/notifications", "/u/neha", "/onboarding"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectAccessible(page, path);
    }
    await context.close();
  });
});
