import { TersoValidationError } from "../errors/index.js";
import type { CreateScanInput, ScanSource } from "../types/index.js";

export function requireNonEmpty(value: string, name: string): void {
  if (typeof value !== "string" || value.trim() === "")
    throw new TersoValidationError(`${name} is required`);
}

export function validateSource(source: ScanSource): void {
  if (!source || typeof source !== "object")
    throw new TersoValidationError("source is required");
  if (source.type === "repository") {
    requireNonEmpty(source.url, "source.url");
    try {
      new URL(source.url);
    } catch {
      throw new TersoValidationError("source.url must be a valid URL");
    }
  } else if (source.type === "archive") {
    requireNonEmpty(source.url, "source.url");
    try {
      new URL(source.url);
    } catch {
      throw new TersoValidationError("source.url must be a valid URL");
    }
  } else if (source.type === "code")
    requireNonEmpty(source.content, "source.content");
  else throw new TersoValidationError("source.type is not supported");
}

export function validateCreateScan(input: CreateScanInput): void {
  if (!input || typeof input !== "object")
    throw new TersoValidationError("scan input is required");
  requireNonEmpty(input.projectName, "projectName");
  validateSource(input.source);
}
