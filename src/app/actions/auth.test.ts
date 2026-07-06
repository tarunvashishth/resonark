import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Brand, User } from "@/lib/types";

const state: { brands: Brand[] } = { brands: [] };

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

const sendEmailCodeMock = vi.fn();
const verifyEmailCodeMock = vi.fn();
const signOutMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  sendEmailCode: (...args: unknown[]) => sendEmailCodeMock(...args),
  verifyEmailCode: (...args: unknown[]) => verifyEmailCodeMock(...args),
  signOut: (...args: unknown[]) => signOutMock(...args),
  getSession: (...args: unknown[]) => getSessionMock(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    listBrandsByUser: (userId: string) => state.brands.filter((b) => b.userId === userId),
  },
}));

const { sendEmailCodeAction, verifyEmailCodeAction, signOutAction } = await import("./auth");

function makeUser(overrides: Partial<User> = {}): User {
  return { id: "u1", email: "test@example.com", plan: "free", createdAt: "", ...overrides };
}

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  state.brands = [];
  redirectMock.mockClear();
  sendEmailCodeMock.mockReset();
  verifyEmailCodeMock.mockReset();
  signOutMock.mockReset();
  getSessionMock.mockReset();
});

describe("sendEmailCodeAction", () => {
  it("rejects an invalid email without calling sendEmailCode", async () => {
    await expect(sendEmailCodeAction(formDataWith({ email: "not-an-email" }))).rejects.toThrow();
    expect(sendEmailCodeMock).not.toHaveBeenCalled();
  });

  it("sends a code to the given email", async () => {
    await sendEmailCodeAction(formDataWith({ email: "test@example.com" }));
    expect(sendEmailCodeMock).toHaveBeenCalledWith("test@example.com");
  });
});

describe("verifyEmailCodeAction", () => {
  it("rejects a too-short code without calling verifyEmailCode", async () => {
    await expect(
      verifyEmailCodeAction(formDataWith({ email: "test@example.com", code: "123" }))
    ).rejects.toThrow();
    expect(verifyEmailCodeMock).not.toHaveBeenCalled();
  });

  it("redirects to /onboarding when the verified user has no brands yet", async () => {
    verifyEmailCodeMock.mockResolvedValue(undefined);
    getSessionMock.mockResolvedValue(makeUser({ id: "u1" }));
    state.brands = [];
    await expect(
      verifyEmailCodeAction(formDataWith({ email: "test@example.com", code: "123456" }))
    ).rejects.toThrow("REDIRECT:/onboarding");
    expect(verifyEmailCodeMock).toHaveBeenCalledWith("test@example.com", "123456");
  });

  it("redirects to /dashboard when the verified user already has a brand", async () => {
    verifyEmailCodeMock.mockResolvedValue(undefined);
    getSessionMock.mockResolvedValue(makeUser({ id: "u1" }));
    state.brands = [{ id: "b1", userId: "u1", name: "Acme", domain: "acme.com", category: "x", competitors: [], createdAt: "" }];
    await expect(
      verifyEmailCodeAction(formDataWith({ email: "test@example.com", code: "123456" }))
    ).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("propagates a wrong-code error without redirecting", async () => {
    verifyEmailCodeMock.mockRejectedValue(new Error("Token has expired or is invalid"));
    await expect(
      verifyEmailCodeAction(formDataWith({ email: "test@example.com", code: "000000" }))
    ).rejects.toThrow("Token has expired or is invalid");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("signOutAction", () => {
  it("signs out and redirects to /", async () => {
    await expect(signOutAction()).rejects.toThrow("REDIRECT:/");
    expect(signOutMock).toHaveBeenCalled();
  });
});
