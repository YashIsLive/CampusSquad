import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("organizer", () => {
  test("post an event; followers are notified", async ({ browser }) => {
    const riya = await signInAs(browser, "riya", "/events/new");
    const title = `E2E Paper Reading ${Date.now()}`;
    await riya.page.getByLabel("Title").fill(title);
    await riya.page.getByLabel("Description").fill("Read and discuss one recent ML paper together. Snacks provided.");
    await riya.page.getByLabel("Venue").fill("CSE Seminar Room");
    await riya.page.getByRole("button", { name: "Publish" }).click();
    await expect(riya.page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    // Aarav follows COEP AI Club in the seed data.
    const aarav = await signInAs(browser, "aarav", "/notifications");
    await expect(aarav.page.getByText(`COEP AI Club posted: ${title}`)).toBeVisible();
    await riya.context.close();
    await aarav.context.close();
  });

  test("share link tracks clicks; registrants export; announcement; check-in", async ({ browser }) => {
    const riya = await signInAs(browser, "riya", "/me/events");
    await riya.page
      .getByRole("article")
      .filter({ hasText: "COEP AI Hackathon 2026" })
      .getByRole("link", { name: "Manage" })
      .click();
    await expect(riya.page.getByRole("heading", { level: 1, name: "COEP AI Hackathon 2026" })).toBeVisible();
    const manageUrl = new URL(riya.page.url()).pathname;

    // Share kit: create a tracked link, follow it, see the click.
    await riya.page.getByRole("navigation", { name: "Manage sections" }).getByRole("link", { name: "Share kit" }).click();
    const label = `E2E group ${Date.now()}`;
    await riya.page.getByPlaceholder("Channel, e.g. CSE 2nd-yr WhatsApp").fill(label);
    await riya.page.getByRole("button", { name: "Create", exact: true }).click();
    const row = riya.page.getByRole("listitem").filter({ hasText: label });
    const shortUrl = (await row.locator(".font-mono").textContent())!.trim();
    const res = await riya.page.request.get(shortUrl, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    await riya.page.reload();
    await expect(riya.page.getByRole("listitem").filter({ hasText: label })).toContainText("1 clicks");

    // People list + CSV.
    await riya.page.getByRole("navigation", { name: "Manage sections" }).getByRole("link", { name: "People" }).click();
    const [download] = await Promise.all([riya.page.waitForEvent("download"), riya.page.getByRole("link", { name: "Export CSV" }).click()]);
    expect(download.suggestedFilename()).toMatch(/registrants\.csv$/);

    // Announcement reaches a registrant (Aarav is registered in the seed data).
    await riya.page.goto(manageUrl);
    const announcement = `Venue moved to Hall B (${Date.now()})`;
    await riya.page.getByPlaceholder(/Venue changed/).fill(announcement);
    await riya.page.getByRole("button", { name: "Send announcement" }).click();
    await expect(riya.page.getByText(/Sent to \d+ registrants?/)).toBeVisible();
    const aarav = await signInAs(browser, "aarav", "/notifications");
    await expect(aarav.page.getByText(announcement)).toBeVisible();

    // Check-in with Aarav's code from his ticket.
    await aarav.page.goto(manageUrl.replace("/manage", ""));
    const code = (await aarav.page.getByRole("complementary", { name: "Registration" }).locator("dd.font-mono").textContent())!.trim();
    await riya.page.goto(`${manageUrl}?section=checkin`);
    await riya.page.getByPlaceholder("Or type the 10-character code").fill(code);
    await riya.page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(riya.page.getByRole("status").filter({ hasText: "Aarav Deshmukh" })).toContainText("checked in");

    await riya.context.close();
    await aarav.context.close();
  });

  test("admin verifies a requested college", async ({ browser }) => {
    const riya = await signInAs(browser, "riya", "/admin");
    await expect(riya.page.getByRole("heading", { level: 1, name: "Admin" })).toBeVisible();
    await riya.page.getByLabel("Email domain").fill("vit.edu");
    await riya.page.getByRole("button", { name: "Verify college" }).click();
    await expect(riya.page.getByText("No pending requests")).toBeVisible();
    await riya.context.close();
  });

  test("non-admins can't open the admin page", async ({ browser }) => {
    const aarav = await signInAs(browser, "aarav");
    const res = await aarav.page.goto("/admin");
    expect(res?.status()).toBe(404);
    await aarav.context.close();
  });
});
