import { createClient } from "./supabase/server";
import type { User } from "./types";

/**
 * Real Supabase Auth (email OTP code) — replaces the local-JSON MVP's fake
 * email-only sign-in. Uses a 6-digit code instead of a magic link: the code
 * is verified in the SAME request that submits it (sendEmailCode → user
 * types the code → verifyEmailCode), so there's no cross-request PKCE
 * code-verifier cookie to keep alive between two separate requests — the
 * failure mode that made the magic-link version unreliable to verify.
 */

export async function sendEmailCode(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, code: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) throw error;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function getSession(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", authUser.id).single();
  if (!profile) return null;

  return { id: profile.id, email: profile.email, plan: profile.plan, createdAt: profile.created_at };
}
