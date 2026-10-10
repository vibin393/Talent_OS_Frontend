/**
 * @mention markup used in activity bodies (Epic 2, story 2.3).
 *
 * Stored form (what the API accepts and returns): `@[Display Name](user:<uuid>)`; the backend parses the
 * same pattern, validates the ids as tenant users and notifies each new mention. The composer edits a
 * friendlier display form (`@Display Name`) and keeps the picked people alongside; `toMarkup` turns the
 * display text back into markup on submit and `toDisplay` does the reverse when a note is edited.
 */

export type Mention = { id: string; name: string };

export type BodySegment = { kind: "text"; text: string } | { kind: "mention"; id: string; name: string };

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
/** Same pattern as the backend's `MENTION_RE` (name: 1-200 chars without `]` or a newline). */
const MENTION_SOURCE = `@\\[([^\\]\\n]{1,200})\\]\\(user:(${UUID})\\)`;
const MAX_NAME = 200;

/** A display name made safe for the markup: no `]`, no line breaks, collapsed spaces, max 200 chars. */
export function sanitizeMentionName(name: string): string {
  const clean = name
    .replace(/[\]\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME)
    .trim();
  return clean || "user";
}

/** Markup for one mention: `@[Name](user:<uuid>)`. */
export function formatMention(name: string, id: string): string {
  return `@[${sanitizeMentionName(name)}](user:${id.toLowerCase()})`;
}

/** Split a stored body into text and mention segments (adjacent text is merged; empty text dropped). */
export function parseBody(body: string): BodySegment[] {
  const out: BodySegment[] = [];
  const re = new RegExp(MENTION_SOURCE, "g");
  let last = 0;
  for (let m = re.exec(body); m !== null; m = re.exec(body)) {
    if (m.index > last) out.push({ kind: "text", text: body.slice(last, m.index) });
    out.push({ kind: "mention", name: m[1], id: m[2].toLowerCase() });
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push({ kind: "text", text: body.slice(last) });
  return out;
}

/** Mentioned user ids in order of first appearance, without duplicates. */
export function mentionIds(body: string): string[] {
  const ids: string[] = [];
  for (const s of parseBody(body)) if (s.kind === "mention" && !ids.includes(s.id)) ids.push(s.id);
  return ids;
}

/** Plain-text rendering of a stored body (`@Name` for mentions), e.g. for previews and screen readers. */
export function toPlainText(body: string): string {
  return parseBody(body)
    .map((s) => (s.kind === "text" ? s.text : `@${s.name}`))
    .join("");
}

/** Display form of a stored body plus the mentions it contains (for editing an existing note). */
export function toDisplay(body: string): { text: string; mentions: Mention[] } {
  const mentions: Mention[] = [];
  let text = "";
  for (const s of parseBody(body)) {
    if (s.kind === "text") {
      text += s.text;
    } else {
      text += `@${s.name}`;
      if (!mentions.some((m) => m.id === s.id && m.name === s.name)) mentions.push({ id: s.id, name: s.name });
    }
  }
  return { text, mentions };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Markup for display text: every `@Name` of a picked mention (followed by a non-word character or the end)
 * becomes `@[Name](user:<id>)`. Longer names win over shorter prefixes ("@Ann Lee" before "@Ann"). Mentions
 * whose `@Name` was deleted from the text are simply dropped; existing markup is left untouched.
 */
export function toMarkup(text: string, mentions: readonly Mention[]): string {
  const byName = new Map<string, string>();
  for (const m of mentions) {
    const name = sanitizeMentionName(m.name);
    if (!byName.has(name)) byName.set(name, m.id);
  }
  if (byName.size === 0) return text;
  const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  // Existing markup is matched first (and kept) so a name inside it is never re-wrapped.
  const re = new RegExp(`${MENTION_SOURCE}|@(${names.join("|")})(?![\\p{L}\\p{N}_])`, "gu");
  return text.replace(re, (whole: string, _n: string, _id: string, display: string | undefined) =>
    display === undefined ? whole : formatMention(display, byName.get(display)!),
  );
}

/**
 * The `@query` being typed immediately before `caret`, if any: an `@` at the start or after whitespace /
 * an opening bracket, followed by up to 40 characters without `@` or a line break (spaces allowed so
 * "@ann l" keeps filtering). Returns the index of the `@` and the query text.
 */
export function mentionQueryAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, Math.max(0, Math.min(caret, text.length)));
  const m = /(^|[\s(])@([^@\n\r]{0,40})$/u.exec(before);
  if (!m) return null;
  const query = m[2];
  if (/^\s/.test(query) || /\s{2,}$/.test(query)) return null;
  return { start: before.length - query.length - 1, query };
}

/** Replace `text[start, caret)` (the `@query`) with `@Name ` and return the new text and caret. */
export function insertMention(text: string, start: number, caret: number, name: string): { text: string; caret: number } {
  const token = `@${sanitizeMentionName(name)} `;
  const next = text.slice(0, start) + token + text.slice(caret).replace(/^ /, "");
  return { text: next, caret: start + token.length };
}
