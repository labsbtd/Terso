export const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export function retryDelay(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined) return retryAfterMs;
  const base = Math.min(500 * 2 ** attempt, 8_000);
  return Math.floor(base / 2 + Math.random() * (base / 2));
}

export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}
