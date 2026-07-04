// Typed error handling for the Compliance OS.
//
// Two things live here:
//   1. A hierarchy of `AppError`s that carry an HTTP status + stable machine
//      code, so route handlers can `throw` and have a single place translate
//      them into responses (see serializeError / errorResponse in api-response).
//   2. A lightweight `Result<T, E>` type for domain logic that prefers returning
//      failures over throwing (used by engines/services that run in loops).

export type ErrorCode =
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "service_unavailable"
  | "internal_error";

export interface SerializedError {
  status: number;
  body: {
    error: string;
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(params: {
    code: ErrorCode;
    statusCode: number;
    message: string;
    details?: unknown;
    cause?: unknown;
    /** Whether `message` is safe to return to the client. Defaults true; 500s default false. */
    expose?: boolean;
  }) {
    super(params.message);
    this.name = new.target.name;
    this.code = params.code;
    this.statusCode = params.statusCode;
    this.details = params.details;
    this.expose = params.expose ?? params.statusCode < 500;
    if (params.cause !== undefined) this.cause = params.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super({ code: "validation_error", statusCode: 422, message, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Not authenticated") {
    super({ code: "unauthorized", statusCode: 401, message });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super({ code: "forbidden", statusCode: 403, message });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super({ code: "not_found", statusCode: 404, message });
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number, message = "Too many requests") {
    super({ code: "rate_limited", statusCode: 429, message, details: { retryAfterSeconds } });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string) {
    super({ code: "service_unavailable", statusCode: 503, message });
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error", cause?: unknown) {
    super({ code: "internal_error", statusCode: 500, message, cause, expose: false });
  }
}

/** Normalizes any thrown value into an AppError. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new InternalError(message, err);
}

/** Produces the status + JSON body for an error, hiding internal messages. */
export function serializeError(err: unknown): SerializedError {
  const appError = toAppError(err);
  return {
    status: appError.statusCode,
    body: {
      error: appError.name,
      code: appError.code,
      message: appError.expose ? appError.message : "An unexpected error occurred.",
      ...(appError.details !== undefined ? { details: appError.details } : {}),
    },
  };
}

// ─── Result type ─────────────────────────────────────────────────────────────

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}
