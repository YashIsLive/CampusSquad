import { expect, test, type Browser } from "@playwright/test";

/**
 * Sign in → find event → apply → leader accepts.
 * Aarav (COEP, Python/ML beginner) applies to Kachra Kart's "ML / optimisation" role on the
 * COEP AI Hackathon; Dev (PICT, team leader) accepts; Aarav sees the acceptance.
 * Requires a freshly seeded DB (`npm run db:seed -- --reset`).
 */

async function signInAs(browser: Browser, handle: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/api/test-login?u=${handle}&next=/`);
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
  return { context, page };
}

test("solo student applies to a role and the leader accepts", async ({ browser }) => {
  // --- Aarav finds the event and applies ---
  const aarav = await signInAs(browser, "aarav");
  await aarav.page.goto("/?scope=india");
  await aarav.page.getByRole("searchbox", { name: /search events/i }).fill("COEP AI Hackathon");
  await aarav.page.waitForURL(/q=COEP/);
  await aarav.page.getByRole("link", { name: "COEP AI Hackathon 2026" }).first().click();
  await expect(aarav.page.getByRole("heading", { level: 1, name: "COEP AI Hackathon 2026" })).toBeVisible();

  await aarav.page.getByRole("navigation", { name: "Event sections" }).getByRole("link", { name: /^Teams/ }).click();
  const role = aarav.page.getByRole("listitem").filter({ has: aarav.page.getByRole("heading", { name: "ML / optimisation" }) });
  await expect(role).toBeVisible();
  await role.getByRole("button", { name: "Apply" }).click();

  const dialog = aarav.page.getByRole("dialog");
  await dialog.getByLabel("Why you?").fill("I clean data with pandas daily and want to learn routing heuristics.");
  await dialog.getByRole("button", { name: "Send application" }).click();
  await expect(role.getByText(/Applied · pending/i)).toBeVisible();

  // --- Dev (Kachra Kart leader) reviews and accepts ---
  const dev = await signInAs(browser, "dev");
  await dev.page.goto("/me/applications");
  await dev.page.getByRole("link", { name: /Kachra Kart/ }).first().click();
  await dev.page.getByRole("link", { name: /Review applications/ }).click();

  const card = dev.page.getByRole("listitem").filter({ hasText: "Aarav Deshmukh" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Accept" }).click();
  await expect(card.getByText("accepted", { exact: false })).toBeVisible();

  // --- Aarav sees the acceptance ---
  await aarav.page.goto("/me/applications");
  const myApp = aarav.page.getByRole("listitem").filter({ hasText: "ML / optimisation" });
  await expect(myApp.getByText("accepted")).toBeVisible();
  await myApp.getByRole("link", { name: "Open team" }).click();
  await expect(aarav.page.getByRole("heading", { level: 1, name: "Kachra Kart" })).toBeVisible();

  await aarav.context.close();
  await dev.context.close();
});
