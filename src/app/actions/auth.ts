"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sendEmailCode, verifyEmailCode, signOut } from "@/lib/auth";
import { db } from "@/lib/db";

const emailSchema = z.string().email();
const codeSchema = z.string().min(6).max(8);

/** Sends a 6-digit sign-in code to the given email. */
export async function sendEmailCodeAction(formData: FormData) {
  const email = emailSchema.parse(formData.get("email"));
  await sendEmailCode(email);
}

/** Verifies the code and, on success, redirects based on whether the user already has a brand. */
export async function verifyEmailCodeAction(formData: FormData) {
  const email = emailSchema.parse(formData.get("email"));
  const code = codeSchema.parse(formData.get("code"));
  await verifyEmailCode(email, code);

  const { getSession } = await import("@/lib/auth");
  const user = await getSession();
  const brands = user ? await db.listBrandsByUser(user.id) : [];
  redirect(brands.length ? "/dashboard" : "/onboarding");
}

export async function signOutAction() {
  await signOut();
  redirect("/");
}
