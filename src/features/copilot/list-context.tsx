"use client";

/**
 * One-line list-page context for the Copilot (Epic 54 B4): `<CopilotListContext kind="candidates" />` registers the
 * list kind and its URL filters (ids and short values only) as the page context.
 */
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useCopilotPageContext } from "./copilot-context";
import type { CopilotListKind, FilterValue } from "./types";

const SKIP = new Set(["page", "page_size", "sort", "view_mode"]);

function Inner({ kind, label }: { kind: CopilotListKind; label?: string }) {
  const params = useSearchParams();
  const filters: Record<string, FilterValue> = {};
  for (const key of new Set(params.keys())) {
    if (SKIP.has(key) || Object.keys(filters).length >= 20) continue;
    const values = params.getAll(key).map((v) => v.slice(0, 200)).slice(0, 20);
    filters[key.slice(0, 60)] = values.length > 1 ? values : values[0] ?? "";
  }
  useCopilotPageContext({ list: { kind, filters }, label });
  return null;
}

export function CopilotListContext({ kind, label }: { kind: CopilotListKind; label?: string }) {
  return (
    <Suspense fallback={null}>
      <Inner kind={kind} label={label} />
    </Suspense>
  );
}
