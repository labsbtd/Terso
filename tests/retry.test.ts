import { describe, expect, it, vi } from "vitest";
import {
  Terso,
  TersoAuthenticationError,
  TersoNetworkError,
  TersoRateLimitError,
  TersoTimeoutError,
} from "../src/index.js";
import { parseRetryAfter } from "../src/transport/retry.js";

describe("transport resilience", () => {
  it("retries retryable responses", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response("busy", { status: 503, headers: { "retry-after": "0" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
      );
    await expect(
      new Terso({ apiKey: "x", fetch, maxRetries: 1 }).health.check(),
    ).resolves.toEqual({ status: "ok" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("maps authentication, rate limit, and non-JSON failures", async () => {
    const auth = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "bad_key", message: "Rejected secret" },
        }),
        { status: 401 },
      ),
    );
    const authError = await new Terso({ apiKey: "secret", fetch: auth }).health
      .check()
      .catch((caught: unknown) => caught);
    expect(authError).toBeInstanceOf(TersoAuthenticationError);
    expect(String(authError)).not.toContain("secret");
    const rate = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response("limited", {
        status: 429,
        headers: { "retry-after": "2" },
      }),
    );
    const error = await new Terso({
      apiKey: "x",
      fetch: rate,
      maxRetries: 0,
    }).health
      .check()
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TersoRateLimitError);
    expect((error as TersoRateLimitError).retryAfterMs).toBe(2_000);
    expect(String(error)).not.toContain("secret");
  });
  it("maps network failures and request timeouts", async () => {
    const failed = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(new Error("socket"));
    await expect(
      new Terso({ apiKey: "x", fetch: failed, maxRetries: 0 }).health.check(),
    ).rejects.toBeInstanceOf(TersoNetworkError);
    const hanging = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(
        (_input, init) =>
          new Promise((_resolve, reject) =>
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            ),
          ),
      );
    await expect(
      new Terso({
        apiKey: "x",
        fetch: hanging,
        timeoutMs: 1,
        maxRetries: 0,
      }).health.check(),
    ).rejects.toBeInstanceOf(TersoTimeoutError);
  });
  it("parses Retry-After dates", () => {
    expect(
      parseRetryAfter(
        "Thu, 01 Jan 2026 00:00:01 GMT",
        Date.parse("2026-01-01T00:00:00Z"),
      ),
    ).toBe(1_000);
  });
});
