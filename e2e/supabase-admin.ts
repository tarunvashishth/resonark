import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Test-side Supabase access: mints real sessions through the admin API and
 * asserts/cleans DB state with the service-role key. Credentials come from
 * the environment, falling back to the repo's local env files (.env.local
 * for URL + anon key, workers/scheduler/.dev.vars for the service role key —
 * the service key must never live in .env.local, which gets bundled into
 * the app worker).
 */

function parseEnvFile(file: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(file, "utf8")
        .split("\n")
        .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
        .filter((m): m is RegExpMatchArray => Boolean(m))
        .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")])
    );
  } catch {
    return {};
  }
}

const fileEnv = {
  ...parseEnvFile(path.join(__dirname, "..", ".env.local")),
  ...parseEnvFile(path.join(__dirname, "..", "workers", "scheduler", ".dev.vars")),
};

function env(name: string): string {
  const v = process.env[name] ?? fileEnv[name];
  if (!v) throw new Error(`e2e: missing ${name} (set it or provide it via .env.local / workers/scheduler/.dev.vars)`);
  return v;
}

const url = () => env("SUPABASE_URL");
const serviceHeaders = () => ({
  apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
  Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`,
  "Content-Type": "application/json",
});

async function rest<T>(pathAndQuery: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${url()}/rest/v1/${pathAndQuery}`, { ...init, headers: serviceHeaders() });
  if (!res.ok) throw new Error(`e2e rest ${pathAndQuery}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

/** Creates the user if needed; returns its id. */
export async function ensureUser(email: string): Promise<string> {
  const created = await fetch(`${url()}/auth/v1/admin/users`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ email, email_confirm: true }),
  });
  if (created.ok) return ((await created.json()) as { id: string }).id;
  // Already registered — the handle_new_user trigger mirrors id into profiles.
  const profiles = await rest<{ id: string }[]>(`profiles?select=id&email=eq.${encodeURIComponent(email)}`);
  if (profiles.length === 0) throw new Error(`e2e: could not create or find user ${email}: ${await created.text()}`);
  return profiles[0].id;
}

export function cookieName(): string {
  const ref = new URL(url()).hostname.split(".")[0];
  return `sb-${ref}-auth-token`;
}

/** Real session via admin generate_link → verify, encoded the way @supabase/ssr stores it. */
export async function mintSessionCookie(email: string): Promise<string> {
  const linkRes = await fetch(`${url()}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ type: "magiclink", email }),
  });
  if (!linkRes.ok) throw new Error(`e2e generate_link: ${linkRes.status} ${await linkRes.text()}`);
  const { hashed_token } = (await linkRes.json()) as { hashed_token: string };

  const verifyRes = await fetch(`${url()}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: env("SUPABASE_ANON_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: hashed_token }),
  });
  if (!verifyRes.ok) throw new Error(`e2e verify: ${verifyRes.status} ${await verifyRes.text()}`);
  const s = (await verifyRes.json()) as Record<string, unknown>;

  const session = {
    access_token: s.access_token,
    token_type: "bearer",
    expires_in: s.expires_in ?? 3600,
    expires_at: s.expires_at,
    refresh_token: s.refresh_token,
    user: s.user,
  };
  return "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
}

export const listBrandIds = async (userId: string) =>
  (await rest<{ id: string }[]>(`brands?select=id&user_id=eq.${userId}`)).map((r) => r.id);

export const listPromptIds = async (brandId: string) =>
  (await rest<{ id: string }[]>(`prompts?select=id&brand_id=eq.${brandId}`)).map((r) => r.id);

export const listRunIds = async (promptIds: string[]) =>
  promptIds.length === 0
    ? []
    : (await rest<{ id: string }[]>(`runs?select=id&prompt_id=in.(${promptIds.join(",")})`)).map((r) => r.id);

/** Prompts/runs/mentions cascade via FK. */
export async function deleteBrands(userId: string): Promise<void> {
  await rest(`brands?user_id=eq.${userId}`, { method: "DELETE" });
}
