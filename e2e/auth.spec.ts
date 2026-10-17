import { expect, test } from "@playwright/test";
import { SEED_PASSWORD, admin } from "./helpers";

test.describe("sign-in and sign-up", () => {
  test("protected pages send you to sign in, then back", async ({ page }) => {
    await page.goto("/me/events");
    await expect(page).toHaveURL(/\/login\?next=%2Fme%2Fevents/);
    await page.getByRole("tab", { name: "Password" }).click();
    await page.getByLabel("Email").fill("riya@coep.seed.test");
    await page.getByLabel("Password", { exact: true }).fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/me\/events$/);
    await expect(page.getByRole("heading", { level: 1, name: "My events" })).toBeVisible();
  });

  test("wrong password shows a clear error", async ({ page }) => {
    await page.goto("/login?mode=signin");
    await page.getByLabel("Email").fill("riya@coep.seed.test");
    await page.getByLabel("Password", { exact: true }).fill("not-the-password-1");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Wrong email or password.");
  });

  test("password rules are explained before sending", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveURL(/mode=signup/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Join your campus board.");
    await page.getByLabel("College email").fill("someone@coep.seed.test");
    await page.getByLabel("Password", { exact: true }).fill("abcdefgh");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("letter and one number");
  });

  test("forgot-password mode is reachable and reversible", async ({ page }) => {
    await page.goto("/login?mode=signin");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await page.getByRole("button", { name: "Back to sign in" }).click();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  });

  test("a new account confirms by link, sets up a profile, then continues", async ({ page }) => {
    const email = `e2e-${Date.now()}@pict.seed.test`;
    const { data, error } = await admin().auth.admin.generateLink({ type: "signup", email, password: "E2e-pass-123" });
    if (error) throw error;
    try {
      await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}&type=signup&next=%2Fme%2Fevents`);
      await expect(page).toHaveURL(/\/onboarding\?next=%2Fme%2Fevents/);
      await expect(page.getByRole("heading", { level: 1, name: "Set up your profile" })).toBeVisible();

      await page.getByLabel("Full name").fill("Esha Test");
      await page.getByLabel("College", { exact: true }).selectOption({ label: "Pune Institute of Computer Technology — Pune" });
      const skills = page.getByPlaceholder("Search skills…");
      for (const s of ["Python", "SQL", "Figma"]) {
        await skills.fill(s);
        await skills.press("Enter");
      }
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(page).toHaveURL(/\/me\/events$/);
    } finally {
      await admin().auth.admin.deleteUser(data.user.id);
    }
  });

  test("an expired or reused link explains what to do", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=deadbeef&type=magiclink");
    await expect(page).toHaveURL(/\/login\?error=/);
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  });
});
