import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Brand, User } from "@/lib/types";

const state: { brands: Brand[] } = { brands: [] };

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

const signInWithEmailMock = vi.fn();
const signOutMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  signInWithEmail: (...args: unknown[]) => signInWithEmailMock(...args),
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    listBrandsByUser: (userId: string) => state.brands.filter((b) => b.userId === userId),
  },
}));

const { devSignIn, signOutAction } = await import("./auth");

function makeUser(overrides: Partial<User> = {}): User {
  return { id: "u1", email: "test@example.com", plan: "free", createdAt: "", ...overrides };
}

function formDataWith(email: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
  return fd;
}

beforeEach(() => {
  state.brands = [];
  redirectMock.mockClear();
  signInWithEmailMock.mockReset();
  signOutMock.mockReset();
});

describe("devSignIn", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalAllow = process.env.ALLOW_DEV_SIGNIN;

  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalEnv ?? "test");
    if (originalAllow === undefined) delete process.env.ALLOW_DEV_SIGNIN;
    else process.env.ALLOW_DEV_SIGNIN = originalAllow;
  });

  it("rejects an invalid email without calling signInWithEmail", async () => {
    await expect(devSignIn(formDataWith("not-an-email"))).rejects.toThrow();
    expect(signInWithEmailMock).not.toHaveBeenCalled();
  });

  it("refuses to run in production without the escape hatch", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.ALLOW_DEV_SIGNIN;
    await expect(devSignIn(formDataWith("test@example.com"))).rejects.toThrow(/disabled in production/);
    expect(signInWithEmailMock).not.toHaveBeenCalled();
  });

  it("refuses to run when ALLOW_DEV_SIGNIN is set to a falsy-looking string like 'false' (truthy-string footgun)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.ALLOW_DEV_SIGNIN = "false";
    await expect(devSignIn(formDataWith("test@example.com"))).rejects.toThrow(/disabled in production/);
    expect(signInWithEmailMock).not.toHaveBeenCalled();
  });

  it("allows devSignIn in production when ALLOW_DEV_SIGNIN is explicitly set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.ALLOW_DEV_SIGNIN = "true";
    signInWithEmailMock.mockResolvedValue(makeUser({ id: "u1" }));
    state.brands = [];
    await expect(devSignIn(formDataWith("test@example.com"))).rejects.toThrow("REDIRECT:/onboarding");
  });

  it("redirects to /onboarding when the signed-in user has no brands yet", async () => {
    signInWithEmailMock.mockResolvedValue(makeUser({ id: "u1" }));
    state.brands = [];
    await expect(devSignIn(formDataWith("test@example.com"))).rejects.toThrow("REDIRECT:/onboarding");
    expect(redirectMock).toHaveBeenCalledWith("/onboarding");
  });

  it("redirects to /dashboard when the signed-in user already has a brand", async () => {
    signInWithEmailMock.mockResolvedValue(makeUser({ id: "u1" }));
    state.brands = [{ id: "b1", userId: "u1", name: "Acme", domain: "acme.com", category: "x", competitors: [], createdAt: "" }];
    await expect(devSignIn(formDataWith("test@example.com"))).rejects.toThrow("REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });
});

describe("signOutAction", () => {
  it("signs out and redirects to /", async () => {
    await expect(signOutAction()).rejects.toThrow("REDIRECT:/");
    expect(signOutMock).toHaveBeenCalled();
  });
});
