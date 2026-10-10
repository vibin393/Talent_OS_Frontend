/**
 * Billing API (Epic 29): internal `/api/v1/billing/*` (tenant session) and the Client Portal
 * `/api/v1/client-portal/invoices` (client session). Issue / note issue / IRN / run start send an Idempotency-Key.
 */
import { api } from "@/lib/api/client";
import { clientPortalRequest } from "@/lib/api/client-portal-client";
import { newIdempotencyKey } from "./logic";
import type {
  BillingSettingsOut,
  CreditNoteIn,
  DebitNoteIn,
  DocDetailOut,
  DocKind,
  DocSummaryOut,
  EinvoiceImportOut,
  IrnIn,
  IssueBatchOut,
  ManualLineIn,
  NoteCapsOut,
  PortalInvoiceDetail,
  PortalInvoiceSummary,
  RunCreate,
  RunDetailOut,
  RunOut,
  SacCodeOut,
  TaxRateOut,
} from "./types";

const enc = encodeURIComponent;
export const B = "/api/v1/billing";
const C = "/api/v1/client-portal/invoices";
const PATH: Record<DocKind, string> = {
  invoice: "invoices",
  credit_note: "credit-notes",
  debit_note: "debit-notes",
};

const idem = (key?: string) => ({
  headers: { "Idempotency-Key": key ?? newIdempotencyKey() },
});

function qs(params: Record<string, string | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export type InvoiceFilters = {
  status?: string;
  einvoice_status?: string;
  delivery_status?: string;
  client_id?: string;
  run_id?: string;
  date_from?: string;
  date_to?: string;
};

export const docPath = (kind: DocKind, id: string) =>
  `${B}/${PATH[kind]}/${enc(id)}`;
export const pdfUrl = (kind: DocKind, id: string) => `${docPath(kind, id)}/pdf`;
export const portalPdfUrl = (kind: DocKind, id: string) =>
  `${C}/${kind}/${enc(id)}/pdf`;

export const billingApi = {
  settings: (signal?: AbortSignal) =>
    api.get<BillingSettingsOut>(`${B}/settings`, { signal }),
  updateSettings: (body: Partial<BillingSettingsOut>) =>
    api.patch<BillingSettingsOut>(`${B}/settings`, body),
  sacCodes: (signal?: AbortSignal) =>
    api.get<SacCodeOut[]>(`${B}/sac-codes`, { signal }),
  taxRates: (signal?: AbortSignal) =>
    api.get<TaxRateOut[]>(`${B}/tax-rates`, { signal }),
  addTaxRate: (body: {
    sac_code: string;
    rate_pct: string;
    effective_from: string;
  }) => api.post<TaxRateOut>(`${B}/tax-rates`, body),

  runs: (signal?: AbortSignal) => api.get<RunOut[]>(`${B}/runs`, { signal }),
  run: (id: string, signal?: AbortSignal) =>
    api.get<RunDetailOut>(`${B}/runs/${enc(id)}`, { signal }),
  createRun: (body: RunCreate, key?: string) =>
    api.post<RunOut>(`${B}/runs`, body, idem(key)),
  discardRun: (id: string) =>
    api.post<RunDetailOut>(`${B}/runs/${enc(id)}/discard`),

  invoices: (filters: InvoiceFilters, signal?: AbortSignal) =>
    api.get<DocSummaryOut[]>(`${B}/invoices${qs(filters)}`, { signal }),
  notes: (
    kind: "credit_note" | "debit_note",
    invoiceId?: string,
    signal?: AbortSignal,
  ) =>
    api.get<DocSummaryOut[]>(
      `${B}/${PATH[kind]}${qs({ invoice_id: invoiceId })}`,
      { signal },
    ),
  doc: (kind: DocKind, id: string, signal?: AbortSignal) =>
    api.get<DocDetailOut>(docPath(kind, id), { signal }),
  addLine: (id: string, body: ManualLineIn) =>
    api.post<DocDetailOut>(`${docPath("invoice", id)}/lines`, body),
  removeLine: (id: string, lineId: string) =>
    api.delete<DocDetailOut>(`${docPath("invoice", id)}/lines/${enc(lineId)}`),
  recompute: (id: string) =>
    api.post<DocDetailOut>(`${docPath("invoice", id)}/recompute`),
  submit: (id: string) =>
    api.post<DocDetailOut>(`${docPath("invoice", id)}/submit`),
  discard: (kind: DocKind, id: string) =>
    api.post<DocDetailOut>(`${docPath(kind, id)}/discard`),
  issue: (kind: DocKind, id: string, docDate?: string, key?: string) =>
    api.post<DocDetailOut>(
      `${docPath(kind, id)}/issue`,
      docDate ? { doc_date: docDate } : {},
      idem(key),
    ),
  issueBatch: (ids: string[], key?: string) =>
    api.post<IssueBatchOut>(
      `${B}/invoices/issue-batch`,
      { invoice_ids: ids },
      idem(key),
    ),
  send: (kind: DocKind, id: string, to: string[]) =>
    api.post<DocDetailOut>(`${docPath(kind, id)}/send`, { to }),
  noteCaps: (id: string, signal?: AbortSignal) =>
    api.get<NoteCapsOut>(`${docPath("invoice", id)}/note-caps`, { signal }),
  createCreditNote: (id: string, body: CreditNoteIn) =>
    api.post<DocDetailOut>(`${docPath("invoice", id)}/credit-notes`, body),
  createDebitNote: (id: string, body: DebitNoteIn) =>
    api.post<DocDetailOut>(`${docPath("invoice", id)}/debit-notes`, body),
  recordIrn: (kind: DocKind, id: string, body: IrnIn, key?: string) =>
    api.post<DocDetailOut>(`${docPath(kind, id)}/irn`, body, idem(key)),
  cancelIrn: (id: string, reason: string, key?: string) =>
    api.post<DocDetailOut>(
      `${docPath("invoice", id)}/irn-cancel`,
      { reason },
      idem(key),
    ),

  pendingIrn: (signal?: AbortSignal) =>
    api.get<DocSummaryOut[]>(`${B}/einvoice/pending`, { signal }),
  exportUrl: (registrationId?: string) =>
    `${B}/einvoice/export${qs({ gst_registration_id: registrationId })}`,
  importResponse: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<EinvoiceImportOut>(`${B}/einvoice/import`, form);
  },
  applyImport: (batchId: string, key?: string) =>
    api.post<{ batch_id: string; applied: number }>(
      `${B}/einvoice/import/${enc(batchId)}/apply`,
      undefined,
      idem(key),
    ),
};

export const portalBillingApi = {
  list: (signal?: AbortSignal) =>
    clientPortalRequest<PortalInvoiceSummary[]>(C, { signal }),
  get: (kind: DocKind, id: string, signal?: AbortSignal) =>
    clientPortalRequest<PortalInvoiceDetail>(`${C}/${kind}/${enc(id)}`, {
      signal,
    }),
};

export const billingKeys = {
  all: ["billing"] as const,
  runs: ["billing", "runs"] as const,
  run: (id: string) => ["billing", "runs", id] as const,
  lists: ["billing", "invoices"] as const,
  list: (f: InvoiceFilters) => ["billing", "invoices", f] as const,
  doc: (kind: DocKind, id: string) => ["billing", "doc", kind, id] as const,
  notes: (kind: string, invoiceId?: string) =>
    ["billing", "notes", kind, invoiceId ?? ""] as const,
  caps: (id: string) => ["billing", "caps", id] as const,
  pendingIrn: ["billing", "pending-irn"] as const,
  settings: ["billing", "settings"] as const,
  sac: ["billing", "sac"] as const,
  rates: ["billing", "rates"] as const,
  portal: ["client-portal", "invoices"] as const,
};
