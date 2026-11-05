import { describe, expect, it, vi } from "vitest";
import { Terso, TersoValidationError, VERSION } from "../src/index.js";

describe("Terso client", () => {
  it("validates configuration without exposing the key", () => {
    expect(() => new Terso({ apiKey: "" })).toThrow(TersoValidationError);
    const secret = "terso_super_secret";
    try {
      new Terso({ apiKey: secret, baseUrl: "://bad" });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
  it("sets SDK headers and checks health", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
      );
    const terso = new Terso({
      apiKey: "secret",
      baseUrl: "https://example.test/v1/",
      fetch,
      userAgentSuffix: "app/2",
    });
    await expect(terso.health.check()).resolves.toEqual({ status: "ok" });
    const [, init] = fetch.mock.calls[0]!;
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer secret",
    );
    expect(new Headers(init?.headers).get("x-terso-sdk-version")).toBe(VERSION);
    expect(String(new Headers(init?.headers).get("user-agent"))).toContain(
      "app/2",
    );
  });
});
