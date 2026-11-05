import { TersoTimeoutError, TersoValidationError } from "../errors/index.js";
import type {
  CreateScanInput,
  PaginatedResponse,
  PaginationInput,
  Scan,
  WaitForResultOptions,
} from "../types/index.js";
import type { HttpClient } from "../transport/http-client.js";
import { sleep } from "../utils/sleep.js";
import { requireNonEmpty, validateCreateScan } from "../utils/validation.js";

export class ScansResource {
  constructor(private readonly http: HttpClient) {}
  create(input: CreateScanInput): Promise<Scan> {
    validateCreateScan(input);
    return this.http.request("scans", { method: "POST", body: input });
  }
  get(scanId: string, signal?: AbortSignal): Promise<Scan> {
    requireNonEmpty(scanId, "scanId");
    return this.http.request(`scans/${encodeURIComponent(scanId)}`, { signal });
  }
  list(options: PaginationInput = {}): Promise<PaginatedResponse<Scan>> {
    if (
      options.page !== undefined &&
      (!Number.isInteger(options.page) || options.page < 1)
    )
      throw new TersoValidationError("page must be a positive integer");
    if (
      options.pageSize !== undefined &&
      (!Number.isInteger(options.pageSize) ||
        options.pageSize < 1 ||
        options.pageSize > 100)
    )
      throw new TersoValidationError("pageSize must be between 1 and 100");
    return this.http.request("scans", {
      query: {
        page: options.page,
        pageSize: options.pageSize,
        cursor: options.cursor,
      },
    });
  }
  cancel(scanId: string): Promise<Scan> {
    requireNonEmpty(scanId, "scanId");
    return this.http.request(`scans/${encodeURIComponent(scanId)}/cancel`, {
      method: "POST",
    });
  }
  async waitForResult(
    scanId: string,
    options: WaitForResultOptions = {},
  ): Promise<Scan> {
    requireNonEmpty(scanId, "scanId");
    const interval = options.pollingIntervalMs ?? 2_000;
    const timeoutMs = options.timeoutMs ?? 300_000;
    if (interval < 0 || timeoutMs <= 0)
      throw new TersoValidationError(
        "Polling interval must be non-negative and timeout must be positive",
      );
    const started = Date.now();
    for (;;) {
      const scan = await this.get(scanId, options.signal);
      if (["completed", "failed", "cancelled"].includes(scan.status))
        return scan;
      const remaining = timeoutMs - (Date.now() - started);
      if (remaining <= 0)
        throw new TersoTimeoutError(
          `Scan ${scanId} did not finish within ${timeoutMs}ms`,
        );
      await sleep(Math.min(interval, remaining), options.signal);
    }
  }
}
