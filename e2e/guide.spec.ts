import { expect, test } from "@playwright/test";
import { admin } from "./helpers";

test("a brand-new student gets the checklist and an automatic tour, once", async ({ page }) => {
  const email = `guide-${Date.now()}@coep.seed.test`;
  const { data, error } = await admin().auth.admin.generateLink({ type: "signup", email, password: "Guide-pass-123" });
  if (error) throw error;
  try {
    await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}&type=signup`);
    await page.getByLabel("Full name").fill("Guide Tester");
    await page.getByLabel("College", { exact: true }).selectOption({ label: "COEP Technological University — Pune" });
    await page.getByRole("button", { name: "Save profile" }).click();

    // Checklist: progress is real, the next step is linked.
    const checklist = page.getByRole("region", { name: "Get started" });
    await expect(checklist).toBeVisible();
    await expect(checklist.getByRole("progressbar", { name: "Getting started progress" })).toBeVisible();
    await expect(checklist.getByRole("link", { name: /Find a club/ })).toBeVisible();

    // The tour offers itself with an intro, then walks through the page.
    const intro = page.getByRole("dialog", { name: "Welcome to Got Next" });
    await expect(intro).toBeVisible();
    await intro.getByRole("button", { name: "Show me around" }).click();
    const tour = page.getByRole("dialog", { name: "Start with your campus" });
    await expect(tour).toBeVisible();
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("dialog", { name: "Search events and clubs" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("page-tour")).toHaveCount(0);

    // Seen once → doesn't auto-start again; the guide menu can replay it.
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("page-tour")).toHaveCount(0);
    await page.getByRole("button", { name: "Help and guided tours" }).click();
    await page.getByRole("menuitem", { name: "Tour this page" }).click();
    // Replays skip the intro.
    await expect(page.getByRole("dialog", { name: "Start with your campus" })).toBeVisible();

    // Following a club ticks the checklist off.
    await page.keyboard.press("Escape");
    await checklist.getByRole("link", { name: /Find a club/ }).click();
    await page.getByRole("button", { name: "Follow" }).click();
    await expect(page.getByRole("button", { name: "Following" })).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Get started" })).toContainText("1 of 5 done");

    // Hide persists.
    await page.getByRole("region", { name: "Get started" }).getByRole("button", { name: "Hide" }).click();
    await expect(page.getByRole("region", { name: "Get started" })).toHaveCount(0);
  } finally {
    await admin().auth.admin.deleteUser(data.user.id);
  }
});
