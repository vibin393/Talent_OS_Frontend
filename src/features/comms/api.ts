import { api } from "@/lib/api/client";
import type {
  EmailAddressStatusOut,
  EmailMessageOut,
  EmailPreviewIn,
  EmailPreviewOut,
  EmailSendIn,
  EmailSendOut,
  EmailTemplateCreate,
  EmailTemplateDetailOut,
  EmailTemplateKey,
  EmailTemplateOut,
  EmailTemplateUpdate,
  EmailTemplateVariantIn,
  MailboxConnectionOut,
  MergeFieldGroupOut,
  Page,
} from "@/lib/api/types";

const enc = encodeURIComponent;
const T = "/api/v1/email-templates";

/** Email templates, sending and the email log (Epic 10, story 10.1). */
export const commsApi = {
  listTemplates: (key: EmailTemplateKey | null, includeArchived = false, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (key) params.set("key", key);
    if (includeArchived) params.set("include_archived", "true");
    const qs = params.toString();
    return api.get<EmailTemplateOut[]>(qs ? `${T}?${qs}` : T, { signal });
  },
  getTemplate: (id: string, signal?: AbortSignal) => api.get<EmailTemplateDetailOut>(`${T}/${enc(id)}`, { signal }),
  createTemplate: (body: EmailTemplateCreate) => api.post<EmailTemplateDetailOut>(T, body),
  updateTemplate: (id: string, body: EmailTemplateUpdate) => api.patch<EmailTemplateDetailOut>(`${T}/${enc(id)}`, body),
  putVariant: (id: string, language: string, body: EmailTemplateVariantIn) =>
    api.put<EmailTemplateDetailOut>(`${T}/${enc(id)}/variants/${enc(language)}`, body),
  archiveTemplate: (id: string) => api.post<EmailTemplateDetailOut>(`${T}/${enc(id)}/archive`),
  mergeFields: (key: EmailTemplateKey | null, signal?: AbortSignal) =>
    api.get<MergeFieldGroupOut[]>(key ? `${T}/merge-fields?key=${enc(key)}` : `${T}/merge-fields`, { signal }),
  preview: (body: EmailPreviewIn, signal?: AbortSignal) => api.post<EmailPreviewOut>(`${T}/preview`, body, { signal }),

  send: (body: EmailSendIn) => api.post<EmailSendOut>("/api/v1/emails", body),
  addressStatus: (addresses: string[], signal?: AbortSignal) => {
    const params = new URLSearchParams();
    for (const a of addresses) params.append("addresses", a);
    return api.get<EmailAddressStatusOut[]>(`/api/v1/emails/address-status?${params}`, { signal });
  },
  entityEmails: (entity: string, id: string, page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<EmailMessageOut>>(`/api/v1/${enc(entity)}/${enc(id)}/emails?page=${page}&page_size=${pageSize}`, {
      signal,
    }),
  /** The signed-in user's mailbox / calendar connections (Epic 7); decides the compose "From" line. */
  connections: (signal?: AbortSignal) => api.get<MailboxConnectionOut[]>("/api/v1/connections", { signal }),
};

export const commsKeys = {
  all: ["comms"] as const,
  templates: ["comms", "templates"] as const,
  templateList: (key: EmailTemplateKey | null, includeArchived: boolean) =>
    ["comms", "templates", "list", key, includeArchived] as const,
  template: (id: string) => ["comms", "templates", "detail", id] as const,
  mergeFields: (key: EmailTemplateKey | null) => ["comms", "merge-fields", key] as const,
  addressStatus: (addresses: readonly string[]) => ["comms", "address-status", [...addresses].sort((x, y) => (String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0))] as const,
  connections: ["comms", "connections"] as const,
  entityEmails: (entity: string, id: string) => ["comms", "emails", entity, id] as const,
};
