import {
  TersoApiError,
  TersoAuthenticationError,
  TersoNetworkError,
  TersoRateLimitError,
  TersoTimeoutError,
} from "../errors/index.js";
import type { TersoApiErrorShape, TersoOptions } from "../types/index.js";
import { VERSION } from "../version.js";
import { sleep } from "../utils/sleep.js";
import { parseRetryAfter, RETRYABLE_STATUSES, retryDelay } from "./retry.js";

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function apiError(value: unknown): TersoApiErrorShape | undefined {
  if (
    !isRecord(value) ||
    !isRecord(value.error) ||
    typeof value.error.message !== "string"
  )
    return undefined;
  const error: TersoApiErrorShape["error"] = { message: value.error.message };
  if (typeof value.error.code === "string") error.code = value.error.code;
  if ("details" in value.error) error.details = value.error.details;
  const result: TersoApiErrorShape = { error };
  if (typeof value.requestId === "string") result.requestId = value.requestId;
  return result;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly userAgent: string;
  constructor(options: TersoOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.terso.example/v1").replace(
      /\/+$/,
      "",
    );
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.userAgent = `@labsbtd/terso/${VERSION}${options.userAgentSuffix ? ` ${options.userAgentSuffix}` : ""}`;
  }
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}/${path.replace(/^\/+/, "")}`);
    for (const [key, value] of Object.entries(options.query ?? {}))
      if (value !== undefined) url.searchParams.set(key, String(value));
    for (let attempt = 0; ; attempt += 1) {
      const timeoutController = new AbortController();
      const timeout = setTimeout(
        () => timeoutController.abort(),
        this.timeoutMs,
      );
      const abort = (): void => timeoutController.abort(options.signal?.reason);
      options.signal?.addEventListener("abort", abort, { once: true });
      try {
        const response = await this.fetchImpl(url, {
          method: options.method ?? "GET",
          signal: timeoutController.signal,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Terso-SDK-Version": VERSION,
            "User-Agent": this.userAgent,
          },
          ...(options.body === undefined
            ? {}
            : { body: JSON.stringify(options.body) }),
        });
        const text = await response.text();
        let parsed: unknown;
        if (text) {
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = undefined;
          }
        }
        if (response.ok) return parsed as T;
        const shape = apiError(parsed);
        const requestId =
          response.headers.get("x-request-id") ?? shape?.requestId;
        const message =
          shape?.error.message ??
          `Terso API request failed with status ${response.status}${text && !shape ? `: ${text.slice(0, 200)}` : ""}`;
        const safeMessage = message.split(this.apiKey).join("[REDACTED]");
        const common = {
          code: shape?.error.code,
          requestId,
          details: shape?.error.details,
        };
        const retryAfterMs = parseRetryAfter(
          response.headers.get("retry-after"),
        );
        if (
          RETRYABLE_STATUSES.has(response.status) &&
          attempt < this.maxRetries
        ) {
          await sleep(retryDelay(attempt, retryAfterMs), options.signal);
          continue;
        }
        if (response.status === 401 || response.status === 403)
          throw new TersoAuthenticationError(
            safeMessage,
            response.status,
            common,
          );
        if (response.status === 429)
          throw new TersoRateLimitError(safeMessage, response.status, {
            ...common,
            retryAfterMs,
          });
        throw new TersoApiError(safeMessage, response.status, common);
      } catch (error) {
        if (
          error instanceof TersoApiError ||
          error instanceof TersoAuthenticationError ||
          error instanceof TersoRateLimitError
        )
          throw error;
        if (options.signal?.aborted)
          throw (
            options.signal.reason ?? new DOMException("Aborted", "AbortError")
          );
        if (timeoutController.signal.aborted)
          throw new TersoTimeoutError(
            `Request timed out after ${this.timeoutMs}ms`,
            { cause: error },
          );
        if (attempt < this.maxRetries) {
          await sleep(retryDelay(attempt), options.signal);
          continue;
        }
        throw new TersoNetworkError("Unable to reach the Terso API", {
          cause: error,
        });
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", abort);
      }
    }
  }
}
