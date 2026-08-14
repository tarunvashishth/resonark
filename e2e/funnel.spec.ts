import { test, expect } from "@playwright/test";
import {
  cookieName,
  deleteBrands,
  ensureUser,
  listBrandIds,
  listPromptIds,
  listRunIds,
  mintSessionCookie,
} from "./supabase-admin";

/**
 * The two [→E2E] flows from the eng-review coverage audit (TODOS.md #3) —
 * full-stack through Server Actions + real Supabase (RLS as the test user),
 * with engine calls served by the mock adapter (webServer blanks
 * GEMINI_API_KEY). Serial: the second flow uses the brand the first creates.
 */

const EMAIL = "e2e-funnel@resonark-test.dev";

test.describe.configure({ mode: "serial" });

let userId: string;

test.beforeAll(async () => {
  userId = await ensureUser(EMAIL);
  await deleteBrands(userId); // clean slate from any aborted previous run
});

test.afterAll(async () => {
  await deleteBrands(userId);
});

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: cookieName(), value: await mintSessionCookie(EMAIL), url: baseURL! }]);
});

test("free-plan onboarding saves only the first 5 of 10 selected prompts", async ({ page }) => {
  await page.goto("/onboarding");
  await page.fill("#name", "E2E QA Brand");
  await page.fill("#domain", "e2e-qa.example.com");
  await page.fill("#category", "project management software");
  await page.getByLabel("Competitor 1").fill("Asana");
  await page.getByRole("button", { name: /Suggest prompts/ }).click();

  // All 10 suggestions arrive pre-selected; the plan cap is enforced server-side.
  await expect(page.getByText("10 selected · your plan allows up to 5")).toBeVisible();
  await page.getByRole("button", { name: "Start tracking" }).click();
  await page.waitForURL("**/dashboard");

  const brandIds = await listBrandIds(userId);
  expect(brandIds).toHaveLength(1);
  expect(await listPromptIds(brandIds[0])).toHaveLength(5);
});

test("double-clicking Run now produces exactly one batch of runs", async ({ page }) => {
  await page.goto("/dashboard");

  // Empty state renders two Run now buttons (header + card) — clicking both
  // in quick succession races two Server Action calls against the
  // brandsRunningNow lock and the cooldown check.
  const buttons = page.getByRole("button", { name: "Run now" });
  await expect(buttons).toHaveCount(2);
  await Promise.all([buttons.nth(0).click(), buttons.nth(1).click()]);

  // One call wins and reports success; free plan = 5 prompts × 1 engine.
  await expect(page.getByText("Ran 5 queries across AI engines.")).toBeVisible({ timeout: 30_000 });

  const [brandId] = await listBrandIds(userId);
  const promptIds = await listPromptIds(brandId);
  await expect.poll(async () => (await listRunIds(promptIds)).length, { timeout: 15_000 }).toBe(5);

  // Give a hypothetical second batch time to land before asserting it didn't.
  await page.waitForTimeout(2_000);
  expect(await listRunIds(promptIds)).toHaveLength(5);

  // The dashboard now shows the data state built from those runs.
  await page.reload();
  await expect(page.getByText("Total runs")).toBeVisible();
  await expect(page.getByText("Tracked prompts")).toBeVisible();
});
