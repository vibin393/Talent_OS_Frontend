/**
 * Ledger sync client (Epic 71): settings, ledger mappings, document records and runs, payment suggestions with the
 * ★ confirm, and the reconciliation view. Hand-written DTOs mirror `app/schemas/ledger_sync.py`. `/api/v1/ledger/*`.
 */
import { api, CSRF_HEADER, readCookie } from "@/lib/api/client";
import { filenameFromDisposition } from "@/lib/api/download";
import { ApiError, toApiError } from "@/lib/api/errors";
import type { Page } from "@/lib/api/types";
import type { PaymentIn } from "@/features/receivables/types";

const L = "/api/v1/ledger";
const enc = encodeURIComponent;

export type MappingKind = "revenue" | "gst_output" | "tds_receivable" | "round_off" | "customer" | "item" | "bank_account" | "discount";
export type DocumentKind = "invoice" | "credit_note" | "debit_note" | "payment";
export type RunKind = "push" | "tally_file" | "pull_payments" | "status" | "masters";
export type ReconFlag = "amount_differs" | "status_differs" | "only_in_talent_os" | "only_in_ledger";

export type LedgerSettings = {
  auto_push_on_issue: boolean;
  push_payments: boolean;
  pull_payments_every_minutes: number;
  suggestion_stale_days: number;
};

export type LedgerMappingOut = { id: string; kind: string; key: string; external_ref: string; external_label: string | null };
export type LedgerMappingIn = { kind: MappingKind; key: string; external_ref: string; external_label?: string | null };

export type LedgerMappingPageOut = {
  installation_id: string;
  legal_entity_id: string;
  connector_key: string;
  items: LedgerMappingOut[];
  categories: string[];
  clients: { id: string; name: string; billing_profile_id?: string; billing_profile_name?: string }[];
  sac_codes: string[];
  bank_accounts: { id: string; name: string }[];
};

export type LedgerRecordOut = {
  id: string;
  installation_id: string;
  legal_entity_id: string;
  document_kind: string;
  document_id: string;
  document_version: number;
  status: string;
  external_ref: string | null;
  external_number: string | null;
  message: string | null;
  synced_at: string | null;
  skip_reason: string | null;
  tally_run_id: string | null;
  doc_date: string;
  updated_at: string;
  document_number: string | null;
  client_name: string | null;
  amount: string | null;
  currency: string | null;
};

export type LedgerRunOut = {
  id: string;
  installation_id: string;
  legal_entity_id: string;
  kind: string;
  from_date: string | null;
  to_date: string | null;
  include_masters: boolean;
  status: string;
  counts: Record<string, number>;
  file_id: string | null;
  created_by: string | null;
  created_at: string;
  finished_at: string | null;
  created_by_name: string | null;
};

export type PaymentSuggestionOut = {
  id: string;
  installation_id: string;
  legal_entity_id: string;
  external_ref: string;
  invoice_id: string | null;
  invoice_number: string;
  client_id: string | null;
  amount: string;
  currency: string;
  paid_on: string;
  tds_amount: string | null;
  mode: string | null;
  reference: string | null;
  status: string;
  payment_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  reject_reason: string | null;
  match_note: string | null;
  created_at: string;
  client_name: string | null;
  prefill: Record<string, unknown> | null;
};

export type ReconciliationRowOut = {
  invoice_id: string | null;
  invoice_number: string;
  talent_os_amount: string | null;
  talent_os_outstanding: string | null;
  talent_os_status: string | null;
  ledger_ref: string | null;
  ledger_amount: string | null;
  ledger_balance: string | null;
  ledger_status: string | null;
  difference: string | null;
  flags: string[];
};

export type ReconciliationOut = {
  legal_entity_id: string;
  from_date: string | null;
  to_date: string | null;
  rows: ReconciliationRowOut[];
  ledger_available: boolean;
};

export type DocumentPanelOut = { document_kind: string; document_id: string; record: LedgerRecordOut | null; connector_key: string | null };

export const ledgerKeys = {
  all: ["ledger-sync"] as const,
  settings: ["ledger-sync", "settings"] as const,
  mappings: (inst: string, le: string) => ["ledger-sync", "mappings", inst, le] as const,
  records: (p: Record<string, unknown>) => ["ledger-sync", "records", p] as const,
  runs: (le?: string) => ["ledger-sync", "runs", le ?? ""] as const,
  suggestions: (status?: string, le?: string) => ["ledger-sync", "suggestions", status ?? "", le ?? ""] as const,
  reconciliation: (le: string, from?: string, to?: string, flag?: string) => ["ledger-sync", "recon", le, from ?? "", to ?? "", flag ?? ""] as const,
  document: (kind: string, id: string) => ["ledger-sync", "document", kind, id] as const,
};

async function postDownload(path: string, body: unknown, fallback: string): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "text/csv" };
  const csrf = readCookie("tos_csrf");
  if (csrf) headers[CSRF_HEADER] = csrf;
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body), credentials: "include", cache: "no-store" });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  if (!res.ok) throw toApiError(res.status, await res.json().catch(() => null));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameFromDisposition(res.headers.get("Content-Disposition")) ?? fallback;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const ledgerApi = {
  settings: (signal?: AbortSignal) => api.get<LedgerSettings>(`${L}/settings`, { signal }),
  saveSettings: (body: Partial<LedgerSettings>) => api.put<LedgerSettings>(`${L}/settings`, body),
  mappings: (inst: string, le: string, signal?: AbortSignal) =>
    api.get<LedgerMappingPageOut>(`${L}/installations/${enc(inst)}/entities/${enc(le)}/mappings`, { signal }),
  saveMappings: (inst: string, le: string, items: LedgerMappingIn[]) =>
    api.put<LedgerMappingPageOut>(`${L}/installations/${enc(inst)}/entities/${enc(le)}/mappings`, { items }),
  loadMasters: (inst: string, le: string) => api.post<{ options: Record<string, string> }>(`${L}/installations/${enc(inst)}/entities/${enc(le)}/load-masters`),
  records: (params: { status?: string; kind?: string; legal_entity_id?: string; from?: string; to?: string; page?: number }, signal?: AbortSignal) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, String(v));
    return api.get<Page<LedgerRecordOut>>(`${L}/records?${q.toString()}`, { signal });
  },
  document: (kind: string, id: string, signal?: AbortSignal) => api.get<DocumentPanelOut>(`${L}/documents/${enc(kind)}/${enc(id)}`, { signal }),
  retry: (recordId: string) => api.post<LedgerRecordOut>(`${L}/records/${enc(recordId)}/retry`),
  skip: (recordId: string, reason: string) => api.post<LedgerRecordOut>(`${L}/records/${enc(recordId)}/skip`, { reason }),
  createRun: (body: { kind: RunKind; legal_entity_id: string; installation_id?: string; from_date?: string | null; to_date?: string | null; include_masters?: boolean }, idemKey: string) =>
    api.post<LedgerRunOut>(`${L}/runs`, body, { headers: { "Idempotency-Key": idemKey } }),
  runs: (legal_entity_id?: string, kind?: string, signal?: AbortSignal) => {
    const q = new URLSearchParams();
    if (legal_entity_id) q.set("legal_entity_id", legal_entity_id);
    if (kind) q.set("kind", kind);
    return api.get<Page<LedgerRunOut>>(`${L}/runs?${q.toString()}`, { signal });
  },
  runFileUrl: (runId: string) => `${L}/runs/${enc(runId)}/file`,
  suggestions: (status: string | undefined, legal_entity_id: string | undefined, signal?: AbortSignal) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (legal_entity_id) q.set("legal_entity_id", legal_entity_id);
    return api.get<Page<PaymentSuggestionOut>>(`${L}/payment-suggestions?${q.toString()}`, { signal });
  },
  /** ★ Records the Payment as the confirming user (`payment:record`). A null body uses the server's prefill. */
  confirm: (suggestionId: string, body: PaymentIn | null) => api.post<PaymentSuggestionOut>(`${L}/payment-suggestions/${enc(suggestionId)}/confirm`, body ?? undefined),
  reject: (suggestionId: string, reason: string) => api.post<PaymentSuggestionOut>(`${L}/payment-suggestions/${enc(suggestionId)}/reject`, { reason }),
  reconciliation: (legal_entity_id: string, from?: string, to?: string, flag?: string, signal?: AbortSignal) => {
    const q = new URLSearchParams({ legal_entity_id });
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (flag) q.set("flag", flag);
    return api.get<ReconciliationOut>(`${L}/reconciliation?${q.toString()}`, { signal });
  },
  exportReconciliation: (legal_entity_id: string, from?: string, to?: string, flag?: string) => {
    const q = new URLSearchParams({ legal_entity_id });
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (flag) q.set("flag", flag);
    return postDownload(`${L}/reconciliation/export?${q.toString()}`, {}, "ledger-reconciliation.csv");
  },
};
