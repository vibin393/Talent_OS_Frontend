/**
 * A deliberately small Markdown subset for notice previews: headings (#..###), paragraphs, bullet and
 * numbered lists, **bold**, *italic*, `code` and [links](https://...). Output is a plain block tree that
 * is rendered as React elements (never as HTML), so it cannot inject markup. Only http(s) and mailto
 * links survive; anything else is shown as text.
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; v: Inline[] }
  | { t: "em"; v: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; v: Inline[] };

export type Block =
  | { t: "h"; level: 1 | 2 | 3; v: Inline[] }
  | { t: "p"; v: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; items: Inline[][] };

export function safeHref(href: string): string | null {
  const h = href.trim();
  return /^(https?:\/\/|mailto:)/i.test(h) ? h : null;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ t: "text", v: text });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpExecArray | null;
    if ((m = /^\*\*([^*]+)\*\*/.exec(rest))) {
      flush();
      out.push({ t: "strong", v: parseInline(m[1]) });
    } else if ((m = /^\*([^*]+)\*/.exec(rest)) || (m = /^_([^_]+)_/.exec(rest))) {
      flush();
      out.push({ t: "em", v: parseInline(m[1]) });
    } else if ((m = /^`([^`]+)`/.exec(rest))) {
      flush();
      out.push({ t: "code", v: m[1] });
    } else if ((m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest))) {
      const href = safeHref(m[2]);
      if (href) {
        flush();
        out.push({ t: "link", href, v: parseInline(m[1]) });
      } else {
        text += m[1];
      }
    } else {
      text += src[i];
      i += 1;
      continue;
    }
    i += m[0].length;
  }
  flush();
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { t: "ul" | "ol"; items: Inline[][] } | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ t: "p", v: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  for (const raw of src.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    let m: RegExpExecArray | null;
    if (!line) {
      flushPara();
      flushList();
    } else if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) {
      flushPara();
      flushList();
      blocks.push({ t: "h", level: m[1].length as 1 | 2 | 3, v: parseInline(m[2]) });
    } else if ((m = /^[-*+]\s+(.*)$/.exec(line)) || (m = /^\d+[.)]\s+(.*)$/.exec(line))) {
      flushPara();
      const kind = /^\d/.test(line) ? "ol" : "ul";
      if (!list || list.t !== kind) {
        flushList();
        list = { t: kind, items: [] };
      }
      list.items.push(parseInline(m[1]));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}
