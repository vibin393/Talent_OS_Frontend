/** Pure helpers of the Voice Screening UI (Epic 58), unit-tested in `voice.test.ts`. */
import type { ConsentState, VoiceSession, VoiceSessionStatus } from "./types";

export const TRANSCRIPT_ACCEPT = ".txt,.vtt,.srt,.docx,text/plain,text/vtt";
export const AUDIO_ACCEPT = ".mp3,.m4a,.wav,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/ogg";

export const STATUS_LABELS: Record<VoiceSessionStatus, string> = {
  planned: "Planned",
  consent_pending: "Waiting for consent",
  scheduled: "Scheduled",
  in_progress: "In progress",
  uploaded: "Uploaded",
  processing: "Processing",
  ready_for_review: "Ready for review",
  reviewed: "Reviewed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const CONSENT_WORDS: Record<ConsentState, string> = { granted: "Agreed", refused: "Refused", pending: "Pending" };

export function callChip(state: ConsentState): string {
  return `Call: ${CONSENT_WORDS[state]}`;
}

export function recordingChip(s: Pick<VoiceSession, "recording_consent" | "recording_rule" | "jurisdiction">): string {
  if (s.recording_rule === "not_permitted" || s.recording_rule === "unknown") return `Recording: Not permitted (${s.jurisdiction ?? "unknown location"})`;
  return `Recording: ${CONSENT_WORDS[s.recording_consent]}`;
}

/** Why the recording picker is disabled (null = enabled). */
export function recordingDisabledReason(s: Pick<VoiceSession, "recording_block_reason" | "jurisdiction" | "recording_consent">): string | null {
  if (s.recording_block_reason === "not_permitted") return `Recording isn't permitted for ${s.jurisdiction ?? "this location"}`;
  if (s.recording_block_reason === "missing_consent" || s.recording_consent !== "granted") return "The candidate hasn't agreed to recording";
  return null;
}

/** Upload drawer validation: something to upload and both attestation boxes ticked. */
export function uploadError(transcript: File | null, recording: File | null, consentObtained: boolean, policyFollowed: boolean): string | null {
  if (!transcript && !recording) return "Choose a transcript or a recording.";
  if (!consentObtained || !policyFollowed) return "Tick both statements to upload.";
  return null;
}

/** Playback URL that starts at an answer (`#t=<seconds>`). */
export function playbackAt(url: string, startMs: number | null | undefined): string {
  if (startMs == null || startMs < 0) return url;
  return `${url}#t=${Math.floor(startMs / 1000)}`;
}

export function formatTimestamp(ms: number | null | undefined): string {
  if (ms == null) return "--:--";
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export const OPEN_STATUSES: VoiceSessionStatus[] = ["planned", "consent_pending", "scheduled", "in_progress", "uploaded", "processing"];

export function canUpload(s: VoiceSession): boolean {
  return !["reviewed", "cancelled", "failed"].includes(s.status) && s.voice_consent === "granted";
}

export function canCancel(s: VoiceSession): boolean {
  return OPEN_STATUSES.includes(s.status);
}

/** Consent page validation: a country is required. */
export function consentError(country: string): string | null {
  return country.trim().length >= 2 ? null : "Tell us which country you are in.";
}
