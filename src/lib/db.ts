import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import type { Brand, Mention, Prompt, Run, User } from "./types";

/**
 * Local JSON-file data store standing in for Supabase/Postgres during MVP
 * dev. Every function here maps 1:1 to a query we'll eventually run against
 * Supabase, so swapping the implementation later doesn't require touching
 * callers — BUT this is a real rewrite, not a config swap:
 *
 * - This only runs under `next dev` / `next start` (real Node.js, real
 *   filesystem). It CANNOT run on Cloudflare Workers: verified by deploying
 *   this app locally via `wrangler dev` — fs.mkdirSync throws
 *   `EPERM: operation not permitted` the moment any write path executes,
 *   because workerd's nodejs_compat shim has no writable filesystem.
 * - The Cloudflare Worker in workers/scheduler/ already talks to Supabase
 *   over REST (see workers/scheduler/src/supabase.ts) and expects
 *   auth.users/profiles rows this store never creates — the two halves of
 *   this project are not wired to the same data today.
 *
 * Production readiness requires: provision a Supabase project, apply
 * supabase/migrations/0001_init.sql, replace this file's functions with
 * @supabase/supabase-js calls, and replace src/lib/auth.ts's cookie scheme
 * with supabase.auth.*. Until then, "deploy to Cloudflare" is not a
 * config change away — it's this rewrite away.
 */

interface DbShape {
  users: User[];
  brands: Brand[];
  prompts: Prompt[];
  runs: Run[];
  mentions: Mention[];
}

const DB_PATH = path.join(process.cwd(), ".data", "db.json");

function emptyDb(): DbShape {
  return { users: [], brands: [], prompts: [], runs: [], mentions: [] };
}

function load(): DbShape {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(emptyDb(), null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as DbShape;
}

function save(db: DbShape) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Every exported method below is synchronous (readFileSync/writeFileSync,
// no `await` in between load() and save()), so within this single Node
// process it can't be preempted mid-call — two concurrent requests calling
// the same or different db methods serialize naturally on Node's event
// loop. This invariant breaks if a method is ever changed to use async fs
// calls, or if a caller inserts an `await` between two db calls that need
// to be read-modify-write atomic (e.g. "check a limit, then create a row")
// — at that point add real locking rather than assuming this still holds.

export const id = () => nanoid(12);

export const db = {
  // --- users ---
  getUserByEmail(email: string): User | undefined {
    return load().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
  getUserById(userId: string): User | undefined {
    return load().users.find((u) => u.id === userId);
  },
  upsertUserByEmail(email: string): User {
    const data = load();
    let user = data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      user = { id: id(), email, plan: "free", createdAt: new Date().toISOString() };
      data.users.push(user);
      save(data);
    }
    return user;
  },

  // --- brands ---
  listBrandsByUser(userId: string): Brand[] {
    return load().brands.filter((b) => b.userId === userId);
  },
  getBrand(brandId: string): Brand | undefined {
    return load().brands.find((b) => b.id === brandId);
  },
  createBrand(input: Omit<Brand, "id" | "createdAt">): Brand {
    const data = load();
    const brand: Brand = { ...input, id: id(), createdAt: new Date().toISOString() };
    data.brands.push(brand);
    save(data);
    return brand;
  },
  deleteBrand(brandId: string) {
    const data = load();
    data.brands = data.brands.filter((b) => b.id !== brandId);
    const promptIds = data.prompts.filter((p) => p.brandId === brandId).map((p) => p.id);
    data.prompts = data.prompts.filter((p) => p.brandId !== brandId);
    const runIds = data.runs.filter((r) => promptIds.includes(r.promptId)).map((r) => r.id);
    data.runs = data.runs.filter((r) => !promptIds.includes(r.promptId));
    data.mentions = data.mentions.filter((m) => !runIds.includes(m.runId));
    save(data);
  },

  // --- prompts ---
  listPromptsByBrand(brandId: string): Prompt[] {
    return load().prompts.filter((p) => p.brandId === brandId);
  },
  getPrompt(promptId: string): Prompt | undefined {
    return load().prompts.find((p) => p.id === promptId);
  },
  createPrompt(input: Omit<Prompt, "id" | "createdAt">): Prompt {
    const data = load();
    const prompt: Prompt = { ...input, id: id(), createdAt: new Date().toISOString() };
    data.prompts.push(prompt);
    save(data);
    return prompt;
  },
  setPromptActive(promptId: string, active: boolean) {
    const data = load();
    const p = data.prompts.find((p) => p.id === promptId);
    if (p) p.active = active;
    save(data);
  },

  // --- runs & mentions ---
  createRun(input: Omit<Run, "id">): Run {
    const data = load();
    const run: Run = { ...input, id: id() };
    data.runs.push(run);
    save(data);
    return run;
  },
  createMentions(inputs: Omit<Mention, "id">[]): Mention[] {
    const data = load();
    const created = inputs.map((m) => ({ ...m, id: id() }));
    data.mentions.push(...created);
    save(data);
    return created;
  },
  listRunsByBrand(brandId: string): Run[] {
    const data = load();
    const promptIds = data.prompts.filter((p) => p.brandId === brandId).map((p) => p.id);
    return data.runs.filter((r) => promptIds.includes(r.promptId));
  },
  listRunsByPrompt(promptId: string): Run[] {
    return load().runs.filter((r) => r.promptId === promptId);
  },
  listMentionsByRunIds(runIds: string[]): Mention[] {
    return load().mentions.filter((m) => runIds.includes(m.runId));
  },
};
