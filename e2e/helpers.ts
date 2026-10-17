import { expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "campus-demo-2026";

/** Service-role client for test setup only (minting links, creating throwaway users). */
export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/** Fresh browser context signed in as a seed user via the dev-only demo login. */
export async function signInAs(browser: Browser, handle: string, next = "/") {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/api/test-login?u=${handle}&next=${encodeURIComponent(next)}`);
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
  return { context, page };
}

/** Accept the next window.confirm() (used by destructive buttons). */
export function acceptNextConfirm(page: Page) {
  page.once("dialog", (d) => void d.accept());
}

/**
 * Runs axe on the current page and fails on serious/critical WCAG A/AA violations.
 * Decorative poster art and third-party widgets are excluded.
 */
export async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("[data-testid='page-tour']")
    .exclude("nextjs-portal")
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const report = serious
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n    ")}`)
    .join("\n");
  expect(serious, `${label} has accessibility violations:\n${report}`).toEqual([]);
}
