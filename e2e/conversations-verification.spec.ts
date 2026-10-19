import { expect, test, type Browser, type Page } from "@playwright/test";
import { acceptNextConfirm, admin, signInAs } from "./helpers";

/** A new student at COEP whose email isn't a college address, so they start unverified. */
async function newUnverifiedStudent(browser: Browser, label: string) {
  const email = `${label}-${Date.now()}@personal.seed.test`;
  const { data, error } = await admin().auth.admin.generateLink({ type: "signup", email, password: "Verify-pass-123" });
  if (error) throw error;
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}&type=signup`);
  await page.getByLabel("Full name").fill(`${label} Tester`);
  const username = await page.getByLabel("Username").inputValue();
  await page.getByLabel("College", { exact: true }).selectOption({ label: "COEP Technological University — Pune" });
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page).not.toHaveURL(/onboarding/);
  return { context, page, username, userId: data.user.id };
}

async function closeTourIfOpen(page: Page) {
  const notNow = page.getByRole("button", { name: "Not now" });
  if (await notNow.isVisible().catch(() => false)) await notNow.click();
}

test("leader and applicant can talk about an application, both ways, live", async ({ browser }) => {
  const run = Date.now().toString(36);
  const ask = `Can you join a call at 6? (${run})`;
  const reply = `Yes! See you then. (${run})`;
  const leader = await signInAs(browser, "neha", "/me/applications");
  await leader.page.getByRole("link", { name: /Signal Shifters/ }).first().click();
  await leader.page.getByRole("link", { name: /Review applications/ }).click();
  const meeraCard = leader.page.getByRole("listitem").filter({ hasText: "Meera Nair" });
  await meeraCard.getByRole("link", { name: /Message|New reply/ }).click();
  await expect(leader.page.getByRole("heading", { level: 1, name: "Meera Nair" })).toBeVisible();
  const threadUrl = leader.page.url();

  await leader.page.getByLabel("Message Meera Nair").fill(ask);
  await leader.page.getByRole("button", { name: "Send" }).click();
  await expect(leader.page.getByText(ask)).toBeVisible();

  // The applicant sees it from their applications page and replies.
  const applicant = await signInAs(browser, "meera", "/me/applications");
  await applicant.page.getByRole("link", { name: /New message/ }).first().click();
  await expect(applicant.page).toHaveURL(threadUrl);
  await expect(applicant.page.getByText(ask)).toBeVisible();
  await applicant.page.getByLabel("Message Neha Joshi").fill(reply);
  await applicant.page.keyboard.press("Enter");

  // The reply reaches the leader's open conversation without a reload.
  await expect(leader.page.getByRole("region", { name: "Conversation with Meera Nair" }).getByText(reply)).toBeVisible();

  await leader.context.close();
  await applicant.context.close();
});

test("two verified classmates can vouch a student into verification", async ({ browser }) => {
  const student = await newUnverifiedStudent(browser, "vouchee");
  try {
    await closeTourIfOpen(student.page);
    await student.page.goto("/verify");
    await expect(student.page.getByText("0 of 2", { exact: false })).toBeVisible();

    for (const handle of ["riya", "aarav"]) {
      const voucher = await signInAs(browser, handle, `/u/${student.username}`);
      acceptNextConfirm(voucher.page);
      await voucher.page.getByRole("button", { name: /Vouch for vouchee/ }).click();
      await expect(voucher.page.getByText(/You vouched|is now verified/).first()).toBeVisible();
      await voucher.context.close();
    }

    await student.page.goto(`/u/${student.username}`);
    await expect(student.page.getByRole("region", { name: "Profile" }).getByText("Verified student", { exact: true })).toBeVisible();
    await student.page.goto("/verify");
    await expect(student.page.getByText(/Verified by classmate vouches/)).toBeVisible();
  } finally {
    await student.context.close();
    await admin().auth.admin.deleteUser(student.userId);
  }
});

test("a student ID photo is reviewed by an admin and verifies the student", async ({ browser }) => {
  const student = await newUnverifiedStudent(browser, "idcard");
  try {
    await closeTourIfOpen(student.page);
    await student.page.goto("/verify");
    // 1×1 PNG stands in for the photo.
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    await student.page.locator('input[type="file"]').setInputFiles({ name: "id.png", mimeType: "image/png", buffer: png });
    await expect(student.page.getByText("In review")).toBeVisible();

    const reviewer = await signInAs(browser, "riya", "/verify/review");
    const card = reviewer.page.getByRole("listitem").filter({ hasText: "idcard Tester" });
    await expect(card.getByRole("img", { name: /Student ID submitted by/ })).toBeVisible();
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(reviewer.page.getByText("idcard Tester")).toHaveCount(0);
    await reviewer.context.close();

    await student.page.reload();
    await expect(student.page.getByText(/You're verified at COEP/)).toBeVisible();
    await expect(student.page.getByText(/Verified by student ID card/)).toBeVisible();
  } finally {
    await student.context.close();
    await admin().auth.admin.deleteUser(student.userId);
  }
});
