import { expect, test } from "@playwright/test";
import { SEED_PASSWORD, admin } from "./helpers";

test.describe("sign-in and sign-up", () => {
  test("protected pages send you to sign in, then back", async ({ page }) => {
    await page.goto("/me/events");
    await expect(page).toHaveURL(/\/login\?next=%2Fme%2Fevents/);
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
    await expect(page.getByRole("main").getByRole("alert")).toContainText("That email and password don't match");
  });

  test("password rules are explained before sending", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveURL(/mode=signup/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Get in the game.");
    await page.getByLabel("College email").fill("someone@coep.seed.test");
    await page.getByLabel("Password", { exact: true }).fill("abcdefghijk");
    await page.getByRole("button", { name: "Create account" }).last().click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("letter and one number");
  });

  test("instant sign-up: no email, straight to profile setup, unverified until Google", async ({ page }) => {
    const email = `instant-${Date.now()}@coep.seed.test`;
    await page.goto("/login");
    await page.getByRole("tab", { name: "Create account" }).click();
    await page.getByLabel("College email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Instant-pass-42");
    await page.getByRole("button", { name: "Create account" }).last().click();
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByRole("heading", { level: 1, name: "Set up your profile" })).toBeVisible();

    const { data } = await admin().auth.admin.listUsers({ perPage: 200 });
    const created = data.users.find((u) => u.email === email);
    expect(created, "account was created").toBeTruthy();
    try {
      // Same email again → clear message, not a second account.
      const other = await page.context().browser()!.newContext();
      const p2 = await other.newPage();
      await p2.goto("/login?mode=signup");
      await p2.getByLabel("College email").fill(email);
      await p2.getByLabel("Password", { exact: true }).fill("Instant-pass-42");
      await p2.getByRole("button", { name: "Create account" }).last().click();
      await expect(p2.getByRole("main").getByRole("alert")).toContainText("already exists");
      await other.close();
    } finally {
      if (created) await admin().auth.admin.deleteUser(created.id);
    }
  });

  test("password comes first; email options appear only when email is set up", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("tab", { name: "Sign in" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Create account" })).toBeVisible();
    const emailOn = process.env.AUTH_EMAIL_ENABLED === "1";
    await expect(page.getByRole("button", { name: "Forgot password?" })).toHaveCount(emailOn ? 1 : 0);
    await expect(page.getByRole("button", { name: /Email me a sign-in link/ })).toHaveCount(emailOn ? 1 : 0);
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
      await page.getByLabel(/I.m 18 or older/).check();
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
