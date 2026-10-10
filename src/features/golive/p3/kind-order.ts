/** Epic 52 B2: go-live kind ordering and dependency hints driven by `depends_on` from `GET /golive/kinds`. */
import { humanize } from "@/features/dashboards/tile-format";
import type { GoLiveKindOut } from "../types";

/** `depends_on` as a list (the API may send a list, a single kind, or null). */
export function dependsOn(kind: Pick<GoLiveKindOut, "depends_on">): string[] {
  const raw = kind.depends_on;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((k) => String(k).trim()).filter(Boolean);
}

/**
 * Topological order by `depends_on`, stable otherwise: repeatedly take the earliest kind (in input order)
 * whose dependencies listed by the server have all been placed. Dependencies on kinds the server did not
 * list are ignored; a cycle falls back to input order for the remaining kinds.
 */
export function topoOrderKinds<T extends Pick<GoLiveKindOut, "kind" | "depends_on">>(kinds: readonly T[]): T[] {
  const present = new Set(kinds.map((k) => k.kind));
  const placed = new Set<string>();
  const remaining = [...kinds];
  const out: T[] = [];
  while (remaining.length > 0) {
    let idx = remaining.findIndex((k) => dependsOn(k).every((d) => !present.has(d) || placed.has(d) || d === k.kind));
    if (idx === -1) idx = 0; // cycle: keep input order
    const [next] = remaining.splice(idx, 1);
    out.push(next);
    placed.add(next.kind);
  }
  return out;
}

/** Label of a kind (server label when listed, else a humanized key). */
export function kindLabel(kind: string, kinds: readonly Pick<GoLiveKindOut, "kind" | "label">[]): string {
  return kinds.find((k) => k.kind === kind)?.label ?? humanize(kind);
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/** "Import Projects first" / "Import Projects and Project roles first", or null without dependencies. */
export function dependencyHint(kind: Pick<GoLiveKindOut, "depends_on">, kinds: readonly Pick<GoLiveKindOut, "kind" | "label">[]): string | null {
  const deps = dependsOn(kind);
  if (deps.length === 0) return null;
  return `Import ${joinLabels(deps.map((d) => kindLabel(d, kinds)))} first`;
}

/** Message of a `dependency_missing` apply error (422 for Phase 3 kinds, 409 for P2 workers). */
export function dependencyMissingMessage(details: Record<string, unknown>, kinds: readonly Pick<GoLiveKindOut, "kind" | "label">[]): string {
  const requires = Array.isArray(details.requires) ? details.requires.map(String) : [];
  const rows = Array.isArray(details.rows) ? details.rows.length : 0;
  const base = requires.length
    ? `Import ${joinLabels(requires.map((d) => kindLabel(d, kinds)))} first, then apply this file again.`
    : "Some rows refer to records that haven't been imported yet. Import those first, then apply this file again.";
  return rows > 0 ? `${base} ${rows.toLocaleString()} row(s) are affected; nothing was applied.` : base;
}
