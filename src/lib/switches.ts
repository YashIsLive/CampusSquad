/**
 * Emergency switches (see docs/INCIDENT_RESPONSE.md). Set in Vercel → Settings → Environment
 * Variables, then redeploy (about a minute).
 *
 * MAINTENANCE_MODE=1  The whole site shows a "back soon" page (503). Health checks keep working.
 * SIGNUPS_PAUSED=1    Nobody new can sign up; existing users sign in as normal. Pair it with
 *                     `npm run supabase:configure -- --pause-signups` to stop sign-ups through
 *                     Google and Supabase's own API too.
 */
export const maintenanceMode = () => process.env.MAINTENANCE_MODE === "1";
export const signupsPaused = () => process.env.SIGNUPS_PAUSED === "1";

export const SIGNUPS_PAUSED_MESSAGE = "New sign-ups are paused for a little while. If you already have an account, sign in as usual.";
