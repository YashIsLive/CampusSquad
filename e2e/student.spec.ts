import { expect, test } from "@playwright/test";
import { acceptNextConfirm, signInAs } from "./helpers";

test.describe("student: discover, save, register, start a team", () => {
  test("feed scopes, search, type filter and the / shortcut", async ({ browser }) => {
    const { page, context } = await signInAs(browser, "harsh");
    // MIT-WPU student: campus feed shows MIT-WPU events.
    await expect(page.getByRole("heading", { level: 1, name: "At your college" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Flutter Forward Quiz" }).first()).toBeVisible();

    await page.getByRole("navigation", { name: "Where" }).getByRole("link", { name: "All of India" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Across India" })).toBeVisible();
    await expect(page.getByRole("link", { name: "PICT CodeSprint #12" }).first()).toBeVisible();

    await page.getByRole("group", { name: "Event type" }).getByRole("button", { name: "Hackathons" }).click();
    await expect(page).toHaveURL(/type=hackathon/);
    await expect(page.getByRole("link", { name: "PICT CodeSprint #12" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "COEP AI Hackathon 2026" }).first()).toBeVisible();

    await page.locator("body").press("/");
    await expect(page.getByRole("searchbox", { name: "Search events or clubs" })).toBeFocused();
    await context.close();
  });

  test("save an event, then find it in My events", async ({ browser }) => {
    // Harsh isn't registered for the ideathon, so it lands under "Saved".
    const { page, context } = await signInAs(browser, "harsh", "/?scope=india&q=Impetus");
    const card = page.getByRole("article").filter({ hasText: "Impetus Ideathon" });
    await card.getByRole("button", { name: "Save event" }).click();
    await expect(page.getByText(/Saved — we'll remind you/)).toBeVisible();
    await expect(card.getByRole("button", { name: "Unsave event" })).toBeVisible();
    await page.goto("/me/events");
    await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Saved" }) })).toContainText("Impetus Ideathon");
    await context.close();
  });

  test("register solo, see the ticket, cancel", async ({ browser }) => {
    const { page, context } = await signInAs(browser, "harsh", "/?scope=india&q=COEP%20AI%20Hackathon");
    await page.getByRole("link", { name: "COEP AI Hackathon 2026" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "COEP AI Hackathon 2026" })).toBeVisible();

    const ticket = page.getByRole("complementary", { name: "Registration" });
    await ticket.getByRole("button", { name: /Register solo/ }).click();
    await expect(ticket.getByText("You're in")).toBeVisible();
    await expect(ticket.getByText("Your entry code")).toBeVisible();
    await expect(ticket.getByText("No team yet.")).toBeVisible();

    acceptNextConfirm(page);
    await ticket.getByRole("button", { name: "Cancel registration" }).click();
    await expect(ticket.getByRole("button", { name: /Register solo/ })).toBeVisible();
    await context.close();
  });

  test("start a team and post a role", async ({ browser }) => {
    const { page, context } = await signInAs(browser, "zara", "/?scope=india&q=Build%20with%20AI");
    await page.getByRole("link", { name: "Build with AI — GDG Hackathon" }).first().click();
    await page.getByRole("complementary", { name: "Registration" }).getByRole("button", { name: "Register & start a team" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Team name").fill("Prompt Pirates");
    await dialog.getByRole("button", { name: "Create team" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Prompt Pirates" })).toBeVisible();
    await page.getByRole("button", { name: "Add an open spot" }).click();
    const roleDialog = page.getByRole("dialog");
    await roleDialog.getByLabel("Who you need").fill("Backend developer");
    const required = roleDialog.getByPlaceholder("Search skills…").first();
    await required.fill("Node");
    await required.press("Enter");
    await roleDialog.getByRole("button", { name: "Post spot" }).click();
    await expect(page.getByText("Backend developer")).toBeVisible();
    await context.close();
  });
});
