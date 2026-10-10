import { api } from "@/lib/api/client";
import { clientPortalRequest } from "@/lib/api/client-portal-client";
import { ApiError, toApiError } from "@/lib/api/errors";
import type {
  CaseStatus,
  ClientExtensionSummary,
  ClientOffboardingSummary,
  ConversionIn,
  ConversionOut,
  EarlyTerminationIn,
  EndingSoonRow,
  ExitSettingsOut,
  ExitSettingsUpdate,
  ExtensionIn,
  ExtensionOut,
  ExtensionPreviewOut,
  ExtensionRespondIn,
  FeePreviewIn,
  FeePreviewOut,
  ItemCompleteIn,
  LinkOut,
  OffboardingCaseDetail,
  OffboardingCaseOut,
  OffboardingConfirmIn,
  OffboardingStartIn,
  PublicActionResult,
  PublicExtensionView,
  PublicOffboardingView,
  RecordedResponseIn,
  TemplateIn,
  TemplateOut,
  TemplateUpdate,
  UploadedAttachment,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";
const P = `${V}/placements`;

export const exitApi = {
  endingSoon: (withinDays: number, signal?: AbortSignal) =>
    api.get<EndingSoonRow[]>(`${P}/ending-soon?within_days=${withinDays}`, { signal }),

  extensions: (pid: string, signal?: AbortSignal) => api.get<ExtensionOut[]>(`${P}/${enc(pid)}/extensions`, { signal }),
  previewExtension: (pid: string, body: ExtensionIn, signal?: AbortSignal) =>
    api.post<ExtensionPreviewOut>(`${P}/${enc(pid)}/extensions/preview`, body, { signal }),
  proposeExtension: (pid: string, body: ExtensionIn) => api.post<ExtensionOut>(`${P}/${enc(pid)}/extensions`, body),
  extension: (id: string, signal?: AbortSignal) => api.get<ExtensionOut>(`${V}/extensions/${enc(id)}`, { signal }),
  recheck: (id: string) => api.post<ExtensionOut>(`${V}/extensions/${enc(id)}/recheck`),
  requestException: (id: string, reason: string) =>
    api.post<ExtensionOut>(`${V}/extensions/${enc(id)}/request-exception`, { reason }),
  extensionLink: (id: string) => api.post<LinkOut>(`${V}/extensions/${enc(id)}/client-link`),
  recordResponse: (id: string, body: RecordedResponseIn) =>
    api.post<ExtensionOut>(`${V}/extensions/${enc(id)}/client-response`, body),
  confirm: (id: string, sendLetter: boolean) =>
    api.post<ExtensionOut>(`${V}/extensions/${enc(id)}/confirm`, { send_extension_letter: sendLetter }),
  withdraw: (id: string, reason: string) => api.post<ExtensionOut>(`${V}/extensions/${enc(id)}/withdraw`, { reason }),
  /** Evidence upload through the generic attachments API; returns the stored file. */
  uploadEvidence: (extensionId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("category", "other");
    form.append("note", "Client extension response evidence");
    return api.post<UploadedAttachment>(`${V}/extensions/${enc(extensionId)}/attachments`, form);
  },

  conversion: (pid: string, signal?: AbortSignal) => api.get<ConversionOut | null>(`${P}/${enc(pid)}/conversion`, { signal }),
  feePreview: (pid: string, body: FeePreviewIn, signal?: AbortSignal) =>
    api.post<FeePreviewOut>(`${P}/${enc(pid)}/conversion/fee-preview`, body, { signal }),
  convert: (pid: string, body: ConversionIn, idempotencyKey: string) =>
    api.post<ConversionOut>(`${P}/${enc(pid)}/conversion`, body, { headers: { "Idempotency-Key": idempotencyKey } }),

  startOffboarding: (pid: string, body: OffboardingStartIn) =>
    api.post<OffboardingCaseDetail>(`${P}/${enc(pid)}/offboarding`, body),
  earlyTermination: (pid: string, body: EarlyTerminationIn) =>
    api.post<OffboardingCaseDetail>(`${P}/${enc(pid)}/early-termination`, body),
  placementCase: (pid: string, signal?: AbortSignal) =>
    api.get<OffboardingCaseDetail | null>(`${P}/${enc(pid)}/offboarding`, { signal }),

  cases: (status: CaseStatus | "open" | "all", signal?: AbortSignal) =>
    api.get<OffboardingCaseOut[]>(`${V}/offboarding-cases?status=${enc(status)}`, { signal }),
  case: (id: string, signal?: AbortSignal) => api.get<OffboardingCaseDetail>(`${V}/offboarding-cases/${enc(id)}`, { signal }),
  refreshCase: (id: string) => api.post<OffboardingCaseDetail>(`${V}/offboarding-cases/${enc(id)}/refresh`),
  closeCase: (id: string) => api.post<OffboardingCaseDetail>(`${V}/offboarding-cases/${enc(id)}/close`),
  cancelCase: (id: string, reason: string) =>
    api.post<OffboardingCaseDetail>(`${V}/offboarding-cases/${enc(id)}/cancel`, { reason }),
  feedback: (id: string, answers: Record<string, unknown>) =>
    api.post<OffboardingCaseDetail>(`${V}/offboarding-cases/${enc(id)}/feedback`, { answers }),
  caseLink: (id: string) => api.post<LinkOut>(`${V}/offboarding-cases/${enc(id)}/client-link`),
  completeItem: (id: string, body: ItemCompleteIn) =>
    api.post<OffboardingCaseDetail>(`${V}/offboarding-items/${enc(id)}/complete`, body),
  waiveItem: (id: string, reason: string) =>
    api.post<OffboardingCaseDetail>(`${V}/offboarding-items/${enc(id)}/waive`, { reason }),

  settings: (signal?: AbortSignal) => api.get<ExitSettingsOut>(`${V}/offboarding/settings`, { signal }),
  updateSettings: (body: ExitSettingsUpdate) => api.patch<ExitSettingsOut>(`${V}/offboarding/settings`, body),
  templates: (signal?: AbortSignal) => api.get<TemplateOut[]>(`${V}/offboarding/templates`, { signal }),
  createTemplate: (body: TemplateIn) => api.post<TemplateOut>(`${V}/offboarding/templates`, body),
  updateTemplate: (id: string, body: TemplateUpdate) => api.patch<TemplateOut>(`${V}/offboarding/templates/${enc(id)}`, body),
};

export const exitKeys = {
  all: ["placement-exit"] as const,
  endingSoon: (days: number) => ["placement-exit", "ending-soon", days] as const,
  extensions: (pid: string) => ["placement-exit", "extensions", pid] as const,
  conversion: (pid: string) => ["placement-exit", "conversion", pid] as const,
  placementCase: (pid: string) => ["placement-exit", "placement-case", pid] as const,
  cases: (status: string) => ["placement-exit", "cases", status] as const,
  case: (id: string) => ["placement-exit", "case", id] as const,
  settings: ["placement-exit", "settings"] as const,
  templates: ["placement-exit", "templates"] as const,
};

// ---------------------------------------------------------------- Client Portal
const CP = "/api/v1/client-portal/placements";

export const clientExitApi = {
  extensions: (signal?: AbortSignal) => clientPortalRequest<ClientExtensionSummary[]>(`${CP}/extensions`, { signal }),
  respond: (pid: string, extId: string, body: ExtensionRespondIn) =>
    clientPortalRequest<ClientExtensionSummary>(`${CP}/${enc(pid)}/extensions/${enc(extId)}/respond`, { method: "POST", body }),
  offboarding: (signal?: AbortSignal) => clientPortalRequest<ClientOffboardingSummary[]>(`${CP}/offboarding`, { signal }),
  confirmOffboarding: (pid: string, body: OffboardingConfirmIn) =>
    clientPortalRequest<ClientOffboardingSummary>(`${CP}/${enc(pid)}/offboarding/confirm`, { method: "POST", body }),
};

export const clientExitKeys = {
  extensions: ["client-portal", "placement-exit", "extensions"] as const,
  offboarding: ["client-portal", "placement-exit", "offboarding"] as const,
};

// ---------------------------------------------------------------- Secure Link (no session)
async function publicFetch<T>(path: string, method: "GET" | "POST", body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, json);
  return json as T;
}

const L = "/api/v1/public/links";

export const publicExitApi = {
  extension: (token: string, signal?: AbortSignal) =>
    publicFetch<PublicExtensionView>(`${L}/${enc(token)}/extension`, "GET", undefined, signal),
  respondExtension: (token: string, body: ExtensionRespondIn) =>
    publicFetch<PublicActionResult>(`${L}/${enc(token)}/extension`, "POST", body),
  offboarding: (token: string, signal?: AbortSignal) =>
    publicFetch<PublicOffboardingView>(`${L}/${enc(token)}/offboarding`, "GET", undefined, signal),
  confirmOffboarding: (token: string, body: OffboardingConfirmIn) =>
    publicFetch<PublicActionResult>(`${L}/${enc(token)}/offboarding`, "POST", body),
};
