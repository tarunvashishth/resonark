"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { suggestPrompts, type SuggestedPrompt } from "@/lib/suggest";
import { PLAN_LIMITS } from "@/lib/types";

export async function fetchSuggestions(category: string): Promise<SuggestedPrompt[]> {
  const trimmed = category.trim();
  if (!trimmed) return [];
  return suggestPrompts(trimmed, 10);
}

const brandSchema = z.object({
  name: z.string().min(1).max(80),
  domain: z.string().min(3).max(200),
  category: z.string().min(2).max(120),
  competitors: z.array(z.string().min(1)).max(3),
  prompts: z.array(z.object({ text: z.string().min(1), intentCategory: z.string() })).min(1),
});

// In-memory per-user lock: closes the same TOCTOU window flagged in
// TODOS.md #11 — two concurrent createBrandWithPrompts calls for the same
// user could otherwise both read "under the limit" before either writes a
// brand. Same pattern as brand.ts's runNowAction lock.
const usersCreatingBrand = new Set<string>();

export async function createBrandWithPrompts(input: z.infer<typeof brandSchema>) {
  const user = await getSession();
  if (!user) redirect("/login");

  if (usersCreatingBrand.has(user.id)) {
    throw new Error("Already creating a brand — please wait a moment.");
  }
  usersCreatingBrand.add(user.id);

  try {
    const existing = await db.listBrandsByUser(user.id);
    const limit = PLAN_LIMITS[user.plan];
    if (existing.length >= limit.maxBrands) {
      throw new Error(`Your ${user.plan} plan allows ${limit.maxBrands} brand(s). Upgrade to add more.`);
    }

    const parsed = brandSchema.parse(input);
    const brand = await db.createBrand({
      userId: user.id,
      name: parsed.name,
      domain: parsed.domain,
      category: parsed.category,
      competitors: parsed.competitors,
    });

    for (const p of parsed.prompts.slice(0, limit.maxPrompts)) {
      await db.createPrompt({ brandId: brand.id, text: p.text, intentCategory: p.intentCategory, active: true });
    }
  } finally {
    usersCreatingBrand.delete(user.id);
  }

  redirect("/dashboard");
}
