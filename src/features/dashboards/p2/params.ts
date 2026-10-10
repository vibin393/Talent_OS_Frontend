/** URL state of the Phase 2 dashboard filters: Legal Entities (`le`, repeated) and "As of" (`as_of`). */
import { isIsoDate } from "../date-range";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type P2Params = { legalEntityIds: string[]; asOf: string | null };

type ParamSource = { get(name: string): string | null; getAll(name: string): string[] };

export function parseP2Params(params: ParamSource): P2Params {
  const ids = [...new Set(params.getAll("le").flatMap((v) => v.split(",")))].filter((v) => UUID_RE.test(v));
  const asOf = params.get("as_of");
  return { legalEntityIds: ids, asOf: isIsoDate(asOf) ? asOf : null };
}

/** Merge P2 params into an existing page query string (defaults omitted). */
export function withP2Params(search: string, p: P2Params): string {
  const out = new URLSearchParams(search);
  out.delete("le");
  out.delete("as_of");
  for (const id of p.legalEntityIds) out.append("le", id);
  if (p.asOf) out.set("as_of", p.asOf);
  return out.toString();
}

/** Extra tile query parameters (`legal_entity_ids`, `as_of`) appended to the P1 tile query. */
export function p2TileQuery(base: string, p: P2Params): string {
  const q = new URLSearchParams(base);
  for (const id of p.legalEntityIds) q.append("legal_entity_ids", id);
  if (p.asOf) q.set("as_of", p.asOf);
  return q.toString();
}
