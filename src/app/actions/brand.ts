"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { runBrandNow } from "@/lib/runner";

async function requireOwnedBrand(brandId: string) {
  const user = await getSession();
  if (!user) redirect("/login");
  const brand = db.getBrand(brandId);
  if (!brand || brand.userId !== user.id) throw new Error("Not found");
  return { user, brand };
}

const RUN_NOW_COOLDOWN_MS = 60_000;

// In-memory per-brand lock: closes the TOCTOU window between the cooldown
// check and runBrandNow's first `await` (two concurrent requests — double
// click, two tabs — would otherwise both read "no recent run" before either
// writes one). Correct because Node's single-threaded event loop never
// interleaves the synchronous check-and-set below. Only guards a single
// process — fine today since there's exactly one app instance until the
// Supabase migration (TODOS.md #1) enables horizontal scaling.
const brandsRunningNow = new Set<string>();

export async function runNowAction(brandId: string) {
  const { user, brand } = await requireOwnedBrand(brandId);

  if (brandsRunningNow.has(brandId)) {
    throw new Error("Please wait a moment before running another check.");
  }
  const lastRun = db
    .listRunsByBrand(brandId)
    .sort((a, b) => b.ranAt.localeCompare(a.ranAt))[0];
  if (lastRun && Date.now() - new Date(lastRun.ranAt).getTime() < RUN_NOW_COOLDOWN_MS) {
    throw new Error("Please wait a moment before running another check.");
  }

  brandsRunningNow.add(brandId);
  try {
    const count = await runBrandNow(brand, user.plan);
    revalidatePath("/dashboard");
    return count;
  } finally {
    brandsRunningNow.delete(brandId);
  }
}

export async function togglePromptAction(promptId: string, active: boolean) {
  const user = await getSession();
  if (!user) redirect("/login");
  const prompt = db.getPrompt(promptId);
  if (!prompt) throw new Error("Not found");
  const brand = db.getBrand(prompt.brandId);
  if (!brand || brand.userId !== user.id) throw new Error("Not found");
  db.setPromptActive(promptId, active);
  revalidatePath("/dashboard");
}
