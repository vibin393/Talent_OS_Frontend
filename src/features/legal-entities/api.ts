import { api } from "@/lib/api/client";
import type {
  BankAccountIn,
  BankAccountOut,
  BankAccountUpdate,
  CurrencyOut,
  DocumentSeriesIn,
  DocumentSeriesOut,
  DocumentSeriesUpdate,
  GstRegistrationIn,
  GstRegistrationOut,
  GstStateOut,
  LegalEntityIn,
  LegalEntityOut,
  LegalEntityUpdate,
  LutOut,
  LutPutIn,
  ReadinessOut,
} from "./types";

const V = "/api/v1";
const enc = encodeURIComponent;

export const legalEntityKeys = {
  all: ["legal-entities"] as const,
  list: ["legal-entities", "list"] as const,
  detail: (id: string) => ["legal-entities", "detail", id] as const,
  readiness: (id: string) => ["legal-entities", "readiness", id] as const,
  registrations: (id: string) => ["legal-entities", "registrations", id] as const,
  luts: (registrationId: string) => ["legal-entities", "luts", registrationId] as const,
  bankAccounts: (id: string) => ["legal-entities", "bank-accounts", id] as const,
  series: (id: string) => ["legal-entities", "document-series", id] as const,
  states: ["reference", "gst-states"] as const,
  currencies: ["reference", "currencies"] as const,
};

export const legalEntitiesApi = {
  list: (signal?: AbortSignal) => api.get<LegalEntityOut[]>(`${V}/legal-entities`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<LegalEntityOut>(`${V}/legal-entities/${enc(id)}`, { signal }),
  create: (body: LegalEntityIn) => api.post<LegalEntityOut>(`${V}/legal-entities`, body),
  update: (id: string, body: LegalEntityUpdate) => api.patch<LegalEntityOut>(`${V}/legal-entities/${enc(id)}`, body),
  remove: (id: string) => api.delete<void>(`${V}/legal-entities/${enc(id)}`),
  deactivate: (id: string, reason: string) =>
    api.post<LegalEntityOut>(`${V}/legal-entities/${enc(id)}/deactivate`, { reason: reason.trim() || null }),
  reactivate: (id: string) => api.post<LegalEntityOut>(`${V}/legal-entities/${enc(id)}/reactivate`),
  readiness: (id: string, signal?: AbortSignal) =>
    api.get<ReadinessOut>(`${V}/legal-entities/${enc(id)}/readiness`, { signal }),
  uploadLogo: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<LegalEntityOut>(`${V}/legal-entities/${enc(id)}/logo`, form);
  },
  registrations: (id: string, signal?: AbortSignal) =>
    api.get<GstRegistrationOut[]>(`${V}/legal-entities/${enc(id)}/gst-registrations`, { signal }),
  createRegistration: (id: string, body: GstRegistrationIn) =>
    api.post<GstRegistrationOut>(`${V}/legal-entities/${enc(id)}/gst-registrations`, body),
  updateRegistration: (registrationId: string, body: Partial<GstRegistrationIn>) =>
    api.patch<GstRegistrationOut>(`${V}/gst-registrations/${enc(registrationId)}`, body),
  setRegistrationActive: (registrationId: string, active: boolean) =>
    api.post<GstRegistrationOut>(
      `${V}/gst-registrations/${enc(registrationId)}/${active ? "reactivate" : "deactivate"}`,
    ),
  luts: (registrationId: string, signal?: AbortSignal) =>
    api.get<LutOut[]>(`${V}/gst-registrations/${enc(registrationId)}/luts`, { signal }),
  putLut: (registrationId: string, fiscalYear: string, body: LutPutIn) =>
    api.put<LutOut>(`${V}/gst-registrations/${enc(registrationId)}/luts/${enc(fiscalYear)}`, body),
  bankAccounts: (id: string, signal?: AbortSignal) =>
    api.get<BankAccountOut[]>(`${V}/legal-entities/${enc(id)}/bank-accounts`, { signal }),
  createBankAccount: (id: string, body: BankAccountIn) =>
    api.post<BankAccountOut>(`${V}/legal-entities/${enc(id)}/bank-accounts`, body),
  updateBankAccount: (accountId: string, body: BankAccountUpdate) =>
    api.patch<BankAccountOut>(`${V}/bank-accounts/${enc(accountId)}`, body),
  unmask: (accountId: string) =>
    api.post<{ id: string; account_number: string }>(`${V}/bank-accounts/${enc(accountId)}/unmask`),
  series: (id: string, signal?: AbortSignal) =>
    api.get<DocumentSeriesOut[]>(`${V}/legal-entities/${enc(id)}/document-series`, { signal }),
  createSeries: (id: string, body: DocumentSeriesIn) =>
    api.post<DocumentSeriesOut>(`${V}/legal-entities/${enc(id)}/document-series`, body),
  updateSeries: (seriesId: string, body: DocumentSeriesUpdate) =>
    api.patch<DocumentSeriesOut>(`${V}/document-series/${enc(seriesId)}`, body),
  states: (signal?: AbortSignal) => api.get<GstStateOut[]>(`${V}/reference/gst-states`, { signal }),
  currencies: (signal?: AbortSignal) => api.get<CurrencyOut[]>(`${V}/reference/currencies`, { signal }),
};
