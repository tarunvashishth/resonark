import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLAN_LIMITS } from "@/lib/types";
import { OnboardingWizard } from "./wizard";

export default async function OnboardingPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const brands = await db.listBrandsByUser(user.id);
  if (brands.length >= PLAN_LIMITS[user.plan].maxBrands) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16">
      <OnboardingWizard maxPrompts={PLAN_LIMITS[user.plan].maxPrompts} />
    </main>
  );
}
