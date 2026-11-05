export interface TersoErrorOptions {
  cause?: unknown;
  code?: string | undefined;
  requestId?: string | undefined;
}

export class TersoError extends Error {
  readonly code: string | undefined;
  readonly requestId: string | undefined;
  constructor(message: string, options: TersoErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code;
    this.requestId = options.requestId;
  }
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      requestId: this.requestId,
    };
  }
}

export class TersoApiError extends TersoError {
  readonly statusCode: number;
  readonly details: unknown;
  constructor(
    message: string,
    statusCode: number,
    options: TersoErrorOptions & { details?: unknown } = {},
  ) {
    super(message, options);
    this.statusCode = statusCode;
    this.details = options.details;
  }
  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}
export class TersoAuthenticationError extends TersoApiError {}
export class TersoRateLimitError extends TersoApiError {
  readonly retryAfterMs: number | undefined;
  constructor(
    message: string,
    statusCode: number,
    options: TersoErrorOptions & {
      details?: unknown;
      retryAfterMs?: number | undefined;
    } = {},
  ) {
    super(message, statusCode, options);
    this.retryAfterMs = options.retryAfterMs;
  }
}
export class TersoTimeoutError extends TersoError {}
export class TersoNetworkError extends TersoError {}
export class TersoValidationError extends TersoError {}
