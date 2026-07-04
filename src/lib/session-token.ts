import crypto from "node:crypto";

/**
 * Pure HMAC sign/verify for session cookies, split out of auth.ts so it can
 * be unit tested without pulling in next/headers (which needs a live
 * request context and can't run under a plain test runner).
 */

// Checked lazily (not at module load) so `next build`'s static page-data
// collection — which also runs with NODE_ENV=production — doesn't trip this.
// It fires the first time a session is actually signed or verified at
// request time, which is what matters for the forgeable-cookie risk.
export function getSecret(): string {
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is not set. Refusing to sign/verify sessions in production with the dev fallback secret — sessions would be forgeable by anyone who reads the source."
    );
  }
  return process.env.SESSION_SECRET ?? "dev-only-secret-change-me";
}

export function sign(userId: string): string {
  const hmac = crypto.createHmac("sha256", getSecret()).update(userId).digest("hex");
  return `${userId}.${hmac}`;
}

export function verify(token: string): string | null {
  const [userId, hmac] = token.split(".");
  if (!userId || !hmac) return null;
  const expected = crypto.createHmac("sha256", getSecret()).update(userId).digest("hex");
  return hmac === expected ? userId : null;
}
