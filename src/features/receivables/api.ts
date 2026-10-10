/**
 * Receivables API (Epic 30): `/api/v1/receivables/*`, `/api/v1/periods/*`, `/api/v1/reconciliation/*` (tenant
 * session) and the Client Portal `/api/v1/client-portal/receivables`. Money-moving and importing calls send an
 * Idempotency-Key (generated once per drawer / dialog open by the caller).
 */
import { api } from "@/lib/api/client";
import { clientPortalRequest } from "@/lib/api/client-portal-client";
import { newIdempotencyKey } from "./logic";
import type {
  ActivityIn,
  ActivityOut,
  AgingOut,
  AllocationIn,
  AllocationOut,
  BankImportOut,
  CheckResultOut,
  CloseEventOut,
  CollectionSettingsOut,
  DisputeOut,
  DocKind,
  DsoOut,
  ExportOut,
  ExportTemplateOut,
  OpenDocumentOut,
  PaymentDetailOut,
  PaymentIn,
  PaymentMode,
  PaymentOut,
  PeriodOut,
  PortalPaymentStatus,
  QueueRow,
  ReconFindingOut,
  ReconRunOut,
  ReminderOut,
  StatementOut,
  TdsOut,
  TdsReceivableRow,
  TdsSectionOut,
  WriteOffRequestOut,
} from "./types";

const enc = encodeURIComponent;
export const RCV = "/api/v1/receivables";
const PER = "/api/v1/periods";
const REC = "/api/v1/reconciliation";
const PORTAL = "/api/v1/client-portal/receivables";

const idem = (key?: string) => ({ headers: { "Idempotency-Key": key ?? newIdempotencyKey() } });

export function qs(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const receivablesKeys = {
  all: ["receivables"] as const,
  payments: (f: Record<string, string | undefined>) => ["receivables", "payments", f] as const,
  payment: (id: string) => ["receivables", "payment", id] as const,
  openDocs: (clientId: string, le: string, currency: string) => ["receivables", "open-docs", clientId, le, currency] as const,
  aging: (le: string, asOf: string, groupBy: string) => ["receivables", "aging", le, asOf, groupBy] as const,
  dso: (le: string, start: string, end: string) => ["receivables", "dso", le, start, end] as const,
  queue: (le: string) => ["receivables", "queue", le] as const,
  activities: (clientId: string) => ["receivables", "activities", clientId] as const,
  collectionSettings: (clientId: string) => ["receivables", "collection-settings", clientId] as const,
  disputes: (status: string) => ["receivables", "disputes", status] as const,
  writeOffs: ["receivables", "write-offs"] as const,
  tds: (f: Record<string, string | undefined>) => ["receivables", "tds", f] as const,
  tdsReceivable: (quarter: string) => ["receivables", "tds-receivable", quarter] as const,
  tdsSections: ["receivables", "tds-sections"] as const,
  statement: (clientId: string, start: string, end: string, currency: string) => ["receivables", "statement", clientId, start, end, currency] as const,
  exports: (le: string) => ["receivables", "exports", le] as const,
  exportTemplates: ["receivables", "export-templates"] as const,
  periods: (le: string, year: number) => ["receivables", "periods", le, year] as const,
  checklist: (id: string) => ["receivables", "checklist", id] as const,
  runs: ["receivables", "recon-runs"] as const,
  findings: (id: string) => ["receivables", "recon-findings", id] as const,
  portalStatement: (start: string, end: string, currency: string) => ["client-portal", "statement", start, end, currency] as const,
  portalStatus: ["client-portal", "payment-status"] as const,
};

export const receivablesApi = {
  // payments
  recordPayment: (body: PaymentIn, key: string) => api.post<PaymentDetailOut>(`${RCV}/payments`, body, idem(key)),
  payments: (f: Record<string, string | undefined>, signal?: AbortSignal) => api.get<PaymentOut[]>(`${RCV}/payments${qs(f)}`, { signal }),
  payment: (id: string, signal?: AbortSignal) => api.get<PaymentDetailOut>(`${RCV}/payments/${enc(id)}`, { signal }),
  allocate: (id: string, allocations: AllocationIn[], key: string) =>
    api.post<PaymentDetailOut>(`${RCV}/payments/${enc(id)}/allocate`, { allocations }, idem(key)),
  reversePayment: (id: string, body: { reason: string; reversal_date?: string | null; reverse_tds: boolean }, key: string) =>
    api.post<PaymentDetailOut>(`${RCV}/payments/${enc(id)}/reverse`, body, idem(key)),
  reverseAllocation: (id: string, reason: string, key: string) =>
    api.post<AllocationOut>(`${RCV}/allocations/${enc(id)}/reverse`, { reason }, idem(key)),
  openDocuments: (clientId: string, le: string, currency: string, signal?: AbortSignal) =>
    api.get<OpenDocumentOut[]>(`${RCV}/open-documents${qs({ client_id: clientId, legal_entity_id: le, currency })}`, { signal }),
  // bank import
  bankPreview: (le: string, file: File, key: string, bankAccountId?: string) => {
    const form = new FormData();
    form.append("legal_entity_id", le);
    if (bankAccountId) form.append("bank_account_id", bankAccountId);
    form.append("file", file);
    void key;
    return api.post<BankImportOut>(`${RCV}/bank-imports`, form);
  },
  bankApply: (batchId: string, rowIds: string[], mode: PaymentMode, key: string) =>
    api.post<BankImportOut>(`${RCV}/bank-imports/${enc(batchId)}/apply`, { row_ids: rowIds, mode }, idem(key)),
  // aging / DSO
  aging: (le: string, asOf: string, groupBy: string, signal?: AbortSignal) =>
    api.get<AgingOut>(`${RCV}/aging${qs({ legal_entity_id: le, as_of: asOf, group_by: groupBy })}`, { signal }),
  agingExportUrl: (le: string, asOf: string, groupBy: string, format: "csv" | "xlsx") =>
    `${RCV}/aging${qs({ legal_entity_id: le, as_of: asOf, group_by: groupBy, format })}`,
  dso: (le: string, start: string, end: string, signal?: AbortSignal) =>
    api.get<DsoOut>(`${RCV}/dso${qs({ legal_entity_id: le, period_start: start, period_end: end })}`, { signal }),
  // collections
  queue: (le: string, signal?: AbortSignal) => api.get<QueueRow[]>(`${RCV}/collections/queue${qs({ legal_entity_id: le })}`, { signal }),
  activities: (clientId: string, signal?: AbortSignal) =>
    api.get<ActivityOut[]>(`${RCV}/collections/activities${qs({ client_id: clientId })}`, { signal }),
  logActivity: (body: ActivityIn) => api.post<ActivityOut>(`${RCV}/collections/activities`, body),
  collectionSettings: (clientId: string, signal?: AbortSignal) =>
    api.get<CollectionSettingsOut>(`${RCV}/collections/clients/${enc(clientId)}/settings`, { signal }),
  putCollectionSettings: (clientId: string, body: { do_not_remind?: boolean; owner_id?: string | null }) =>
    api.put<CollectionSettingsOut>(`${RCV}/collections/clients/${enc(clientId)}/settings`, body),
  sendReminders: (documentIds: string[], subject?: string, body?: string) =>
    api.post<ReminderOut>(`${RCV}/collections/reminders`, { document_ids: documentIds, subject: subject || null, body: body || null }),
  // disputes / write-offs
  disputes: (status: string, signal?: AbortSignal) => api.get<DisputeOut[]>(`${RCV}/disputes${qs({ status })}`, { signal }),
  openDispute: (body: { document_kind: DocKind; document_id: string; amount: string; reason: string }) => api.post<DisputeOut>(`${RCV}/disputes`, body),
  resolveDispute: (id: string, body: { status: DisputeOut["status"]; resolution_note?: string; linked_credit_note_id?: string | null }) =>
    api.post<DisputeOut>(`${RCV}/disputes/${enc(id)}/resolve`, body),
  writeOffs: (signal?: AbortSignal) => api.get<WriteOffRequestOut[]>(`${RCV}/write-offs`, { signal }),
  requestWriteOff: (body: { document_kind: DocKind; document_id: string; amount: string; reason: string }, key: string) =>
    api.post<WriteOffRequestOut>(`${RCV}/write-offs`, body, idem(key)),
  // TDS
  tds: (f: Record<string, string | undefined>, signal?: AbortSignal) => api.get<TdsOut[]>(`${RCV}/tds-deductions${qs(f)}`, { signal }),
  tdsReceivable: (quarter: string, signal?: AbortSignal) => api.get<TdsReceivableRow[]>(`${RCV}/tds-receivable${qs({ quarter })}`, { signal }),
  tdsSections: (signal?: AbortSignal) => api.get<TdsSectionOut[]>(`${RCV}/tds-sections`, { signal }),
  updateCertificate: (id: string, body: { certificate_status: TdsOut["certificate_status"]; certificate_ref?: string | null; certificate_received_at?: string | null }) =>
    api.patch<TdsOut>(`${RCV}/tds-deductions/${enc(id)}/certificate`, body),
  // statements
  statement: (clientId: string, start: string, end: string, currency: string, signal?: AbortSignal) =>
    api.get<StatementOut>(`${RCV}/statements${qs({ client_id: clientId, start, end, currency })}`, { signal }),
  statementPdfUrl: (clientId: string, start: string, end: string, currency: string) =>
    `${RCV}/statements${qs({ client_id: clientId, start, end, currency, format: "pdf" })}`,
  // accounting export
  exportTemplates: (signal?: AbortSignal) => api.get<ExportTemplateOut[]>(`${RCV}/accounting-export-templates`, { signal }),
  exports: (le: string, signal?: AbortSignal) => api.get<ExportOut[]>(`${RCV}/accounting-exports${qs({ legal_entity_id: le })}`, { signal }),
  createExport: (body: { legal_entity_id: string; from_date: string; to_date: string; template_id?: string | null; format: "csv" | "xlsx" }, key: string) =>
    api.post<ExportOut>(`${RCV}/accounting-exports`, body, idem(key)),
  exportDownloadUrl: (id: string) => `${RCV}/accounting-exports/${enc(id)}/download`,
  // periods
  periods: (le: string, year: number, signal?: AbortSignal) => api.get<PeriodOut[]>(`${PER}${qs({ legal_entity_id: le, year })}`, { signal }),
  checklist: (id: string, signal?: AbortSignal) => api.get<CheckResultOut[]>(`${PER}/${enc(id)}/checklist`, { signal }),
  closePeriod: (id: string, acknowledged: string[], key: string) =>
    api.post<PeriodOut>(`${PER}/${enc(id)}/close`, { acknowledged_warnings: acknowledged }, idem(key)),
  requestReopen: (id: string, reason: string) => api.post<CloseEventOut>(`${PER}/${enc(id)}/reopen`, { reason }),
  // reconciliation
  runs: (signal?: AbortSignal) => api.get<ReconRunOut[]>(`${REC}/runs`, { signal }),
  startRun: () => api.post<ReconRunOut>(`${REC}/runs`),
  findings: (id: string, signal?: AbortSignal) => api.get<ReconFindingOut[]>(`${REC}/runs/${enc(id)}/findings`, { signal }),
};

export const portalReceivablesApi = {
  statement: (start: string, end: string, currency: string, signal?: AbortSignal) =>
    clientPortalRequest<StatementOut>(`${PORTAL}/statement${qs({ start, end, currency })}`, { signal }),
  paymentStatus: (signal?: AbortSignal) => clientPortalRequest<PortalPaymentStatus[]>(`${PORTAL}/payment-status`, { signal }),
};
