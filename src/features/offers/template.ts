/** Pure helpers for the offer letter template editor. */
import { isApiError } from "@/lib/api/errors";

/** The Jinja2 token for a merge field key. */
export function mergeToken(key: string): string {
  return `{{ ${key} }}`;
}

/** Insert `token` replacing the selection [start, end); returns the new text and caret position. */
export function insertAt(text: string, start: number, end: number, token: string): { text: string; caret: number } {
  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.max(s, Math.min(end, text.length));
  return { text: text.slice(0, s) + token + text.slice(e), caret: s + token.length };
}

/** Merge field keys used in a template body (`{{ offer.title }}`). */
export function usedFields(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*([a-zA-Z_][\w.]*)\s*(?:\|[^}]*)?\}\}/g)) out.add(m[1]);
  return [...out];
}

/** Fields a body uses that are not in the whitelist (a client-side hint; the server is authoritative). */
export function unknownFields(body: string, allowed: readonly string[]): string[] {
  const set = new Set(allowed);
  return usedFields(body).filter((f) => !set.has(f));
}

/** The 422 `unknown_merge_field` details as an inline message, or null. */
export function templateFieldError(e: unknown): string | null {
  if (!isApiError(e) || e.status !== 422) return null;
  const field = typeof e.details.field === "string" ? e.details.field : null;
  if (e.code === "unknown_merge_field") return field ? `“${field}” is not an allowed merge field.` : "The template uses a merge field that is not allowed.";
  if (e.code === "template_syntax" || e.code === "template_error") return e.message;
  return null;
}
