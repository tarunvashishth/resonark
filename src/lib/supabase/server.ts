import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client for Server Components/Actions — reads and
 * writes the auth session cookie via next/headers. Uses the anon key, so
 * every query goes through RLS as the logged-in user (see
 * supabase/migrations/0001_init.sql's policies).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render (not an Action/Route Handler) —
          // proxy.ts refreshes the session cookie instead, so this is safe to ignore.
        }
      },
    },
  });
}
