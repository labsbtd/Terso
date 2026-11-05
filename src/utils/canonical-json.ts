import { TersoValidationError } from "../errors/index.js";

function normalize(value: unknown, seen: Set<object>): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TersoValidationError(
        "Proof data must contain only finite numbers",
      );
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => normalize(item, seen));
  if (typeof value === "object") {
    if (seen.has(value))
      throw new TersoValidationError(
        "Proof data must not contain circular references",
      );
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) result[key] = normalize(item, seen);
    }
    seen.delete(value);
    return result;
  }
  throw new TersoValidationError("Proof data must be JSON-serializable");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value, new Set()));
}
