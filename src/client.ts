import { TersoValidationError } from "./errors/index.js";
import { HealthResource } from "./resources/health.js";
import { ScansResource } from "./resources/scans.js";
import { ProofsResource } from "./resources/proofs.js";
import { HttpClient } from "./transport/http-client.js";
import type { TersoOptions } from "./types/index.js";

export class Terso {
  readonly scans: ScansResource;
  readonly health: HealthResource;
  readonly proofs: ProofsResource;
  constructor(options: TersoOptions) {
    if (
      !options ||
      typeof options.apiKey !== "string" ||
      options.apiKey.trim() === ""
    )
      throw new TersoValidationError("apiKey is required");
    if (options.timeoutMs !== undefined && options.timeoutMs <= 0)
      throw new TersoValidationError("timeoutMs must be positive");
    if (
      options.maxRetries !== undefined &&
      (!Number.isInteger(options.maxRetries) || options.maxRetries < 0)
    )
      throw new TersoValidationError(
        "maxRetries must be a non-negative integer",
      );
    let http: HttpClient;
    try {
      http = new HttpClient(options);
    } catch {
      throw new TersoValidationError("baseUrl must be a valid absolute URL");
    }
    this.scans = new ScansResource(http);
    this.health = new HealthResource(http);
    this.proofs = new ProofsResource(options.solana);
  }
}
