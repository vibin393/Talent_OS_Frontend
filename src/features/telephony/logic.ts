/** Pure helpers of the telephony UI (Epic 76, spec B1-B3), unit-tested in `telephony.test.ts`. */
import type { CallOptions, CallStatus, RecordingReason, RefusalCode, TelephonySettings, VoiceCall } from "./types";

export const TERMINAL: CallStatus[] = ["refused", "completed", "no_answer", "busy", "failed", "cancelled"];

export function isTerminal(status: CallStatus): boolean {
  return TERMINAL.includes(status);
}

export function mmss(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Tooltip of the disabled "Call" button per refusal code (spec B1). */
export function refusalTooltip(code: RefusalCode | null, nextWindowAt?: string | null): string | null {
  switch (code) {
    case null:
      return null;
    case "call_phone_not_verified":
      return "Add and verify your calling phone first";
    case "voice_consent_required":
      return "Waiting for the candidate's consent";
    case "outside_calling_hours":
      return nextWindowAt ? `Outside the candidate's calling hours (next: ${timeOf(nextWindowAt)})` : "Outside the candidate's calling hours";
    case "do_not_call":
      return "Do not call — the candidate asked not to be called";
    case "cost_cap_reached":
      return "Today's calling budget is used up";
    case "no_voice_provider":
      return "No calling provider set up — call outside Talent OS";
    case "ecosystem_suspended":
      return "External access is paused by your admin";
    case "call_in_progress":
      return "You already have a call in progress";
    case "no_phone":
      return "The candidate has no phone number to call";
    case "human_only_action":
      return "Only a person can place a call";
  }
}

/** Fallback card "Call outside Talent OS" for provider / budget refusals. */
export function offersManualFallback(code: RefusalCode | null): boolean {
  return code === "no_voice_provider" || code === "cost_cap_reached" || code === "ecosystem_suspended";
}

const RECORDING_REASONS: Record<RecordingReason, string> = {
  policy_not_permitted: "recording isn't allowed in the candidate's location",
  consent_missing: "the candidate didn't consent to recording",
  notice_unavailable: "recording notice isn't set up for this provider",
  provider_unsupported: "this provider can't record calls",
};

/** Pre-call dialog recording badge: "Recorded" / "Not recorded — {reason}". */
export function recordingBadge(o: Pick<CallOptions, "recording_will_be" | "recording_reason">): string {
  if (o.recording_will_be === "recorded") return "Recorded";
  return o.recording_reason ? `Not recorded — ${RECORDING_REASONS[o.recording_reason]}` : "Not recorded";
}

/** Live panel status text (spec B1). `elapsed` is the seconds since the candidate answered. */
export function statusText(call: Pick<VoiceCall, "status" | "duration_s">, candidate: string, elapsed = 0): string {
  switch (call.status) {
    case "requested":
    case "dialing_recruiter":
      return "Ringing your phone…";
    case "dialing_candidate":
      return `Connecting ${candidate}…`;
    case "in_progress":
      return `In call · ${mmss(elapsed)}`;
    case "completed":
      return `Call ended · ${mmss(call.duration_s)}`;
    case "no_answer":
      return "No answer";
    case "busy":
      return "Busy";
    case "failed":
    case "refused":
    case "cancelled":
      return "Call failed";
  }
}

export function recordingLine(call: Pick<VoiceCall, "recorded" | "recording_status">): string {
  if (!call.recorded) return "Recording: not recorded";
  if (call.recording_status === "stored") return "Recording: saved";
  if (call.recording_status === "pending" || call.recording_status === "none") return "Recording: processing";
  return "Recording: not recorded";
}

export function transcriptLine(call: Pick<VoiceCall, "transcript_status">): string {
  if (call.transcript_status === "completed") return "Transcript: ready";
  if (call.transcript_status === "queued" || call.transcript_status === "running") return "Transcript: transcribing";
  return "Transcript: not available — Upload transcript";
}

/** Settings form validation (spec B5): window end after start, cap >= 0, alert 50-95. */
export function settingsErrors(s: Pick<TelephonySettings, "call_window_start" | "call_window_end" | "daily_cost_cap_minor" | "cost_alert_pct">): Record<string, string> {
  const errors: Record<string, string> = {};
  if (s.call_window_end.slice(0, 5) <= s.call_window_start.slice(0, 5)) errors.call_window_end = "Must be after the start";
  if (!Number.isFinite(s.daily_cost_cap_minor) || s.daily_cost_cap_minor < 0) errors.daily_cost_cap_minor = "Must be 0 or more";
  if (!Number.isInteger(s.cost_alert_pct) || s.cost_alert_pct < 50 || s.cost_alert_pct > 95) errors.cost_alert_pct = "Between 50 and 95";
  return errors;
}

export function rupees(minor: number): string {
  return `₹${(minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export const LANGUAGE_LABELS: Record<string, string> = { "en-IN": "English (India)", "hi-IN": "Hindi" };

export function validOtp(code: string): boolean {
  return /^\d{6}$/.test(code);
}
