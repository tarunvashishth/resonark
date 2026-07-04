"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signInWithEmail, signOut } from "@/lib/auth";
import { db } from "@/lib/db";

const emailSchema = z.string().email();

export async function devSignIn(formData: FormData) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_SIGNIN !== "true") {
    throw new Error(
      "devSignIn is disabled in production — it authenticates as any email with zero verification. Implement real magic-link/OTP auth before enabling ALLOW_DEV_SIGNIN."
    );
  }
  const email = emailSchema.parse(formData.get("email"));
  const user = await signInWithEmail(email);

  const brands = db.listBrandsByUser(user.id);
  redirect(brands.length ? "/dashboard" : "/onboarding");
}

export async function signOutAction() {
  await signOut();
  redirect("/");
}
