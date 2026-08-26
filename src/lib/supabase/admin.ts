import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key — bypasses RLS.
 * Never import this from client components or anywhere that could end up
 * in a browser bundle. Used by the Stripe webhook to write profiles.plan
 * regardless of the RLS policies that scope normal user access.
 */
export function createAdminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
