/** TDS reconciliation API (Epic 51): `/api/v1/receivables/tds-recon/*`. */
import { api } from "@/lib/api/client";
import type {
  DeductorTan,
  RunUpload,
  TdsCandidate,
  TdsExceptions,
  TdsMatch,
  TdsRun,
  TdsRunDetail,
  TdsStatusRow,
} from "./types";

const R = "/api/v1/receivables/tds-recon";
const enc = encodeURIComponent;

export type TdsFilters = { legal_entity_id?: string | null; fy?: string | null; quarter?: string | null };

function qs(params: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const tdsReconKeys = {
  all: ["tds-recon"] as const,
  runs: (f: TdsFilters) => ["tds-recon", "runs", f] as const,
  run: (id: string) => ["tds-recon", "run", id] as const,
  candidates: (lineId: string) => ["tds-recon", "candidates", lineId] as const,
  exceptions: (f: TdsFilters) => ["tds-recon", "exceptions", f] as const,
  status: (fy: string, le: string | null) => ["tds-recon", "status", fy, le] as const,
  tans: ["tds-recon", "tans"] as const,
};

export const tdsReconApi = {
  runs: (f: TdsFilters, signal?: AbortSignal) => api.get<TdsRun[]>(`${R}/runs${qs(f)}`, { signal }),
  upload: (body: RunUpload) => {
    const form = new FormData();
    if (body.file) form.append("file", body.file);
    form.append("legal_entity_id", body.legal_entity_id);
    form.append("fy", body.fy);
    form.append("quarter", body.quarter);
    form.append("statement_kind", body.statement_kind);
    return api.post<TdsRun>(`${R}/runs`, form);
  },
  run: (id: string, signal?: AbortSignal) => api.get<TdsRunDetail>(`${R}/runs/${enc(id)}`, { signal }),
  candidates: (lineId: string, signal?: AbortSignal) =>
    api.get<TdsCandidate[]>(`${R}/lines/${enc(lineId)}/candidates`, { signal }),
  /** One proposed match, confirmed by an explicit human click. There is deliberately no bulk variant. */
  confirm: (matchId: string) => api.post<TdsMatch>(`${R}/matches/${enc(matchId)}/confirm`),
  reject: (matchId: string) => api.post<TdsMatch>(`${R}/matches/${enc(matchId)}/reject`),
  pair: (lineId: string, tdsDeductionId: string, recordTanMapping: boolean) =>
    api.post<TdsMatch>(`${R}/lines/${enc(lineId)}/match`, {
      tds_deduction_id: tdsDeductionId,
      record_tan_mapping: recordTanMapping,
    }),
  acknowledge: (lineId: string, note: string) => api.post<TdsMatch>(`${R}/lines/${enc(lineId)}/acknowledge`, { note }),
  exceptions: (f: TdsFilters, signal?: AbortSignal) => api.get<TdsExceptions>(`${R}/exceptions${qs(f)}`, { signal }),
  status: (fy: string, legalEntityId: string | null, signal?: AbortSignal) =>
    api.get<TdsStatusRow[]>(`${R}/status${qs({ fy, legal_entity_id: legalEntityId })}`, { signal }),
  tans: (signal?: AbortSignal) => api.get<DeductorTan[]>(`${R}/deductor-tans`, { signal }),
  addTan: (clientId: string, tan: string) => api.post<DeductorTan>(`${R}/deductor-tans`, { client_id: clientId, tan }),
  deleteTan: (id: string) => api.delete<void>(`${R}/deductor-tans/${enc(id)}`),
};
