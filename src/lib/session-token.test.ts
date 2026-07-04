import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sign, verify } from "./session-token";

describe("session-token", () => {
  beforeEach(() => {
    delete process.env.SESSION_SECRET;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a signed token back to the same user id", () => {
    const token = sign("user-123");
    expect(verify(token)).toBe("user-123");
  });

  it("rejects a tampered user id", () => {
    const token = sign("user-123");
    const [, hmac] = token.split(".");
    const tampered = `attacker-id.${hmac}`;
    expect(verify(tampered)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = sign("user-123");
    const tampered = token.slice(0, -1) + (token.at(-1) === "0" ? "1" : "0");
    expect(verify(tampered)).toBeNull();
  });

  it("rejects a malformed token with no separator", () => {
    expect(verify("not-a-real-token")).toBeNull();
  });

  it("rejects an empty token", () => {
    expect(verify("")).toBeNull();
  });

  it("throws if SESSION_SECRET is unset in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => sign("user-123")).toThrow(/SESSION_SECRET/);
  });

  it("does not throw in production once SESSION_SECRET is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.SESSION_SECRET = "a-real-secret";
    expect(() => sign("user-123")).not.toThrow();
  });
});
