import { api } from "@/lib/api/client";
import type {
  BillingAddressIn,
  BillingAddressOut,
  BillingProfileIn,
  BillingProfileOut,
  CommercialsSettingsOut,
  CommercialsSettingsUpdate,
  ContractCreate,
  ContractDocumentKind,
  ContractDocumentOut,
  ContractHistoryItem,
  ContractOut,
  LegalEntityOption,
  MilestoneIn,
  MilestoneOut,
  PaymentTermIn,
  PaymentTermOut,
  PaymentTermUpdate,
  PoConsumptionOut,
  PoPlacementOut,
  PurchaseOrderIn,
  PurchaseOrderOut,
  PurchaseOrderUpdate,
  RateCardImportOut,
  RateCardIn,
  RateCardLine,
  RateCardOut,
  RateCheckOut,
  RateCheckPreviewOut,
  RateCheckRequest,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

function upload(file: File, extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.append("file", file);
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return form;
}

export type ContractFilters = { client_id?: string; type?: string; status?: string; expiring_within_days?: number };
export type PoFilters = { client_id?: string; status?: string; expiring_within_days?: number; over_pct?: number };

export const commercialsApi = {
  // payment terms / settings
  paymentTerms: (includeArchived = false, signal?: AbortSignal) =>
    api.get<PaymentTermOut[]>(`${V}/payment-terms${query({ include_archived: includeArchived || undefined })}`, { signal }),
  createPaymentTerm: (body: PaymentTermIn) => api.post<PaymentTermOut>(`${V}/payment-terms`, body),
  updatePaymentTerm: (id: string, body: PaymentTermUpdate) => api.patch<PaymentTermOut>(`${V}/payment-terms/${enc(id)}`, body),
  archivePaymentTerm: (id: string) => api.post<PaymentTermOut>(`${V}/payment-terms/${enc(id)}/archive`),
  settings: (signal?: AbortSignal) => api.get<CommercialsSettingsOut>(`${V}/commercials/settings`, { signal }),
  updateSettings: (body: CommercialsSettingsUpdate) => api.patch<CommercialsSettingsOut>(`${V}/commercials/settings`, body),
  legalEntities: (signal?: AbortSignal) => api.get<LegalEntityOption[]>(`${V}/legal-entities`, { signal }),

  // billing profile
  billingProfile: (clientId: string, signal?: AbortSignal) =>
    api.get<BillingProfileOut | null>(`${V}/clients/${enc(clientId)}/billing-profile`, { signal }),
  putBillingProfile: (clientId: string, body: BillingProfileIn) =>
    api.put<BillingProfileOut>(`${V}/clients/${enc(clientId)}/billing-profile`, body),
  putBillingContacts: (clientId: string, to: string[], cc: string[]) =>
    api.put<BillingProfileOut>(`${V}/clients/${enc(clientId)}/billing-profile/contacts`, { to, cc }),
  addAddress: (clientId: string, body: BillingAddressIn) =>
    api.post<BillingAddressOut>(`${V}/clients/${enc(clientId)}/billing-addresses`, body),
  updateAddress: (id: string, body: Partial<BillingAddressIn>) => api.patch<BillingAddressOut>(`${V}/billing-addresses/${enc(id)}`, body),
  archiveAddress: (id: string) => api.post<BillingAddressOut>(`${V}/billing-addresses/${enc(id)}/archive`),

  // contracts
  contracts: (filters: ContractFilters, signal?: AbortSignal) => api.get<ContractOut[]>(`${V}/contracts${query(filters)}`, { signal }),
  clientContracts: (clientId: string, signal?: AbortSignal) => api.get<ContractOut[]>(`${V}/clients/${enc(clientId)}/contracts`, { signal }),
  contract: (id: string, signal?: AbortSignal) => api.get<ContractOut>(`${V}/contracts/${enc(id)}`, { signal }),
  createContract: (body: ContractCreate) => api.post<ContractOut>(`${V}/contracts`, body),
  updateContract: (id: string, body: Partial<ContractCreate>) => api.patch<ContractOut>(`${V}/contracts/${enc(id)}`, body),
  submitContract: (id: string) => api.post<ContractOut>(`${V}/contracts/${enc(id)}/submit-for-approval`),
  activateContract: (id: string) => api.post<ContractOut>(`${V}/contracts/${enc(id)}/activate`),
  terminateContract: (id: string, reason: string, termination_date: string) =>
    api.post<ContractOut>(`${V}/contracts/${enc(id)}/terminate`, { reason, termination_date }),
  requestSignature: (id: string, document_file_id: string, signers: { email: string; name?: string; order: number }[]) =>
    api.post<ContractOut>(`${V}/contracts/${enc(id)}/signature-request`, { document_file_id, signers }),
  contractHistory: (id: string, signal?: AbortSignal) => api.get<ContractHistoryItem[]>(`${V}/contracts/${enc(id)}/history`, { signal }),
  contractDocuments: (id: string, signal?: AbortSignal) =>
    api.get<ContractDocumentOut[]>(`${V}/contracts/${enc(id)}/documents`, { signal }),
  uploadContractDocument: (id: string, file: File, kind: ContractDocumentKind) =>
    api.post<ContractDocumentOut>(`${V}/contracts/${enc(id)}/documents`, upload(file, { kind })),
  markDocumentSigned: (docId: string) => api.post<ContractDocumentOut>(`${V}/contract-documents/${enc(docId)}/mark-signed`),
  deleteContractDocument: (docId: string) => api.delete<void>(`${V}/contract-documents/${enc(docId)}`),
  milestones: (id: string, signal?: AbortSignal) => api.get<MilestoneOut[]>(`${V}/contracts/${enc(id)}/milestones`, { signal }),
  addMilestone: (id: string, body: MilestoneIn) => api.post<MilestoneOut>(`${V}/contracts/${enc(id)}/milestones`, body),
  acceptMilestone: (id: string) => api.post<MilestoneOut>(`${V}/contract-milestones/${enc(id)}/accept`),
  cancelMilestone: (id: string) => api.post<MilestoneOut>(`${V}/contract-milestones/${enc(id)}/cancel`),

  // rate cards
  clientRateCards: (clientId: string, signal?: AbortSignal) => api.get<RateCardOut[]>(`${V}/clients/${enc(clientId)}/rate-cards`, { signal }),
  rateCard: (id: string, signal?: AbortSignal) => api.get<RateCardOut>(`${V}/rate-cards/${enc(id)}`, { signal }),
  createRateCard: (body: RateCardIn) => api.post<RateCardOut>(`${V}/rate-cards`, body),
  updateRateCard: (id: string, body: Partial<RateCardIn>) => api.patch<RateCardOut>(`${V}/rate-cards/${enc(id)}`, body),
  putLines: (id: string, lines: RateCardLine[]) => api.put<RateCardOut>(`${V}/rate-cards/${enc(id)}/lines`, { lines }),
  publishRateCard: (id: string) => api.post<RateCardOut>(`${V}/rate-cards/${enc(id)}/publish`),
  archiveRateCard: (id: string) => api.post<RateCardOut>(`${V}/rate-cards/${enc(id)}/archive`),
  newVersion: (id: string) => api.post<RateCardOut>(`${V}/rate-cards/${enc(id)}/new-version`),
  importRateCard: (id: string, file: File, skipInvalid: boolean) =>
    api.post<RateCardImportOut>(`${V}/rate-cards/${enc(id)}/import`, upload(file, { skip_invalid: String(skipInvalid) })),
  templates: (signal?: AbortSignal) => api.get<RateCardOut[]>(`${V}/rate-card-templates`, { signal }),
  createTemplate: (name: string) => api.post<RateCardOut>(`${V}/rate-card-templates`, { name }),
  copyTemplate: (id: string, client_id: string, effective_from: string) =>
    api.post<RateCardOut>(`${V}/rate-card-templates/${enc(id)}/copy`, { client_id, effective_from }),

  // rate checks
  previewRate: (body: RateCheckRequest, signal?: AbortSignal) => api.post<RateCheckPreviewOut>(`${V}/rate-checks/preview`, body, { signal }),
  rateChecks: (subjectKind: string, subjectId: string, signal?: AbortSignal) =>
    api.get<RateCheckOut[]>(`${V}/rate-checks${query({ subject_kind: subjectKind, subject_id: subjectId })}`, { signal }),

  // purchase orders
  purchaseOrders: (filters: PoFilters, signal?: AbortSignal) => api.get<PurchaseOrderOut[]>(`${V}/purchase-orders${query(filters)}`, { signal }),
  clientPurchaseOrders: (clientId: string, signal?: AbortSignal) =>
    api.get<PurchaseOrderOut[]>(`${V}/clients/${enc(clientId)}/purchase-orders`, { signal }),
  purchaseOrder: (id: string, signal?: AbortSignal) => api.get<PurchaseOrderOut>(`${V}/purchase-orders/${enc(id)}`, { signal }),
  createPurchaseOrder: (body: PurchaseOrderIn) => api.post<PurchaseOrderOut>(`${V}/purchase-orders`, body),
  updatePurchaseOrder: (id: string, body: PurchaseOrderUpdate) => api.patch<PurchaseOrderOut>(`${V}/purchase-orders/${enc(id)}`, body),
  closePurchaseOrder: (id: string) => api.post<PurchaseOrderOut>(`${V}/purchase-orders/${enc(id)}/close`),
  cancelPurchaseOrder: (id: string) => api.post<PurchaseOrderOut>(`${V}/purchase-orders/${enc(id)}/cancel`),
  uploadPurchaseOrderDocument: (id: string, file: File) =>
    api.post<PurchaseOrderOut>(`${V}/purchase-orders/${enc(id)}/document`, upload(file)),
  consumptions: (id: string, signal?: AbortSignal) => api.get<PoConsumptionOut[]>(`${V}/purchase-orders/${enc(id)}/consumptions`, { signal }),
  poPlacements: (id: string, signal?: AbortSignal) => api.get<PoPlacementOut[]>(`${V}/purchase-orders/${enc(id)}/placements`, { signal }),
};

export const commercialsKeys = {
  all: ["commercials"] as const,
  paymentTerms: (includeArchived: boolean) => ["commercials", "payment-terms", includeArchived] as const,
  settings: ["commercials", "settings"] as const,
  legalEntities: ["commercials", "legal-entities"] as const,
  billingProfile: (clientId: string) => ["commercials", "billing-profile", clientId] as const,
  contracts: (filters: ContractFilters) => ["commercials", "contracts", filters] as const,
  clientContracts: (clientId: string) => ["commercials", "contracts", "client", clientId] as const,
  contract: (id: string) => ["commercials", "contract", id] as const,
  contractDocs: (id: string) => ["commercials", "contract", id, "documents"] as const,
  contractHistory: (id: string) => ["commercials", "contract", id, "history"] as const,
  milestones: (id: string) => ["commercials", "contract", id, "milestones"] as const,
  clientRateCards: (clientId: string) => ["commercials", "rate-cards", "client", clientId] as const,
  rateCard: (id: string) => ["commercials", "rate-card", id] as const,
  templates: ["commercials", "rate-card-templates"] as const,
  rateChecks: (kind: string, id: string) => ["commercials", "rate-checks", kind, id] as const,
  purchaseOrders: (filters: PoFilters) => ["commercials", "purchase-orders", filters] as const,
  clientPurchaseOrders: (clientId: string) => ["commercials", "purchase-orders", "client", clientId] as const,
  purchaseOrder: (id: string) => ["commercials", "purchase-order", id] as const,
  consumptions: (id: string) => ["commercials", "purchase-order", id, "consumptions"] as const,
  poPlacements: (id: string) => ["commercials", "purchase-order", id, "placements"] as const,
};
