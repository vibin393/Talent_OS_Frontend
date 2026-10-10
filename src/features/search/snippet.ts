import type { SnippetSegment } from "@/lib/api/types";

/**
 * Clean snippet segments for rendering as React text (never as HTML): strips the `ts_headline`
 * control markers and other control characters, drops empty segments and merges neighbours that share
 * the highlight flag.
 */
export function normalizeSnippet(segments: readonly SnippetSegment[] | null | undefined): SnippetSegment[] {
  const out: SnippetSegment[] = [];
  for (const seg of segments ?? []) {
    const text = String(seg.text ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");
    if (!text) continue;
    const last = out[out.length - 1];
    if (last && last.hl === !!seg.hl) last.text += text;
    else out.push({ text, hl: !!seg.hl });
  }
  return out;
}
