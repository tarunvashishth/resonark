import { createClient } from "./supabase/server";
import type { Brand, Mention, Prompt, Run } from "./types";

/**
 * Supabase-backed persistence (see supabase/migrations/0001_init.sql for the
 * schema). Replaces the local-JSON-file MVP store — every function here is
 * now async and goes through RLS as the calling user's session, so ownership
 * is enforced at the database layer, not just in the Server Action.
 *
 * User rows are no longer created here: Supabase Auth creates auth.users on
 * signup, and the `handle_new_user` trigger mirrors it into `profiles`. See
 * src/lib/auth.ts for session/profile reads.
 */

interface BrandRow {
  id: string;
  user_id: string;
  name: string;
  domain: string;
  category: string;
  competitors: string[];
  created_at: string;
}

function toBrand(row: BrandRow): Brand {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    domain: row.domain,
    category: row.category,
    competitors: row.competitors,
    createdAt: row.created_at,
  };
}

interface PromptRow {
  id: string;
  brand_id: string;
  text: string;
  intent_category: string;
  active: boolean;
  created_at: string;
}

function toPrompt(row: PromptRow): Prompt {
  return {
    id: row.id,
    brandId: row.brand_id,
    text: row.text,
    intentCategory: row.intent_category,
    active: row.active,
    createdAt: row.created_at,
  };
}

interface RunRow {
  id: string;
  prompt_id: string;
  engine: Run["engine"];
  ran_at: string;
  response_text: string;
  cited_urls: string[];
  status: Run["status"];
}

function toRun(row: RunRow): Run {
  return {
    id: row.id,
    promptId: row.prompt_id,
    engine: row.engine,
    ranAt: row.ran_at,
    responseText: row.response_text,
    citedUrls: row.cited_urls,
    status: row.status,
  };
}

interface MentionRow {
  id: string;
  run_id: string;
  entity_name: string;
  is_own_brand: boolean;
  mentioned: boolean;
  rank: number | null;
  sentiment: Mention["sentiment"];
}

function toMention(row: MentionRow): Mention {
  return {
    id: row.id,
    runId: row.run_id,
    entityName: row.entity_name,
    isOwnBrand: row.is_own_brand,
    mentioned: row.mentioned,
    rank: row.rank,
    sentiment: row.sentiment,
  };
}

export const db = {
  // --- brands ---
  async listBrandsByUser(userId: string): Promise<Brand[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("brands").select("*").eq("user_id", userId);
    if (error) throw error;
    return (data as BrandRow[]).map(toBrand);
  },
  async getBrand(brandId: string): Promise<Brand | undefined> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("brands").select("*").eq("id", brandId).maybeSingle();
    if (error) throw error;
    return data ? toBrand(data as BrandRow) : undefined;
  },
  async createBrand(input: Omit<Brand, "id" | "createdAt">): Promise<Brand> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("brands")
      .insert({
        user_id: input.userId,
        name: input.name,
        domain: input.domain,
        category: input.category,
        competitors: input.competitors,
      })
      .select()
      .single();
    if (error) throw error;
    return toBrand(data as BrandRow);
  },
  async updateBrand(
    brandId: string,
    fields: Pick<Brand, "name" | "domain" | "category" | "competitors">
  ): Promise<Brand> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("brands")
      .update({
        name: fields.name,
        domain: fields.domain,
        category: fields.category,
        competitors: fields.competitors,
      })
      .eq("id", brandId)
      .select()
      .single();
    if (error) throw error;
    return toBrand(data as BrandRow);
  },
  async deleteBrand(brandId: string): Promise<void> {
    const supabase = await createClient();
    // prompts/runs/mentions cascade via foreign keys (on delete cascade in the schema).
    const { error } = await supabase.from("brands").delete().eq("id", brandId);
    if (error) throw error;
  },

  // --- prompts ---
  async listPromptsByBrand(brandId: string): Promise<Prompt[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("prompts").select("*").eq("brand_id", brandId);
    if (error) throw error;
    return (data as PromptRow[]).map(toPrompt);
  },
  async getPrompt(promptId: string): Promise<Prompt | undefined> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("prompts").select("*").eq("id", promptId).maybeSingle();
    if (error) throw error;
    return data ? toPrompt(data as PromptRow) : undefined;
  },
  async createPrompt(input: Omit<Prompt, "id" | "createdAt">): Promise<Prompt> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prompts")
      .insert({
        brand_id: input.brandId,
        text: input.text,
        intent_category: input.intentCategory,
        active: input.active,
      })
      .select()
      .single();
    if (error) throw error;
    return toPrompt(data as PromptRow);
  },
  async setPromptActive(promptId: string, active: boolean): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from("prompts").update({ active }).eq("id", promptId);
    if (error) throw error;
  },

  // --- runs & mentions ---
  async createRun(input: Omit<Run, "id">): Promise<Run> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("runs")
      .insert({
        prompt_id: input.promptId,
        engine: input.engine,
        ran_at: input.ranAt,
        response_text: input.responseText,
        cited_urls: input.citedUrls,
        status: input.status,
      })
      .select()
      .single();
    if (error) throw error;
    return toRun(data as RunRow);
  },
  async createMentions(inputs: Omit<Mention, "id">[]): Promise<Mention[]> {
    if (inputs.length === 0) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mentions")
      .insert(
        inputs.map((m) => ({
          run_id: m.runId,
          entity_name: m.entityName,
          is_own_brand: m.isOwnBrand,
          mentioned: m.mentioned,
          rank: m.rank,
          sentiment: m.sentiment,
        }))
      )
      .select();
    if (error) throw error;
    return (data as MentionRow[]).map(toMention);
  },
  async listRunsByBrand(brandId: string): Promise<Run[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("runs")
      .select("*, prompts!inner(brand_id)")
      .eq("prompts.brand_id", brandId);
    if (error) throw error;
    return (data as RunRow[]).map(toRun);
  },
  async listRunsByPrompt(promptId: string): Promise<Run[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("runs").select("*").eq("prompt_id", promptId);
    if (error) throw error;
    return (data as RunRow[]).map(toRun);
  },
  async listMentionsByRunIds(runIds: string[]): Promise<Mention[]> {
    if (runIds.length === 0) return [];
    const supabase = await createClient();
    const { data, error } = await supabase.from("mentions").select("*").in("run_id", runIds);
    if (error) throw error;
    return (data as MentionRow[]).map(toMention);
  },
};
