/** Epic 76 telephony client (internal app). */
import { api } from "@/lib/api/client";
import { newIdempotencyKey } from "@/features/agents/screening/api";
import type { CallOptions, CallPhone, Page, TelephonyNumber, TelephonyNumberIn, TelephonySettings, Usage, VoiceCall } from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

export type CallSubject = { applicationId?: string; candidateId?: string; voiceSessionId?: string };

function subjectQuery(s: CallSubject): string {
  const q = new URLSearchParams();
  if (s.applicationId) q.set("application_id", s.applicationId);
  if (s.candidateId) q.set("candidate_id", s.candidateId);
  if (s.voiceSessionId) q.set("voice_session_id", s.voiceSessionId);
  return q.toString();
}

export const telephonyKeys = {
  all: ["telephony"] as const,
  options: (s: CallSubject) => ["telephony", "options", s.applicationId ?? "", s.candidateId ?? "", s.voiceSessionId ?? ""] as const,
  call: (id: string) => ["telephony", "call", id] as const,
  calls: (sessionId: string) => ["telephony", "calls", sessionId] as const,
  phone: ["telephony", "phone"] as const,
  settings: ["telephony", "settings"] as const,
  numbers: ["telephony", "numbers"] as const,
  usage: (groupBy: string) => ["telephony", "usage", groupBy] as const,
};

export const telephonyApi = {
  options: (s: CallSubject, signal?: AbortSignal) => api.get<CallOptions>(`${V}/telephony/call-options?${subjectQuery(s)}`, { signal }),
  place: (s: CallSubject) =>
    api.post<VoiceCall>(
      `${V}/telephony/calls`,
      { application_id: s.applicationId, candidate_id: s.candidateId, voice_session_id: s.voiceSessionId },
      { headers: { "Idempotency-Key": newIdempotencyKey() } },
    ),
  get: (id: string, signal?: AbortSignal) => api.get<VoiceCall>(`${V}/telephony/calls/${enc(id)}`, { signal }),
  list: (sessionId: string, signal?: AbortSignal) => api.get<Page<VoiceCall>>(`${V}/telephony/calls?voice_session_id=${enc(sessionId)}`, { signal }),
  hangup: (id: string) => api.post<VoiceCall>(`${V}/telephony/calls/${enc(id)}/hangup`, {}),
  doNotCall: (id: string) => api.post<{ recorded: boolean }>(`${V}/telephony/calls/${enc(id)}/do-not-call`, {}),
  phone: (signal?: AbortSignal) => api.get<CallPhone>(`${V}/me/call-phone`, { signal }),
  sendCode: (phone: string) => api.put<CallPhone>(`${V}/me/call-phone`, { phone_e164: phone }),
  verify: (code: string) => api.post<CallPhone>(`${V}/me/call-phone/verify`, { code }),
  removePhone: () => api.delete<void>(`${V}/me/call-phone`),
  settings: (signal?: AbortSignal) => api.get<TelephonySettings>(`${V}/settings/telephony`, { signal }),
  saveSettings: (body: Partial<TelephonySettings>) => api.put<TelephonySettings>(`${V}/settings/telephony`, body),
  numbers: (signal?: AbortSignal) => api.get<TelephonyNumber[]>(`${V}/settings/telephony/numbers`, { signal }),
  addNumber: (body: TelephonyNumberIn) => api.post<TelephonyNumber>(`${V}/settings/telephony/numbers`, body),
  deactivateNumber: (id: string) => api.delete<void>(`${V}/settings/telephony/numbers/${enc(id)}`),
  usage: (groupBy: "user" | "legal_entity" | "day", signal?: AbortSignal) => api.get<Usage>(`${V}/telephony/usage?group_by=${groupBy}`, { signal }),
};
