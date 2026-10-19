/**
 * Captures the README screenshots from a running dev server with seed data and E2E_TEST_LOGIN=1.
 *   npm run dev            (in another terminal)
 *   npx tsx scripts/screenshots.ts
 * Writes light and dark PNGs to docs/screenshots/.
 */
import { mkdirSync } from "node:fs";
import { chromium, type Browser, type Page } from "@playwright/test";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const OUT = "docs/screenshots";
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

type Scheme = "light" | "dark";

async function signedIn(browser: Browser, handle: string, scheme: Scheme, viewport = DESKTOP) {
  const context = await browser.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${BASE}/api/test-login?u=${handle}&next=/`);
  await page.getByRole("button", { name: "Account menu" }).waitFor();
  return { context, page };
}

async function shot(page: Page, name: string, scheme: Scheme) {
  // Hide the Next.js dev badge and any open tour.
  await page.addStyleTag({ content: "nextjs-portal, [data-testid='page-tour'] { display: none !important; }" });
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/${name}-${scheme}.png` });
  console.log(`  ${name}-${scheme}.png`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const scheme of ["light", "dark"] as const) {
    console.log(scheme);

    // Signed out: the landing page.
    const visitor = await browser.newContext({ viewport: DESKTOP, colorScheme: scheme, deviceScaleFactor: 2, reducedMotion: "reduce" });
    const vp = await visitor.newPage();
    await vp.goto(`${BASE}/`);
    await shot(vp, "landing", scheme);
    await visitor.close();

    // Student: feed, event, team board.
    const student = await signedIn(browser, "aarav", scheme);
    const p = student.page;
    await p.goto(`${BASE}/?scope=india`);
    const hide = p.getByRole("button", { name: "Hide" });
    if (await hide.isVisible()) await hide.click();
    await shot(p, "feed", scheme);

    await p.getByRole("link", { name: /COEP AI Hackathon 2026/ }).first().click();
    await p.waitForURL(/\/events\/[^/?]+$/);
    const eventUrl = p.url();
    await shot(p, "event", scheme);

    await p.goto(`${eventUrl}?tab=teams`);
    // The tabs sit below the poster; bring them to the top of the frame.
    await p.getByRole("main").getByRole("link", { name: /^Teams/ }).first().evaluate((el) => {
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90);
    });
    await shot(p, "team-board", scheme);
    await student.context.close();

    // Leader: team room.
    const leader = await signedIn(browser, "neha", scheme);
    await leader.page.goto(`${eventUrl}?tab=teams`);
    await leader.page.getByRole("link", { name: /Signal Shifters/ }).first().click();
    await leader.page.waitForURL(/\/teams\//);
    await shot(leader.page, "team-room", scheme);
    await leader.context.close();

    // Organizer: dashboard.
    const org = await signedIn(browser, "riya", scheme);
    await org.page.goto(`${eventUrl.replace(/\/$/, "")}/manage`);
    await shot(org.page, "dashboard", scheme);
    await org.context.close();

    // Phone: feed.
    const phone = await signedIn(browser, "meera", scheme, PHONE);
    await phone.page.goto(`${BASE}/?scope=india`);
    const hidePhone = phone.page.getByRole("button", { name: "Hide" });
    if (await hidePhone.isVisible()) await hidePhone.click();
    await shot(phone.page, "phone", scheme);
    await phone.context.close();
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
