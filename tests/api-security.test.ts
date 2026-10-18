/**
 * The anon key ships to every browser. These tests act as an attacker holding it (plus their own
 * session) and talking to Supabase's REST API directly — bypassing the app. Every write and every
 * cross-user read must fail; only the Realtime tables may be read, and only your own rows.
 * Uses a throwaway account that is deleted afterwards. Skipped without Supabase credentials.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

let attacker: SupabaseClient;
let admin: SupabaseClient;
let userId = "";
const email = `probe-${randomUUID().slice(0, 8)}@coep.seed.test`;
const password = `Probe-${randomUUID()}`;

beforeAll(async () => {
  if (!enabled) return;
  admin = createClient(url!, service!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
  attacker = createClient(url!, anon!, { auth: { persistSession: false } });
  const { error: e2 } = await attacker.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
});

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

const denied = (r: { error: { code?: string } | null; data: unknown }) =>
  Boolean(r.error) || (Array.isArray(r.data) && r.data.length === 0);

describe.skipIf(!enabled)("Supabase REST API is locked down", () => {
  it("anonymous visitors can't read any app table", async () => {
    const pub = createClient(url!, anon!, { auth: { persistSession: false } });
    for (const table of ["profiles", "events", "registrations", "teams", "applications", "notifications"]) {
      const r = await pub.from(table).select("*").limit(1);
      expect(denied(r), table).toBe(true);
    }
  });

  it("a signed-in user can't escalate privileges or tamper with data", async () => {
    expect(denied(await attacker.from("profiles").update({ is_admin: true }).eq("id", userId).select())).toBe(true);
    expect(denied(await attacker.from("profiles").update({ reliability_score: "100" }).eq("id", userId).select())).toBe(true);
    expect(denied(await attacker.from("user_skills").update({ endorsed_count: 99 }).eq("user_id", userId).select())).toBe(true);
    expect(denied(await attacker.from("events").update({ is_featured: true }).neq("title", "").select())).toBe(true);
    expect(
      denied(await attacker.from("notifications").insert({ user_id: userId, type: "announcement", payload: { title: "x" } }).select()),
    ).toBe(true);
    expect(denied(await attacker.from("messages").insert({ team_id: randomUUID(), sender_id: userId, body: "x" }).select())).toBe(true);
  });

  it("a signed-in user can't read other people's data", async () => {
    expect(denied(await attacker.from("profiles").select("email").limit(5))).toBe(true);
    expect(denied(await attacker.from("registrations").select("id").limit(5))).toBe(true);
    const others = await attacker.from("notifications").select("id").neq("user_id", userId).limit(5);
    expect(others.error).toBeNull();
    expect(others.data).toEqual([]);
  });

  it("verification data and other people's conversations stay private", async () => {
    expect(denied(await attacker.from("verification_requests").select("*").limit(5))).toBe(true);
    expect(denied(await attacker.from("vouches").select("*").limit(5))).toBe(true);
    // Vouching or self-verifying through the API is impossible.
    expect(denied(await attacker.from("vouches").insert({ voucher_id: userId, user_id: randomUUID(), college_id: randomUUID() }).select())).toBe(true);
    expect(denied(await attacker.from("profiles").update({ college_verified: true, college_verified_via: "id_card" }).eq("id", userId).select())).toBe(true);
    // Conversations: readable for Realtime, but only the two parties' rows (none here).
    const threads = await attacker.from("application_messages").select("id").limit(5);
    expect(threads.error).toBeNull();
    expect(threads.data).toEqual([]);
    expect(
      denied(await attacker.from("application_messages").insert({ application_id: randomUUID(), sender_id: userId, body: "x" }).select()),
    ).toBe(true);
    // ID card photos: no listing or reading through Storage.
    const files = await attacker.storage.from("id-cards").list("", { limit: 5 });
    expect(files.data ?? []).toEqual([]);
  });

  it("Realtime tables stay readable for your own rows", async () => {
    expect((await attacker.from("notifications").select("id").eq("user_id", userId)).error).toBeNull();
    expect((await attacker.from("applications").select("id").eq("applicant_id", userId)).error).toBeNull();
  });
});
