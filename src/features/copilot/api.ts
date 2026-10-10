"use client";

/** Epic 54 Copilot API (TanStack Query + `copilotKeys`). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProposalOut } from "@/lib/api/agentic-types";
import { api } from "@/lib/api/client";
import type {
  Conversation,
  ConversationSummary,
  CopilotMessage,
  CopilotSettings,
  CopilotSettingsIn,
  CopilotStatus,
  CopilotUsage,
  FeedbackIn,
  FeedbackOut,
  Page,
  PageContext,
  TurnOut,
} from "./types";

const C = "/api/v1/copilot";
const enc = encodeURIComponent;

function idempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const copilotKeys = {
  all: ["copilot"] as const,
  status: ["copilot", "status"] as const,
  conversations: () => ["copilot", "conversations"] as const,
  conversation: (id: string) => ["copilot", "conversation", id] as const,
  messages: (id: string) => ["copilot", "messages", id] as const,
  proposal: (id: string) => ["copilot", "proposal", id] as const,
  settings: ["copilot", "settings"] as const,
  usage: (from?: string, to?: string) => ["copilot", "usage", from ?? "", to ?? ""] as const,
};

export const copilotApi = {
  status: (signal?: AbortSignal) => api.get<CopilotStatus>(`${C}/status`, { signal }),
  conversations: (signal?: AbortSignal) =>
    api.get<Page<ConversationSummary>>(`${C}/conversations?page_size=50`, { signal }),
  createConversation: (body: { agent_key?: string; page_context?: PageContext | null }) =>
    api.post<Conversation>(`${C}/conversations`, body),
  conversation: (id: string, signal?: AbortSignal) => api.get<Conversation>(`${C}/conversations/${enc(id)}`, { signal }),
  rename: (id: string, title: string) => api.patch<Conversation>(`${C}/conversations/${enc(id)}`, { title }),
  close: (id: string) => api.post<Conversation>(`${C}/conversations/${enc(id)}/close`),
  remove: (id: string) => api.delete<void>(`${C}/conversations/${enc(id)}`),
  messages: (id: string, afterSeq = 0, signal?: AbortSignal) =>
    api.get<CopilotMessage[]>(`${C}/conversations/${enc(id)}/messages?after_seq=${afterSeq}&limit=200`, { signal }),
  ask: (id: string, text: string, pageContext: PageContext | null) =>
    api.post<TurnOut>(
      `${C}/conversations/${enc(id)}/messages`,
      { text, page_context: pageContext },
      { headers: { "Idempotency-Key": idempotencyKey() } },
    ),
  cancel: (runId: string) => api.post<TurnOut>(`${C}/turns/${enc(runId)}/cancel`),
  feedback: (runId: string, body: FeedbackIn) => api.post<FeedbackOut>(`${C}/turns/${enc(runId)}/feedback`, body),
  settings: (signal?: AbortSignal) => api.get<CopilotSettings>(`${C}/settings`, { signal }),
  saveSettings: (body: CopilotSettingsIn) => api.put<CopilotSettings>(`${C}/settings`, body),
  usage: (from?: string, to?: string, signal?: AbortSignal) => {
    const q = [from ? `date_from=${enc(from)}` : "", to ? `date_to=${enc(to)}` : ""].filter(Boolean).join("&");
    return api.get<CopilotUsage>(`${C}/admin/usage${q ? `?${q}` : ""}`, { signal });
  },
  /** Foundation endpoint: turns the Copilot (AI feature `agent_copilot`) on or off. */
  setEnabled: (enabled: boolean) => api.put<unknown>("/api/v1/agents/copilot/enabled", { enabled }),
  proposal: (id: string, signal?: AbortSignal) => api.get<ProposalOut>(`/api/v1/proposals/${enc(id)}`, { signal }),
  confirm: (id: string, editedArgs?: Record<string, unknown> | null) =>
    api.post<ProposalOut>(`/api/v1/proposals/${enc(id)}/confirm`, editedArgs ? { edited_args: editedArgs } : undefined, {
      headers: { "Idempotency-Key": idempotencyKey() },
    }),
  discard: (id: string) => api.post<ProposalOut>(`/api/v1/proposals/${enc(id)}/discard`),
};

export function useCopilotStatus(enabled = true) {
  return useQuery({
    queryKey: copilotKeys.status,
    queryFn: ({ signal }) => copilotApi.status(signal),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: copilotKeys.conversations(),
    queryFn: ({ signal }) => copilotApi.conversations(signal),
    enabled,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: copilotKeys.messages(conversationId ?? "none"),
    queryFn: ({ signal }) => copilotApi.messages(conversationId as string, 0, signal),
    enabled: conversationId !== null,
  });
}

export function useProposal(id: string) {
  return useQuery({ queryKey: copilotKeys.proposal(id), queryFn: ({ signal }) => copilotApi.proposal(id, signal) });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => copilotApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: copilotKeys.all }),
  });
}
