import { cookies } from "next/headers";
import { db } from "./db";
import { sign, verify } from "./session-token";
import type { User } from "./types";

/**
 * Cookie-based session standing in for Supabase Auth magic-link sessions.
 * Same shape (email in, User out) so swapping to `supabase.auth.*` later
 * only touches this file, not callers.
 */

const SESSION_COOKIE = "echorank_session";

export async function signInWithEmail(email: string): Promise<User> {
  const user = db.upsertUserByEmail(email);
  const store = await cookies();
  store.set(SESSION_COOKIE, sign(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return user;
}

export async function signOut() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verify(token);
  if (!userId) return null;
  return db.getUserById(userId) ?? null;
}
