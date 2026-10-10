import { api } from "@/lib/api/client";
import { portalRequest } from "@/lib/api/portal-client";
import type {
  Channel,
  ChannelMessage,
  ChannelSettings,
  ChannelTemplate,
  ChannelTemplateIn,
  ConnectorCreate,
  ConnectorList,
  ConnectorConfig,
  ConnectorUpdate,
  CustomDomain,
  Eligibility,
  EmailThread,
  ManualQueueItem,
  MessagingState,
  OptOut,
  PortalMessaging,
  Recipient,
  ReplyCaptureState,
  SendRequest,
  SendResult,
} from "./types";

const enc = encodeURIComponent;
const C = "/api/v1/comms";

function qs(params: Record<string, string | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** SMS / WhatsApp messaging, reply capture and custom career domains (Epic 33). */
export const messagingApi = {
  // reply capture
  replyCapture: (signal?: AbortSignal) => api.get<ReplyCaptureState>("/api/v1/connections/me/reply-capture", { signal }),
  enableReplyCapture: (provider: string) =>
    api.post<{ authorize_url: string }>(`/api/v1/connections/${enc(provider)}/enable-reply-capture`),
  disableReplyCapture: () => api.post<ReplyCaptureState>("/api/v1/connections/me/reply-capture/disable"),
  emailThread: (emailId: string, signal?: AbortSignal) => api.get<EmailThread>(`/api/v1/emails/${enc(emailId)}/thread`, { signal }),

  // settings
  settings: (signal?: AbortSignal) => api.get<ChannelSettings>(`${C}/channel-settings`, { signal }),
  updateSettings: (body: Partial<ChannelSettings>) => api.patch<ChannelSettings>(`${C}/channel-settings`, body),

  // templates
  templates: (channel: Channel | null, status: string | null = null, signal?: AbortSignal) =>
    api.get<ChannelTemplate[]>(`${C}/channel-templates${qs({ channel, status })}`, { signal }),
  createTemplate: (body: ChannelTemplateIn) => api.post<ChannelTemplate>(`${C}/channel-templates`, body),
  updateTemplate: (id: string, body: Partial<ChannelTemplateIn>) => api.patch<ChannelTemplate>(`${C}/channel-templates/${enc(id)}`, body),
  syncWhatsapp: () => api.post<{ created: number; updated: number }>(`${C}/channel-templates/sync-whatsapp`),

  // sending
  eligibility: (body: SendRequest, signal?: AbortSignal) => api.post<Eligibility[]>(`${C}/messages/eligibility`, body, { signal }),
  send: (body: SendRequest, idempotencyKey: string) =>
    api.post<{ results: SendResult[] }>(`${C}/messages/send`, body, { headers: { "Idempotency-Key": idempotencyKey } }),
  messages: (recipient: Recipient, channel: Channel | null = null, signal?: AbortSignal) =>
    api.get<ChannelMessage[]>(`${C}/messages${qs({ entity_type: recipient.entity_type, entity_id: recipient.entity_id, channel })}`, { signal }),
  state: (recipient: Recipient, signal?: AbortSignal) =>
    api.get<MessagingState>(`${C}/messaging-state/${enc(recipient.entity_type)}/${enc(recipient.entity_id)}`, { signal }),
  attestWhatsapp: (candidateId: string, noticeId: string) =>
    api.post<MessagingState>(`${C}/whatsapp-attestation`, { candidate_id: candidateId, notice_id: noticeId }),

  // opt-outs
  optOuts: (channel: Channel | null, q: string, signal?: AbortSignal) =>
    api.get<OptOut[]>(`${C}/opt-outs${qs({ channel, q: q.trim() })}`, { signal }),
  addOptOut: (body: { channel: Channel; phone_e164: string; reason?: string }) => api.post<OptOut>(`${C}/opt-outs`, body),
  revokeOptOut: (id: string, reason: string) => api.post<OptOut>(`${C}/opt-outs/${enc(id)}/revoke`, { reason }),

  // manual queue / unmatched
  manualQueue: (signal?: AbortSignal) => api.get<ManualQueueItem[]>(`${C}/manual-queue`, { signal }),
  markSent: (id: string) => api.post<unknown>(`${C}/manual-queue/${enc(id)}/mark-sent`),
  markFailed: (id: string, errorCode?: string) =>
    api.post<unknown>(`${C}/manual-queue/${enc(id)}/mark-failed`, errorCode ? { error_code: errorCode } : {}),
  unmatched: (signal?: AbortSignal) => api.get<ChannelMessage[]>(`${C}/inbound/unmatched`, { signal }),

  // connectors
  connectors: (category: Channel, signal?: AbortSignal) => api.get<ConnectorList>(`${C}/connectors?category=${category}`, { signal }),
  createConnector: (body: ConnectorCreate) => api.post<ConnectorConfig>(`${C}/connectors`, body),
  updateConnector: (id: string, body: ConnectorUpdate) => api.patch<ConnectorConfig>(`${C}/connectors/${enc(id)}`, body),
  sendTest: (id: string, toE164: string) => api.post<{ status: string }>(`${C}/connectors/${enc(id)}/send-test`, { to_e164: toE164 }),

  // custom domain
  customDomain: (signal?: AbortSignal) => api.get<CustomDomain | null>("/api/v1/career-site/custom-domain", { signal }),
  addCustomDomain: (host: string) => api.post<CustomDomain>("/api/v1/career-site/custom-domain", { host }),
  removeCustomDomain: () => api.delete<void>("/api/v1/career-site/custom-domain"),
  verifyCustomDomain: () => api.post<CustomDomain>("/api/v1/career-site/custom-domain/verify-now"),
};

/** Candidate-portal messaging preferences (candidate cookie). */
export const portalMessagingApi = {
  get: (signal?: AbortSignal) => portalRequest<PortalMessaging>("/api/v1/portal/messages", { signal }),
  setWhatsapp: (enabled: boolean, noticeId?: string) =>
    portalRequest<PortalMessaging>("/api/v1/portal/messages/whatsapp", {
      method: "PUT",
      body: noticeId ? { enabled, notice_id: noticeId } : { enabled },
    }),
  setSms: (optedOut: boolean) =>
    portalRequest<PortalMessaging>("/api/v1/portal/messages/sms", { method: "PUT", body: { opted_out: optedOut } }),
};

export const messagingKeys = {
  all: ["messaging"] as const,
  replyCapture: ["messaging", "reply-capture"] as const,
  thread: (id: string) => ["messaging", "thread", id] as const,
  settings: ["messaging", "settings"] as const,
  templates: (channel: Channel | null, status: string | null = null) => ["messaging", "templates", channel, status] as const,
  messages: (r: Recipient) => ["messaging", "messages", r.entity_type, r.entity_id] as const,
  state: (r: Recipient) => ["messaging", "state", r.entity_type, r.entity_id] as const,
  optOuts: (channel: Channel | null, q: string) => ["messaging", "opt-outs", channel, q] as const,
  manualQueue: ["messaging", "manual-queue"] as const,
  unmatched: ["messaging", "unmatched"] as const,
  connectors: (c: Channel) => ["messaging", "connectors", c] as const,
  customDomain: ["messaging", "custom-domain"] as const,
  portal: ["portal", "messages"] as const,
};
