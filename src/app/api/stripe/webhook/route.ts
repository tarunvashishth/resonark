import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe webhook — sole writer of profiles.plan for billing changes.
 * Subscribed events (configured on the Stripe webhook endpoint):
 *  - checkout.session.completed        → plan=pro (user id from client_reference_id)
 *  - customer.subscription.updated     → pro while active/trialing, else free
 *  - customer.subscription.deleted     → plan=free
 */

const encoder = new TextEncoder();

/** Verifies Stripe-Signature (t=...,v1=...) per Stripe's scheme: v1 = HMAC-SHA256(secret, `${t}.${payload}`). */
async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = new Map(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1) return false;
  // Reject stale events (replay protection), 5 min tolerance like stripe-node.
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;

  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("webhook not configured", { status: 503 });

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature || !(await verifySignature(payload, signature, secret))) {
    return new Response("invalid signature", { status: 400 });
  }

  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
  const obj = event.data.object;
  const db = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      // client_reference_id is the Supabase user id, passed on the payment link URL.
      const userId = obj.client_reference_id as string | null;
      if (!userId) break;
      const { error } = await db
        .from("profiles")
        .update({
          plan: "pro",
          stripe_customer_id: (obj.customer as string) ?? null,
          stripe_subscription_id: (obj.subscription as string) ?? null,
        })
        .eq("id", userId);
      if (error) return new Response(`profile update failed: ${error.message}`, { status: 500 });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscriptionId = obj.id as string;
      const status = obj.status as string;
      const active = event.type !== "customer.subscription.deleted" && (status === "active" || status === "trialing");
      const { error } = await db
        .from("profiles")
        .update({ plan: active ? "pro" : "free" })
        .eq("stripe_subscription_id", subscriptionId);
      if (error) return new Response(`profile update failed: ${error.message}`, { status: 500 });
      break;
    }
  }

  return new Response("ok", { status: 200 });
}
