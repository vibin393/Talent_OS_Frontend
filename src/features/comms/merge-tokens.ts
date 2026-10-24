/**
 * Merge-field tokens (`{{ group.field }}`) and their editor representation.
 *
 * The server stores plain tokens in `subject` / `body_html`. The rich-text editor shows each token as a
 * non-editable chip: `<span data-merge-field="group.field">{{ group.field }}</span>`. These pure helpers
 * convert between the two without a DOM, touching only text between tags (never attribute values, so an
 * `href="{{ link.url }}"` stays as it is).
 */

/** A well-formed token: `{{ group.field }}` (spaces optional). */
export const TOKEN_RE = /\{\{\s*([a-z_]+\.[a-z_]+)\s*\}\}/g;

export function token(path: string): string {
  return `{{ ${path} }}`;
}

/** Distinct token paths used in `text`, in order of first appearance. */
export function tokenPaths(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(TOKEN_RE)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** Paths in `text` that are not in `allowed` (e.g. the merge-field catalog for a template key). */
export function unknownPaths(text: string, allowed: Iterable<string>): string[] {
  const known = new Set(allowed);
  return tokenPaths(text).filter((p) => !known.has(p));
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Split HTML into tags and text runs; `fn` rewrites only the text runs. */
function mapText(html: string, fn: (text: string) => string): string {
  return html
    .split(/(<[^>]*>)/) // NOSONAR
    .map((part) => (part.startsWith("<") && part.endsWith(">") ? part : fn(part)))
    .join("");
}

export function chipHtml(path: string, invalid = false): string {
  const p = escapeAttr(path);
  return `<span data-merge-field="${p}"${invalid ? ' data-invalid="true"' : ""}>${token(path)}</span>`;
}

/** Server HTML -> editor HTML: tokens in text become chips. */
export function tokensToChips(html: string): string {
  return mapText(html, (text) => text.replace(TOKEN_RE, (_, path: string) => chipHtml(path)));
}

const CHIP_RE = /<span\b[^>]*\bdata-merge-field="([a-z_]+\.[a-z_]+)"[^>]*>[\s\S]*?<\/span>/g;

/** Editor HTML -> server HTML: chips become plain tokens. */
export function chipsToTokens(html: string): string {
  return html.replace(CHIP_RE, (_, path: string) => token(path));
}

/** Tiptap serialises an empty document as `<p></p>`; treat it (and whitespace) as empty. */
export function isEmptyHtml(html: string): boolean {
  if (/<img\b/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/g, "") === ""; // NOSONAR
}

/** Plain text of a small HTML fragment (for dirty checks and summaries). */
export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ") // NOSONAR
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
