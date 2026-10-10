/** Pure helpers of the Epic 60 Interview Assistant UI (vitest: `interview-assistant.test.ts`). */
import type { ScorecardDraft } from "@/features/interviews/scorecard";
import type { CaptureStatus, CaptureStatusOut, ConsentState, DraftRating } from "./types";

export const STATUS_BADGES: Record<CaptureStatus, { label: string; color: "informative" | "warning" | "danger" | "success" | "brand" | "subtle" }> = {
  not_requested: { label: "Not requested", color: "subtle" },
  planned: { label: "Planned", color: "informative" },
  consent_pending: { label: "Waiting for consent", color: "warning" },
  blocked: { label: "Not available", color: "danger" },
  uploaded: { label: "Uploaded", color: "brand" },
  processing: { label: "Processing", color: "brand" },
  ready: { label: "Ready", color: "success" },
  erased: { label: "Deleted", color: "subtle" },
};

export const CONSENT_LABELS: Record<ConsentState, string> = { agreed: "Agreed", waiting: "Waiting", refused: "Refused" };

export const TRANSCRIPT_ACCEPT = ".vtt,.txt,.srt,.docx";
export const AUDIO_ACCEPT = ".mp3,.m4a,.wav,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/ogg";
const TRANSCRIPT_EXT = [".vtt", ".txt", ".srt", ".docx"];
const AUDIO_EXT = [".mp3", ".m4a", ".wav", ".ogg"];
const VIDEO_EXT = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".m4v"];

/** Video is refused client-side too (the server refuses it with 422 `unsupported_media`). */
export function isVideoFile(file: Pick<File, "name" | "type">): boolean {
  const name = file.name.toLowerCase();
  return file.type.toLowerCase().startsWith("video/") || VIDEO_EXT.some((e) => name.endsWith(e));
}

export function isTranscriptFile(file: Pick<File, "name">): boolean {
  const name = file.name.toLowerCase();
  return TRANSCRIPT_EXT.some((e) => name.endsWith(e));
}

export function isAudioFile(file: Pick<File, "name" | "type">): boolean {
  if (isVideoFile(file)) return false;
  const name = file.name.toLowerCase();
  return file.type.toLowerCase().startsWith("audio/") || AUDIO_EXT.some((e) => name.endsWith(e));
}

/** The upload drawer's validation message, or null when the selection may be uploaded. */
export function uploadError(transcript: File | null, recording: File | null, attested: boolean): string | null {
  for (const f of [transcript, recording]) {
    if (f && isVideoFile(f)) return "Video files aren't accepted. Only the words are used.";
  }
  if (!transcript && !recording) return "Choose a meeting transcript or a recording.";
  if (transcript && !isTranscriptFile(transcript)) return "Meeting transcripts must be VTT, TXT, SRT or DOCX.";
  if (recording && !isAudioFile(recording)) return "Recordings must be audio: MP3, M4A, WAV or OGG.";
  if (!attested) return "Confirm this is the interview everyone agreed to record.";
  return null;
}

/** "Who is the candidate?" is required before processing when the transcript has unknown speakers. */
export function needsSpeakerStep(status: Pick<CaptureStatusOut, "unknown_speakers"> | null | undefined): boolean {
  return !!status && status.unknown_speakers.length > 0;
}

/** "Recording isn't available: {reason}" -- the first readable reason. */
export function blockedMessage(status: Pick<CaptureStatusOut, "reason_texts">): string {
  return `Recording isn't available: ${status.reason_texts[0] ?? "the recording policy doesn't allow it"}`;
}

/** Whether "Show AI suggestions" starts on (tenant setting; default off). */
export function suggestionsVisibleByDefault(setting: boolean | null | undefined): boolean {
  return setting === true;
}

/** "Use suggestion": fills only that competency's rating; the recommendation is never touched. */
export function applySuggestion(draft: ScorecardDraft, competencyKey: string, rating: number): ScorecardDraft {
  const current = draft.ratings[competencyKey] ?? { rating: null, note: "" };
  return { ...draft, ratings: { ...draft.ratings, [competencyKey]: { ...current, rating } } };
}

export function suggestionFor(ratings: DraftRating[] | undefined, competencyKey: string): DraftRating | undefined {
  return ratings?.find((r) => r.competency_key === competencyKey);
}

/** `mm:ss` of a transcript offset. */
export function formatOffset(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0) return "";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const RECOMMENDATION_NOTE = "Your call — the assistant never suggests a recommendation.";
