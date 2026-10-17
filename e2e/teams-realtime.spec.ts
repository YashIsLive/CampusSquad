import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("team collaboration", () => {
  test("chat and checklist update live for teammates", async ({ browser }) => {
    // Neha and Kabir are both on Signal Shifters in the seed data.
    const neha = await signInAs(browser, "neha", "/me/applications");
    await neha.page.getByRole("link", { name: /Signal Shifters/ }).first().click();
    await expect(neha.page.getByRole("heading", { level: 1, name: "Signal Shifters" })).toBeVisible();
    const teamUrl = neha.page.url();

    const kabir = await signInAs(browser, "kabir", new URL(teamUrl).pathname);
    await expect(kabir.page.getByRole("heading", { level: 1, name: "Signal Shifters" })).toBeVisible();
    // Give both Realtime subscriptions a moment to join.
    await kabir.page.waitForTimeout(2500);

    const text = `Standup at 7? ${Date.now()}`;
    await neha.page.getByRole("textbox", { name: "Message" }).fill(text);
    await neha.page.getByRole("button", { name: "Send" }).click();
    await expect(neha.page.getByText(text)).toBeVisible();
    await expect(kabir.page.getByText(text)).toBeVisible({ timeout: 15_000 });

    const task = `Draft the pitch deck ${Date.now()}`;
    const input = kabir.page.getByPlaceholder("Add a task and press Enter");
    await input.fill(task);
    await input.press("Enter");
    await expect(kabir.page.getByText(task)).toBeVisible();
    await expect(neha.page.getByText(task)).toBeVisible({ timeout: 15_000 });

    await neha.context.close();
    await kabir.context.close();
  });

  test("leader invites a student who's looking; they accept and join", async ({ browser }) => {
    // Meera leads AquaSense on the COEP AI Hackathon; Isha has a "looking for a team" card there.
    const meera = await signInAs(browser, "meera", "/?scope=india&q=COEP%20AI%20Hackathon");
    await meera.page.getByRole("link", { name: "COEP AI Hackathon 2026" }).first().click();
    await meera.page.getByRole("navigation", { name: "Event sections" }).getByRole("link", { name: /^Teams/ }).click();
    const card = meera.page.getByRole("listitem").filter({ hasText: "Isha Bhosale" });
    await card.getByRole("button", { name: "Invite to my team" }).click();
    await meera.page.getByRole("dialog").getByRole("button", { name: "Send invite" }).click();
    await expect(meera.page.getByText("Invite sent to Isha Bhosale")).toBeVisible();

    const isha = await signInAs(browser, "isha", "/me/applications");
    const invite = isha.page.getByRole("listitem").filter({ hasText: "AquaSense" });
    await invite.getByRole("button", { name: "Accept" }).click();
    await expect(isha.page.getByRole("heading", { level: 1, name: "AquaSense" })).toBeVisible();

    await meera.context.close();
    await isha.context.close();
  });
});
