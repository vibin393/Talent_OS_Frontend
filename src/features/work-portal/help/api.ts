/** Worker "Onboarding help" calls (Epic 62 B7, candidate session via `portalRequest`). */
import { portalRequest } from "@/lib/api/portal-client";

const H = "/api/v1/portal/work/help";
const enc = encodeURIComponent;

export type HelpAuthor = "you" | "assistant" | "coordinator" | "system";
export type HelpFeedback = "helpful" | "not_helpful" | "incorrect";

export interface HelpCitation {
  label: string;
  kind: "knowledge" | "task" | "case";
}

export interface HelpMessage {
  id: string;
  seq: number;
  author: HelpAuthor;
  text: string;
  citations: HelpCitation[];
  feedback: HelpFeedback | null;
  sent_at: string;
}

export interface HelpThread {
  id: string;
  status: "open" | "answered" | "handed_off" | "closed";
  coordinator_name: string;
  can_reply: boolean;
  messages: HelpMessage[];
}

export interface HelpThreadSummary {
  id: string;
  status: HelpThread["status"];
  first_question: string;
  last_message_at: string | null;
}

export interface HelpState {
  available: boolean;
  consent_needed: boolean;
  coordinator_name: string;
  notice: { notice_id: string | null; title: string; body_md: string } | null;
  threads: HelpThreadSummary[];
}

export const workHelpApi = {
  state: (signal?: AbortSignal) => portalRequest<HelpState>(H, { signal }),
  consent: (noticeId: string | null) => portalRequest<HelpState>(`${H}/consent`, { method: "POST", body: { decision: "accept", notice_id: noticeId } }),
  thread: (id: string, signal?: AbortSignal) => portalRequest<HelpThread>(`${H}/threads/${enc(id)}`, { signal }),
  ask: (text: string) => portalRequest<HelpThread>(`${H}/threads`, { method: "POST", body: { text } }),
  followUp: (id: string, text: string) => portalRequest<HelpThread>(`${H}/threads/${enc(id)}/messages`, { method: "POST", body: { text } }),
  handoff: (id: string | null) =>
    portalRequest<HelpThread>(id ? `${H}/threads/${enc(id)}/handoff` : `${H}/handoff`, { method: "POST" }),
  feedback: (messageId: string, feedback: HelpFeedback) =>
    portalRequest<HelpThread>(`${H}/messages/${enc(messageId)}/feedback`, { method: "POST", body: { feedback } }),
};

export const workHelpKeys = {
  state: ["work-portal", "help"] as const,
  thread: (id: string) => ["work-portal", "help", id] as const,
};
