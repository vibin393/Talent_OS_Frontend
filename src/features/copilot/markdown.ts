/**
 * A safe Markdown subset for Copilot answers (Epic 54 B3): paragraphs, emphasis, lists, tables, inline code and
 * links. No raw HTML ever: the output is a tree rendered as React text nodes. A link is kept only when its path is
 * `/<domain>/<uuid>` and `(type, id)` is in the message refs; external URLs and unknown ids become plain text.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; children: Inline[] };

export type Block =
  | { kind: "p"; children: Inline[] }
  | { kind: "ul" | "ol"; items: Inline[][] }
  | { kind: "table"; head: Inline[][]; rows: Inline[][][] }
  | { kind: "h"; children: Inline[] };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const LINK_PATH = new RegExp(`^/([a-z-]+)/(${UUID})$`, "i");

/** URL segment -> ref type (the record pages of the staff app). */
export const SEGMENT_TYPES: Record<string, string> = {
  candidates: "candidate",
  demands: "demand",
  applications: "application",
  clients: "client",
  placements: "placement",
  interviews: "interview",
  workers: "worker",
  offers: "offer",
  projects: "project",
};

export type RefSet = ReadonlySet<string>;

export function refKey(type: string, id: string): string {
  return `${type}:${id.toLowerCase()}`;
}

export function refSet(refs: readonly (readonly [string, string])[] | null | undefined): RefSet {
  return new Set((refs ?? []).map(([t, id]) => refKey(t, String(id))));
}

/** The internal href when the link is allowed, else null. */
export function allowedHref(href: string, refs: RefSet): string | null {
  const m = LINK_PATH.exec(href.trim());
  if (!m) return null;
  const type = SEGMENT_TYPES[m[1].toLowerCase()];
  if (!type || !refs.has(refKey(type, m[2]))) return null;
  return `/${m[1].toLowerCase()}/${m[2].toLowerCase()}`;
}

function flatten(nodes: Inline[]): string {
  return nodes.map((n) => (n.kind === "text" || n.kind === "code" ? n.text : flatten(n.children))).join("");
}

export function parseInline(text: string, refs: RefSet): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const push = () => {
    if (buf) out.push({ kind: "text", text: buf });
    buf = "";
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i) {
        push();
        out.push({ kind: "code", text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (ch === "*" || ch === "_") {
      const double = text[i + 1] === ch;
      const marker = double ? ch + ch : ch;
      const end = text.indexOf(marker, i + marker.length);
      if (end > i + marker.length) {
        push();
        const inner = parseInline(text.slice(i + marker.length, end), refs);
        out.push(double ? { kind: "strong", children: inner } : { kind: "em", children: inner });
        i = end + marker.length;
        continue;
      }
    }
    if (ch === "[") {
      const close = text.indexOf("](", i + 1);
      const end = close > i ? text.indexOf(")", close + 2) : -1;
      if (close > i && end > close) {
        push();
        const label = parseInline(text.slice(i + 1, close), refs);
        const href = allowedHref(text.slice(close + 2, end), refs);
        if (href) out.push({ kind: "link", href, children: label });
        else out.push({ kind: "text", text: flatten(label) });
        i = end + 1;
        continue;
      }
    }
    buf += ch;
    i += 1;
  }
  push();
  // merge adjacent text nodes
  return out.reduce<Inline[]>((acc, n) => {
    const last = acc[acc.length - 1];
    if (n.kind === "text" && last?.kind === "text") acc[acc.length - 1] = { kind: "text", text: last.text + n.text };
    else acc.push(n);
    return acc;
  }, []);
}

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function parseMarkdown(source: string, refs: RefSet): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", children: parseInline(para.join(" "), refs) });
    para = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "h", children: parseInline(heading[1], refs) });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush();
      const head = cells(line).map((c) => parseInline(c, refs));
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(cells(lines[i]).map((c) => parseInline(c, refs)));
        i += 1;
      }
      i -= 1;
      blocks.push({ kind: "table", head, rows });
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flush();
      const kind = bullet ? "ul" : "ol";
      const items: Inline[][] = [];
      const re = bullet ? /^\s*[-*+]\s+(.*)$/ : /^\s*\d+[.)]\s+(.*)$/;
      while (i < lines.length) {
        const m = re.exec(lines[i]);
        if (!m) break;
        items.push(parseInline(m[1], refs));
        i += 1;
      }
      i -= 1;
      blocks.push({ kind, items });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

/** First complete sentences of streamed text, for the throttled live region. */
export function completedSentences(text: string): string {
  const m = /^[\s\S]*[.!?](?=\s|$)/.exec(text);
  return m ? m[0] : "";
}
