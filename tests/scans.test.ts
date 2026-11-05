import { describe, expect, it, vi } from "vitest";
import {
  Terso,
  TersoTimeoutError,
  TersoValidationError,
} from "../src/index.js";

const base = {
  id: "scan/1",
  projectName: "app",
  source: { type: "repository" as const, url: "https://github.com/a/b" },
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("scans", () => {
  it("creates, gets, lists, and cancels scans with encoded paths", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({ ...base, status: "queued" }))
      .mockResolvedValueOnce(json({ ...base, status: "running" }))
      .mockResolvedValueOnce(
        json({
          data: [{ ...base, status: "running" }],
          pagination: { page: 2 },
        }),
      )
      .mockResolvedValueOnce(json({ ...base, status: "cancelled" }));
    const scans = new Terso({
      apiKey: "x",
      baseUrl: "https://api.test/v1",
      fetch,
    }).scans;
    await scans.create({ projectName: "app", source: base.source });
    await scans.get("scan/1");
    await expect(scans.list({ page: 2, pageSize: 10 })).resolves.toMatchObject({
      pagination: { page: 2 },
    });
    await scans.cancel("scan/1");
    expect((fetch.mock.calls[1]![0] as URL).pathname).toContain(
      "scans/scan%2F1",
    );
    expect((fetch.mock.calls[2]![0] as URL).searchParams.get("pageSize")).toBe(
      "10",
    );
  });
  it("validates create and pagination inputs", () => {
    const scans = new Terso({ apiKey: "x", fetch: vi.fn() }).scans;
    expect(() =>
      scans.create({ projectName: "", source: base.source }),
    ).toThrow(TersoValidationError);
    expect(() => scans.list({ pageSize: 101 })).toThrow(TersoValidationError);
  });
  it("polls until completion", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({ ...base, status: "running" }))
      .mockResolvedValueOnce(
        json({
          ...base,
          status: "completed",
          result: { findings: [], completedAt: "now" },
        }),
      );
    const result = await new Terso({ apiKey: "x", fetch }).scans.waitForResult(
      "id",
      { pollingIntervalMs: 0, timeoutMs: 1_000 },
    );
    expect(result.status).toBe("completed");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("times out polling and supports cancellation", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(() =>
        Promise.resolve(json({ ...base, status: "running" })),
      );
    const scans = new Terso({ apiKey: "x", fetch }).scans;
    await expect(
      scans.waitForResult("id", { pollingIntervalMs: 10, timeoutMs: 1 }),
    ).rejects.toBeInstanceOf(TersoTimeoutError);
    const controller = new AbortController();
    controller.abort(new Error("stop"));
    await expect(
      scans.waitForResult("id", { signal: controller.signal }),
    ).rejects.toThrow("stop");
  });
});
