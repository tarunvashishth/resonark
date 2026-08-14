import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ update: updateMock }) }),
}));

import { POST } from "./route";

const SECRET = "whsec_test_secret";

async function sign(payload: string, t = Math.floor(Date.now() / 1000)): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const v1 = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${t},v1=${v1}`;
}

function request(payload: string, signature?: string): Request {
  return new Request("https://example.com/api/stripe/webhook", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : {},
    body: payload,
  });
}

describe("Stripe webhook", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    updateMock.mockClear();
  });

  it("503s when the webhook secret is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await POST(request("{}"))).status).toBe(503);
  });

  it("400s without a signature header", async () => {
    expect((await POST(request("{}"))).status).toBe(400);
  });

  it("400s on a tampered payload", async () => {
    const signature = await sign(JSON.stringify({ type: "checkout.session.completed", data: { object: {} } }));
    const res = await POST(request(JSON.stringify({ type: "evil", data: { object: {} } }), signature));
    expect(res.status).toBe(400);
  });

  it("400s on a stale timestamp (replay)", async () => {
    const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: {} } });
    const stale = Math.floor(Date.now() / 1000) - 3600;
    expect((await POST(request(payload, await sign(payload, stale)))).status).toBe(400);
  });

  it("upgrades the profile on checkout.session.completed", async () => {
    const payload = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { client_reference_id: "user-1", customer: "cus_1", subscription: "sub_1" } },
    });
    const res = await POST(request(payload, await sign(payload)));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      plan: "pro",
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
    });
  });

  it("downgrades on customer.subscription.deleted", async () => {
    const payload = JSON.stringify({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", status: "canceled" } },
    });
    const res = await POST(request(payload, await sign(payload)));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ plan: "free" });
  });

  it("acks unknown event types without touching the db", async () => {
    const payload = JSON.stringify({ type: "invoice.paid", data: { object: {} } });
    expect((await POST(request(payload, await sign(payload)))).status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
