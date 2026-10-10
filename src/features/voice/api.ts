/** Epic 58 Voice Screening clients: the internal app (`lib/api/client`) and the public consent page (no cookies). */
import { api } from "@/lib/api/client";
import { ApiError, toApiError } from "@/lib/api/errors";
import { newIdempotencyKey } from "@/features/agents/screening/api";
import type { Playback, VoiceConsentIn, VoiceConsentView, VoiceSession, VoiceSessionRequestIn, VoiceSettings, VoiceTranscript } from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

export const voiceKeys = {
  all: ["voice"] as const,
  sessions: (applicationId: string) => ["voice", "sessions", applicationId] as const,
  transcript: (sessionId: string) => ["voice", "transcript", sessionId] as const,
  settings: ["voice", "settings"] as const,
};

function attestForm(file: File, consentObtained: boolean, policyFollowed: boolean): FormData {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("consent_obtained", consentObtained ? "true" : "false");
  fd.append("policy_followed", policyFollowed ? "true" : "false");
  return fd;
}

export const voiceApi = {
  list: (applicationId: string, signal?: AbortSignal) => api.get<VoiceSession[]>(`${V}/applications/${enc(applicationId)}/voice-sessions`, { signal }),
  request: (applicationId: string, body: VoiceSessionRequestIn) =>
    api.post<VoiceSession>(`${V}/applications/${enc(applicationId)}/voice-sessions`, body, { headers: { "Idempotency-Key": newIdempotencyKey() } }),
  uploadTranscript: (sessionId: string, file: File, consentObtained: boolean, policyFollowed: boolean) =>
    api.post<VoiceSession>(`${V}/voice-sessions/${enc(sessionId)}/transcript`, attestForm(file, consentObtained, policyFollowed)),
  uploadRecording: (sessionId: string, file: File, consentObtained: boolean, policyFollowed: boolean) =>
    api.post<VoiceSession>(`${V}/voice-sessions/${enc(sessionId)}/recording`, attestForm(file, consentObtained, policyFollowed)),
  transcript: (sessionId: string, signal?: AbortSignal) => api.get<VoiceTranscript>(`${V}/voice-sessions/${enc(sessionId)}/transcript`, { signal }),
  speakers: (sessionId: string, seqs: number[]) =>
    api.post<VoiceSession>(`${V}/voice-sessions/${enc(sessionId)}/speakers`, { segment_seqs_as_candidate: seqs }),
  playback: (sessionId: string) => api.get<Playback>(`${V}/voice-sessions/${enc(sessionId)}/playback`),
  cancel: (sessionId: string) => api.post<VoiceSession>(`${V}/voice-sessions/${enc(sessionId)}/cancel`, {}),
  completeReview: (sessionId: string) => api.post<VoiceSession>(`${V}/voice-sessions/${enc(sessionId)}/complete-review`, {}),
  settings: (signal?: AbortSignal) => api.get<VoiceSettings>(`${V}/settings/agents/voice-screening`, { signal }),
  saveSettings: (body: Partial<VoiceSettings>) => api.put<VoiceSettings>(`${V}/settings/agents/voice-screening`, body),
};

async function publicRequest<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch {
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
  return parsed as T;
}

export const publicVoiceApi = {
  view: (token: string) => publicRequest<VoiceConsentView>(`${V}/public/voice-consent/${enc(token)}`, "GET"),
  decide: (token: string, body: VoiceConsentIn) => publicRequest<VoiceConsentView>(`${V}/public/voice-consent/${enc(token)}`, "POST", body),
};
