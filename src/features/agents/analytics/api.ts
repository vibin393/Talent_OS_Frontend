/** Epic 64 clients: `/analytics/answers/*` (private answers) and the Epic 54 Copilot endpoints the Ask page uses. */
import { api } from "@/lib/api/client";
import type { RunResult } from "@/features/report-builder/types";
import type { AnswerOut, AnswerSummaryOut, ConversationMessage, ConversationSummary, CopilotStatus, Page, TurnOut } from "./types";

const V = "/api/v1";
const A = `${V}/analytics/answers`;
const C = `${V}/copilot`;
const enc = encodeURIComponent;

export const analyticsKeys = {
  all: ["analytics-answers"] as const,
  answer: (id: string) => [...analyticsKeys.all, "answer", id] as const,
  preview: (id: string) => [...analyticsKeys.all, "preview", id] as const,
  byConversation: (conversationId: string) => [...analyticsKeys.all, "conversation", conversationId] as const,
  copilotStatus: () => ["copilot", "status"] as const,
  conversations: () => ["copilot", "conversations", "analytics"] as const,
  messages: (id: string) => ["copilot", "messages", id] as const,
};

export const analyticsApi = {
  get: (id: string, signal?: AbortSignal) => api.get<AnswerOut>(`${A}/${enc(id)}`, { signal }),
  list: (conversationId?: string, signal?: AbortSignal) =>
    api.get<Page<AnswerSummaryOut>>(`${A}?page_size=100${conversationId ? `&conversation_id=${enc(conversationId)}` : ""}`, { signal }),
  preview: (id: string) => api.post<RunResult>(`${A}/${enc(id)}/preview`),
  saved: (id: string, reportId: string) => api.post<AnswerOut>(`${A}/${enc(id)}/saved`, { report_id: reportId }),
};

export const copilotApi = {
  status: (signal?: AbortSignal) => api.get<CopilotStatus>(`${C}/status`, { signal }),
  conversations: (signal?: AbortSignal) => api.get<Page<ConversationSummary>>(`${C}/conversations?page_size=50`, { signal }),
  create: () => api.post<ConversationSummary>(`${C}/conversations`, { agent_key: "analytics" }),
  messages: (id: string, signal?: AbortSignal) => api.get<ConversationMessage[]>(`${C}/conversations/${enc(id)}/messages`, { signal }),
  send: (id: string, text: string) => api.post<TurnOut>(`${C}/conversations/${enc(id)}/messages`, { text }),
};
