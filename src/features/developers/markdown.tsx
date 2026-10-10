import type { ReactNode } from "react";

/** Minimal safe Markdown (headings, paragraphs, lists, fenced code, inline code): React elements only, no raw HTML. */
export function Markdown({ source }: { source: string }) {
  const out: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let key = 0;
  const inline = (text: string): ReactNode[] =>
    text.split(/(`[^`]+`)/g).map((part, n) => (part.startsWith("`") && part.endsWith("`") ? <code key={n}>{part.slice(1, -1)}</code> : part));
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      out.push(<pre key={key++} className="dev-code"><code>{code.join("\n")}</code></pre>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(h[1].length + 1, 4);
      const Tag = `h${level}` as "h2" | "h3" | "h4";
      const id = h[2].toLowerCase().replace(/[^a-z0-9]+/g, "-");
      out.push(<Tag key={key++} id={id}>{inline(h[2])}</Tag>);
      i++;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s+/, ""));
      out.push(<ul key={key++}>{items.map((t, n) => <li key={n}>{inline(t)}</li>)}</ul>);
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#|```|[-*]\s)/.test(lines[i])) para.push(lines[i++]);
    out.push(<p key={key++}>{inline(para.join(" "))}</p>);
  }
  return <>{out}</>;
}
