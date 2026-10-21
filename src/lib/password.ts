import { z } from "zod";

/** The one password rule (sign-up, reset, change). Supabase is configured to match (scripts/configure-supabase.ts). */
export const newPassword = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Passwords can be at most 72 characters.")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Use at least one letter and one number.");
