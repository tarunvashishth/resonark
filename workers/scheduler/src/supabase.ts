export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  RESEND_API_KEY?: string;
}

/** Minimal PostgREST client using the service role key, which bypasses RLS. */
export function supabase(env: Env) {
  const base = `${env.SUPABASE_URL}/rest/v1`;
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  return {
    async select<T>(table: string, query: string): Promise<T[]> {
      const res = await fetch(`${base}/${table}?${query}`, { headers });
      if (!res.ok) throw new Error(`Supabase select ${table}: ${res.status} ${await res.text()}`);
      return res.json();
    },
    async insert<T>(table: string, rows: unknown[]): Promise<T[]> {
      const res = await fetch(`${base}/${table}`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(rows),
      });
      if (!res.ok) throw new Error(`Supabase insert ${table}: ${res.status} ${await res.text()}`);
      return res.json();
    },
  };
}
