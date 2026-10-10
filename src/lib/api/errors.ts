/** Error thrown by the API client for any non-2xx response (or network failure, status 0). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;
  /** Epic 14 (FR-82): set on the final `csrf_failed` error after the automatic CSRF retry. */
  retried?: boolean;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Build an ApiError from a response and its (possibly unparsable) JSON body. */
export function toApiError(status: number, body: unknown): ApiError {
  const err = isRecord(body) && isRecord(body.error) ? body.error : null;
  if (err) {
    const code = typeof err.code === "string" ? err.code : "http_error";
    const message = typeof err.message === "string" ? err.message : `Request failed with ${status}`;
    return new ApiError(status, code, message, isRecord(err.details) ? err.details : {});
  }
  return new ApiError(status, status >= 500 ? "internal_error" : "http_error", `Request failed with ${status}`);
}

/**
 * Field-level messages from a 422 envelope, keyed by the body field name.
 * Backend contract: `details.fields` is a list of `{field: "<dotted loc>", message, type}` for both
 * request validation and domain 422s (e.g. `weak_password`). A legacy dict form
 * `{password: "..."}` is tolerated as well.
 */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!isApiError(e)) return {};
  const fields = e.details.fields;
  const out: Record<string, string> = {};
  if (Array.isArray(fields)) {
    for (const f of fields) {
      if (!isRecord(f) || typeof f.field !== "string") continue;
      // Map to the form input by the last dotted segment: "body.password" / "password" -> "password".
      const name = f.field.split(".").pop() ?? f.field;
      if (!(name in out)) out[name] = typeof f.message === "string" ? f.message : "Invalid value";
    }
  } else if (isRecord(fields)) {
    for (const [name, msg] of Object.entries(fields)) {
      if (typeof msg === "string") out[name] = msg;
      else if (Array.isArray(msg) && typeof msg[0] === "string") out[name] = msg[0];
    }
  }
  return out;
}

/** A user-facing message for an unexpected error. */
export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isApiError(e)) {
    if (e.status === 0) return "Cannot reach the server. Check your connection and try again.";
    if (e.status >= 500) return fallback;
    return e.message || fallback;
  }
  return fallback;
}
