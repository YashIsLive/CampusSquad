import { expect, test } from "@playwright/test";
import { admin, signInAs } from "./helpers";

test("a student reports a profile; an admin acts on it; the student hears back", async ({ browser }) => {
  const details = `Pretending to be the club lead (${Date.now()})`;
  const aarav = await signInAs(browser, "aarav", "/u/meera");
  await aarav.page.getByRole("button", { name: "Report", exact: true }).click();
  const dialog = aarav.page.getByRole("dialog", { name: /Report Meera/ });
  await dialog.getByLabel("Fake or pretending to be someone else").check();
  await dialog.getByRole("textbox").fill(details);
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(aarav.page.getByText("Thanks. We'll look at it within 24 hours.")).toBeVisible();

  // Reporting the same thing twice is refused politely.
  await aarav.page.getByRole("button", { name: "Report", exact: true }).click();
  await aarav.page.getByRole("dialog").getByLabel("Spam or a scam").check();
  await aarav.page.getByRole("dialog").getByRole("button", { name: "Send report" }).click();
  await expect(aarav.page.getByText("You've already reported this.")).toBeVisible();

  const riya = await signInAs(browser, "riya", "/admin?section=reports");
  const report = riya.page.getByRole("listitem").filter({ hasText: details });
  await expect(report.getByText("Profile: Meera Nair (@meera)")).toBeVisible();
  const note = `We've asked them to change their bio (${Date.now()}).`;
  await report.getByLabel("Note to the reporter").fill(note);
  await report.getByRole("button", { name: "Acted on it" }).click();
  await expect(riya.page.getByText(details)).toHaveCount(0);

  await aarav.page.goto("/notifications");
  const told = aarav.page.getByRole("listitem").filter({ hasText: note });
  await expect(told.getByText("We acted on your report")).toBeVisible();

  await aarav.context.close();
  await riya.context.close();
});

test("new accounts can't skip the 18+ and terms confirmation", async ({ browser }) => {
  const email = `minor-${Date.now()}@personal.seed.test`;
  const { data, error } = await admin().auth.admin.generateLink({ type: "signup", email, password: "Minor-pass-123" });
  if (error) throw error;
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}&type=signup`);
    await page.getByLabel("Full name").fill("Box Skipper");
    await page.getByLabel("College", { exact: true }).selectOption({ label: "COEP Technological University — Pune" });
    // The browser blocks the empty required box; remove that to prove the server refuses too.
    await page.getByLabel(/I.m 18 or older/).evaluate((el) => el.removeAttribute("required"));
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Please confirm you're 18 or older")).toBeVisible();
    await expect(page).toHaveURL(/onboarding/);
  } finally {
    await context.close();
    await admin().auth.admin.deleteUser(data.user.id);
  }
});

test("the privacy policy names a grievance officer; security.txt is published", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByText(", Grievance Officer")).toBeVisible();
  const res = await page.request.get("/.well-known/security.txt");
  expect(res.ok()).toBe(true);
  expect(await res.text()).toMatch(/^Contact: mailto:/m);
});
