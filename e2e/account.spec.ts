import { expect, test } from "@playwright/test";
import { admin, signInAs } from "./helpers";

test("a student can download their data and delete their account", async ({ browser }) => {
  const email = `leaver-${Date.now()}@personal.seed.test`;
  const { data, error } = await admin().auth.admin.generateLink({ type: "signup", email, password: "Leaver-pass-123" });
  if (error) throw error;
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}&type=signup`);
    await page.getByLabel("Full name").fill("Leaver Tester");
    await page.getByLabel("College", { exact: true }).selectOption({ label: "COEP Technological University — Pune" });
    await page.getByLabel(/I.m 18 or older/).check();
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page).not.toHaveURL(/onboarding/);

    await page.goto("/account");
    await expect(page.getByRole("heading", { level: 1, name: "Account and privacy" })).toBeVisible();

    // Download my data: a JSON file with their profile in it.
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download my data" }).click()]);
    const exported = JSON.parse((await (await download.createReadStream()).toArray()).join(""));
    expect(exported.profile.email).toBe(email);

    // Delete: needs the typed confirmation.
    await page.getByRole("button", { name: "Delete my account" }).click();
    const confirm = page.getByRole("button", { name: "Delete everything" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel('Type "delete" to confirm').fill("delete");
    await confirm.click();
    await expect(page.getByRole("status").filter({ hasText: "Your account and its data have been deleted" })).toBeVisible();

    const { data: gone } = await admin().auth.admin.getUserById(data.user.id);
    expect(gone.user).toBeNull();
  } finally {
    await context.close();
    await admin().auth.admin.deleteUser(data.user.id).catch(() => {});
  }
});

test("privacy policy and terms are public", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  await expect(page.getByText(/delete the photo as soon as it.s been reviewed/)).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
});

test("a student can change their password from Account and privacy", async ({ browser }) => {
  const email = `pwchange-${Date.now()}@personal.seed.test`;
  const { data, error } = await admin().auth.admin.createUser({ email, password: "Old-pass-123", email_confirm: true });
  if (error) throw error;
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    // Sign in with the old password (seed.test addresses skip the new-device email step).
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Old-pass-123");
    await page.getByRole("button", { name: "Sign in" }).last().click();
    await expect(page).toHaveURL(/onboarding/);

    await page.goto("/account");
    await page.getByLabel("Current password").fill("wrong-pass-123");
    await page.getByLabel("New password").fill("New-pass-4567");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Your current password isn't right.")).toBeVisible();

    await page.getByLabel("Current password").fill("Old-pass-123");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();

    // The new password works; the old one doesn't.
    const anon = admin();
    const { error: newErr } = await anon.auth.signInWithPassword({ email, password: "New-pass-4567" });
    expect(newErr).toBeNull();
  } finally {
    await context.close();
    await admin().auth.admin.deleteUser(data.user.id);
  }
});

test("Back returns to the previous page, or to a sensible parent when opened directly", async ({ browser }) => {
  const { page, context } = await signInAs(browser, "aarav", "/?scope=india");
  await page.getByRole("heading", { name: "COEP AI Hackathon 2026" }).getByRole("link").click();
  await expect(page).toHaveURL(/\/events\//);
  const eventUrl = page.url();
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/\?scope=india/);

  // Opened straight from a link: Back stays on the site and goes to the club.
  await page.goto(eventUrl);
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/orgs\//);
  await context.close();
});
