import { expect, test } from "@playwright/test";
import { admin } from "./helpers";

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
