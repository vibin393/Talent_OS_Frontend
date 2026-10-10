import type { SeriesFyFormat } from "./types";

/** Preview of the first number a new series will issue (the server computes the real one). */
export function previewNumber(prefix: string, fyFormat: SeriesFyFormat, separator: string, pad: number): string {
  const fy = { "YY-YY": "25-26", "YYYY-YY": "2025-26", YY: "26", none: "" }[fyFormat];
  const n = "1".padStart(Math.max(1, Math.min(10, pad || 1)), "0");
  return [prefix.trim(), fy, n].filter(Boolean).join(separator);
}
