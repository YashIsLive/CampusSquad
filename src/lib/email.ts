import "server-only";

/**
 * Single email entry point. Disabled (no-op) unless RESEND_API_KEY is set, so the app never
 * depends on email to work. Uses Resend's REST API directly — no SDK needed.
 */
export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false as const };
  // Never email seed/demo accounts.
  if (to.endsWith(".seed.test")) return { sent: false as const };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Got Next <onboarding@resend.dev>", to, subject, text }),
  });
  if (!res.ok) console.error("sendEmail failed", res.status, await res.text().catch(() => ""));
  return { sent: res.ok };
}
