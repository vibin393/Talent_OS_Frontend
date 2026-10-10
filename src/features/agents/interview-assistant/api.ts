/**
 * Epic 60 Interview Assistant clients: the internal app (`lib/api/client`), the Candidate Portal (`portalRequest`) and
 * the public secure-link pages (no cookies, like `public-links/api`).
 */
import { api } from "@/lib/api/client";
import { ApiError, toApiError } from "@/lib/api/errors";
import { portalRequest } from "@/lib/api/portal-client";
import type {
  AssistantSettings,
  CaptureAckView,
  CaptureStatusOut,
  ConsentRequestsOut,
  DraftOut,
  OutputsOut,
  RecordingAckOut,
  RecordingConsentView,
  RerunOut,
  UploadOut,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

export const interviewAssistantKeys = {
  status: (interviewId: string) => ["interview-capture", interviewId] as const,
  outputs: (interviewId: string) => ["interview-capture", interviewId, "outputs"] as const,
  draft: (interviewId: string) => ["interview-capture", interviewId, "draft"] as const,
  ack: ["interview-recording-ack"] as const,
  settings: ["interview-assistant-settings"] as const,
};

function form(file: File, attest: boolean): FormData {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("attest", attest ? "true" : "false");
  return fd;
}

export const interviewAssistantApi = {
  status: (interviewId: string, signal?: AbortSignal) => api.get<CaptureStatusOut>(`${V}/interviews/${enc(interviewId)}/capture`, { signal }),
  request: (interviewId: string) => api.post<ConsentRequestsOut>(`${V}/interviews/${enc(interviewId)}/capture`, {}),
  askConsent: (interviewId: string) => api.post<ConsentRequestsOut>(`${V}/interviews/${enc(interviewId)}/capture/consent-requests`, {}),
  uploadTranscript: (interviewId: string, file: File, attest: boolean) =>
    api.post<UploadOut>(`${V}/interviews/${enc(interviewId)}/capture/transcript`, form(file, attest)),
  uploadRecording: (interviewId: string, file: File, attest: boolean) =>
    api.post<UploadOut>(`${V}/interviews/${enc(interviewId)}/capture/recording`, form(file, attest)),
  speakers: (interviewId: string, candidateSpeaker: string) =>
    api.post<CaptureStatusOut>(`${V}/interviews/${enc(interviewId)}/capture/speakers`, { candidate_speaker: candidateSpeaker }),
  outputs: (interviewId: string, signal?: AbortSignal) => api.get<OutputsOut>(`${V}/interviews/${enc(interviewId)}/capture/outputs`, { signal }),
  rerun: (interviewId: string) => api.post<RerunOut>(`${V}/interviews/${enc(interviewId)}/capture/rerun`, {}),
  draft: (interviewId: string, signal?: AbortSignal) => api.get<DraftOut>(`${V}/interviews/${enc(interviewId)}/scorecard-draft`, { signal }),
  draftOpened: (interviewId: string) => api.post<DraftOut>(`${V}/interviews/${enc(interviewId)}/scorecard-draft/opened`, {}),
  draftDismiss: (interviewId: string) => api.post<DraftOut>(`${V}/interviews/${enc(interviewId)}/scorecard-draft/dismiss`, {}),
  myAck: (signal?: AbortSignal) => api.get<RecordingAckOut>(`${V}/me/interview-recording-ack`, { signal }),
  giveAck: () => api.post<RecordingAckOut>(`${V}/me/interview-recording-ack`, {}),
  revokeAck: () => api.delete<RecordingAckOut>(`${V}/me/interview-recording-ack`),
  settings: (signal?: AbortSignal) => api.get<AssistantSettings>(`${V}/settings/agents/interview-assistant`, { signal }),
  saveSettings: (body: Partial<AssistantSettings>) => api.put<AssistantSettings>(`${V}/settings/agents/interview-assistant`, body),
};

type Decision = { decision: "agree" | "refuse"; country?: string | null; region?: string | null };

export const portalRecordingApi = {
  view: (interviewId: string) => portalRequest<RecordingConsentView>(`${V}/portal/interviews/${enc(interviewId)}/recording-consent`),
  decide: (interviewId: string, body: Decision) =>
    portalRequest<RecordingConsentView>(`${V}/portal/interviews/${enc(interviewId)}/recording-consent`, { method: "POST", body }),
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

export const publicRecordingApi = {
  consentView: (token: string) => publicRequest<RecordingConsentView>(`${V}/public/interview-recording-consent/${enc(token)}`, "GET"),
  consentDecide: (token: string, body: Decision) =>
    publicRequest<RecordingConsentView>(`${V}/public/interview-recording-consent/${enc(token)}`, "POST", body),
  ackView: (token: string) => publicRequest<CaptureAckView>(`${V}/public/interview-capture-ack/${enc(token)}`, "GET"),
  ack: (token: string) => publicRequest<CaptureAckView>(`${V}/public/interview-capture-ack/${enc(token)}`, "POST", { agree: true }),
};
