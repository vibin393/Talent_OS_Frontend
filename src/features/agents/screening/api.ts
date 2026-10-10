/**
 * Epic 57 Screening Agent clients: the internal app (`lib/api/client`), the Candidate Portal (`portalRequest`,
 * candidate cookie + CSRF) and the public secure-link chat (no cookies, like `public-links/api`).
 */
import { api } from "@/lib/api/client";
import { ApiError, toApiError } from "@/lib/api/errors";
import { portalRequest } from "@/lib/api/portal-client";
import type {
  AnswerDecisionIn,
  AnswerOut,
  BindingIn,
  BindingOut,
  ChatConsentIn,
  ConversationDetailOut,
  ConversationOut,
  GeneratedQuestionsOut,
  PortalScreeningChat,
  PortalScreeningChatSummary,
  ReviewOut,
  ReviewTarget,
  ScreeningAgentSettingsIn,
  ScreeningAgentSettingsOut,
  StartChannel,
  StartOptionsOut,
  TurnOut,
  VersionCreate,
  VersionOut,
  VersionUpdate,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

function afterSeq(after: number | null | undefined): string {
  return after != null && after > 0 ? `?after_seq=${after}` : "";
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const screeningAgentApi = {
  // ---------------------------------------------------------------- questionnaire versions & bindings
  versions: (questionnaireId: string, signal?: AbortSignal) =>
    api.get<VersionOut[]>(`${V}/screening-questionnaires/${enc(questionnaireId)}/versions`, { signal }),
  createVersion: (questionnaireId: string, body: VersionCreate = {}) =>
    api.post<VersionOut>(`${V}/screening-questionnaires/${enc(questionnaireId)}/versions`, body),
  updateVersion: (versionId: string, body: VersionUpdate) =>
    api.patch<VersionOut>(`${V}/screening-questionnaire-versions/${enc(versionId)}`, body),
  approveVersion: (versionId: string) =>
    api.post<VersionOut>(`${V}/screening-questionnaire-versions/${enc(versionId)}/approve`),
  acceptQuestion: (versionId: string, questionId: string) =>
    api.post<VersionOut>(`${V}/screening-questionnaire-versions/${enc(versionId)}/questions/${enc(questionId)}/accept`),
  removeQuestion: (versionId: string, questionId: string) =>
    api.delete<VersionOut>(`${V}/screening-questionnaire-versions/${enc(versionId)}/questions/${enc(questionId)}`),
  generateQuestions: (questionnaireId: string, demandId: string) =>
    api.post<GeneratedQuestionsOut>(`${V}/screening-questionnaires/${enc(questionnaireId)}/generate-questions`, { demand_id: demandId }),
  bindings: (questionnaireId: string, signal?: AbortSignal) =>
    api.get<BindingOut[]>(`${V}/screening-questionnaires/${enc(questionnaireId)}/bindings`, { signal }),
  bind: (questionnaireId: string, body: BindingIn) =>
    api.put<BindingOut>(`${V}/screening-questionnaires/${enc(questionnaireId)}/bindings`, body),
  unbind: (questionnaireId: string, binding: BindingIn) => {
    const params = new URLSearchParams({ scope_kind: binding.scope_kind });
    if (binding.scope_id) params.set("scope_id", binding.scope_id);
    return api.delete<void>(`${V}/screening-questionnaires/${enc(questionnaireId)}/bindings?${params}`);
  },

  // ---------------------------------------------------------------- conversations
  startOptions: (applicationId: string, signal?: AbortSignal) =>
    api.get<StartOptionsOut>(`${V}/applications/${enc(applicationId)}/screening-start-options`, { signal }),
  start: (applicationId: string, channel: StartChannel, idempotencyKey: string) =>
    api.post<ConversationOut>(`${V}/applications/${enc(applicationId)}/screening-conversations`, { channel }, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  conversations: (applicationId: string, signal?: AbortSignal) =>
    api.get<ConversationOut[]>(`${V}/applications/${enc(applicationId)}/screening-conversations`, { signal }),
  conversation: (id: string, after: number | null, signal?: AbortSignal) =>
    api.get<ConversationDetailOut>(`${V}/screening-conversations/${enc(id)}${afterSeq(after)}`, { signal }),
  action: (id: string, action: "pause" | "resume" | "take-over" | "cancel", reason?: string | null) =>
    api.post<ConversationOut>(`${V}/screening-conversations/${enc(id)}/${action}`, reason ? { reason } : {}),
  sendMessage: (id: string, body: string) => api.post<TurnOut>(`${V}/screening-conversations/${enc(id)}/messages`, { body }),

  // ---------------------------------------------------------------- review
  review: (target: ReviewTarget, signal?: AbortSignal) => {
    const qs = target.conversationId ? `conversation_id=${enc(target.conversationId)}` : `voice_session_id=${enc(target.voiceSessionId ?? "")}`;
    return api.get<ReviewOut>(`${V}/screening-reviews?${qs}`, { signal });
  },
  decide: (answerId: string, body: AnswerDecisionIn) => api.post<AnswerOut>(`${V}/screening-answers/${enc(answerId)}/decision`, body),
  completeReview: (target: ReviewTarget) =>
    api.post<ReviewOut>(
      `${V}/screening-reviews/complete`,
      target.conversationId ? { conversation_id: target.conversationId } : { voice_session_id: target.voiceSessionId },
    ),

  // ---------------------------------------------------------------- settings
  settings: (signal?: AbortSignal) => api.get<ScreeningAgentSettingsOut>(`${V}/settings/agents/screening`, { signal }),
  updateSettings: (body: ScreeningAgentSettingsIn) => api.put<ScreeningAgentSettingsOut>(`${V}/settings/agents/screening`, body),
};

export const screeningAgentKeys = {
  all: ["screening-agent"] as const,
  versions: (questionnaireId: string) => ["screening-agent", "versions", questionnaireId] as const,
  bindings: (questionnaireId: string) => ["screening-agent", "bindings", questionnaireId] as const,
  startOptions: (applicationId: string) => ["screening-agent", "start-options", applicationId] as const,
  conversations: (applicationId: string) => ["screening-agent", "conversations", applicationId] as const,
  conversation: (id: string) => ["screening-agent", "conversation", id] as const,
  review: (target: ReviewTarget) => ["screening-agent", "review", target.conversationId ?? `voice:${target.voiceSessionId}`] as const,
  settings: ["screening-agent", "settings"] as const,
  portalChats: ["portal", "screening-chats"] as const,
  portalChat: (id: string) => ["portal", "screening-chats", id] as const,
  publicChat: (token: string) => ["public-screening-chat", token] as const,
};

/** One candidate-facing chat transport (portal session or secure link); the chat component is agnostic of it. */
export interface CandidateChatSource {
  key: readonly unknown[];
  get: (after: number | null, signal?: AbortSignal) => Promise<PortalScreeningChat>;
  consent: (body: ChatConsentIn) => Promise<PortalScreeningChat>;
  send: (body: string) => Promise<PortalScreeningChat>;
  handoff: () => Promise<PortalScreeningChat>;
}

// ---------------------------------------------------------------- Candidate Portal
const P = `${V}/portal/screening-chats`;

export const portalScreeningChatApi = {
  list: (signal?: AbortSignal) => portalRequest<PortalScreeningChatSummary[]>(P, { signal }),
  source: (id: string): CandidateChatSource => ({
    key: screeningAgentKeys.portalChat(id),
    get: (after, signal) => portalRequest<PortalScreeningChat>(`${P}/${enc(id)}${afterSeq(after)}`, { signal }),
    consent: (body) => portalRequest<PortalScreeningChat>(`${P}/${enc(id)}/consent`, { method: "POST", body }),
    send: (body) => portalRequest<PortalScreeningChat>(`${P}/${enc(id)}/messages`, { method: "POST", body: { body } }),
    handoff: () => portalRequest<PortalScreeningChat>(`${P}/${enc(id)}/handoff`, { method: "POST", body: {} }),
  }),
};

// ---------------------------------------------------------------- public secure link (`agent_conversation`)
async function publicRequest<T>(path: string, method: "GET" | "POST", body?: unknown, signal?: AbortSignal): Promise<T> {
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
  let parsed: unknown = null;
  try {
    const text = await res.text();
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) throw toApiError(res.status, parsed);
  if (parsed === null) throw new ApiError(res.status, "invalid_response", "Unexpected response from server");
  return parsed as T;
}

export const publicScreeningChatApi = {
  source: (token: string): CandidateChatSource => {
    const base = `${V}/public/screening-chat/${enc(token)}`;
    return {
      key: screeningAgentKeys.publicChat(token),
      get: (after, signal) => publicRequest<PortalScreeningChat>(`${base}${afterSeq(after)}`, "GET", undefined, signal),
      consent: (body) => publicRequest<PortalScreeningChat>(`${base}/consent`, "POST", body),
      send: (body) => publicRequest<PortalScreeningChat>(`${base}/messages`, "POST", { body }),
      handoff: () => publicRequest<PortalScreeningChat>(`${base}/handoff`, "POST", {}),
    };
  },
};
