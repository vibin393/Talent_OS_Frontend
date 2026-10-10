import { isApiError } from "@/lib/api/errors";

/** Marker placed at the error position in the caret excerpt. */
export const CARET = "⏵";
const CONTEXT = 12;

/**
 * Short excerpt of `query` around the 1-based error `position` with a caret marker, e.g.
 * `databricks AND (azure` @16 -> `…ricks AND ⏵(azure`; a position past the end puts the caret at the end.
 */
export function caretExcerpt(query: string, position: number): string {
  const text = query.replace(/\s+/g, " ");
  const idx = Math.min(Math.max(0, Math.floor(position) - 1), text.length);
  const start = Math.max(0, idx - CONTEXT);
  const end = Math.min(text.length, idx + CONTEXT);
  const before = text.slice(start, idx);
  const after = text.slice(idx, end);
  return `${start > 0 ? "…" : ""}${before}${CARET}${after}${end < text.length ? "…" : ""}`;
}

export type QuerySyntaxProblem = { message: string; position: number | null; excerpt: string | null };

/** The inline field error for a 422 `invalid_query` response to `query`, else null. */
export function querySyntaxProblem(error: unknown, query: string): QuerySyntaxProblem | null {
  if (!isApiError(error) || error.status !== 422 || error.code !== "invalid_query") return null;
  const pos = typeof error.details.position === "number" ? error.details.position : null;
  const message = typeof error.details.message === "string" ? error.details.message : error.message;
  return { message, position: pos, excerpt: pos === null ? null : caretExcerpt(query, pos) };
}
