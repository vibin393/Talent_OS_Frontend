/**
 * Pure helpers of the Screening Agent UI (Epic 57): turn merging for `after_seq` polling, labels, gating rules for
 * the candidate chat and the answer review. Kept free of React so Vitest covers them in the node environment.
 */
import { isApiError } from "@/lib/api/errors";
import type {
  AnswerOut,
  AnswerType,
  CandidateChatStatus,
  ConversationOut,
  ConversationStatus,
  DecimalValue,
  KnockoutOp,
  PortalScreeningChat,
  ScreeningChannel,
  StartChannel,
  Unit,
} from "./types";

export const POLL_MS = 5_000;

/** Turns are append-only and keyed by `seq`: merge an `after_seq` page into what we have (incoming wins), sorted. */
export function mergeTurns<T extends { seq: number }>(current: readonly T[] | null | undefined, incoming: readonly T[] | null | undefined): T[] {
  const bySeq = new Map<number, T>();
  for (const t of current ?? []) bySeq.set(t.seq, t);
  for (const t of incoming ?? []) bySeq.set(t.seq, t);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

/** Highest `seq` we hold (the next poll asks for `after_seq` = this); null when there is none. */
export function lastSeq(turns: readonly { seq: number }[] | null | undefined): number | null {
  if (!turns || turns.length === 0) return null;
  return turns.reduce((max, t) => (t.seq > max ? t.seq : max), turns[0].seq);
}

/** Merge a fresh payload (possibly only new turns) into the previous snapshot of the same chat / conversation. */
export function mergeSnapshot<S extends { turns: { seq: number }[] }>(previous: S | undefined, next: S): S {
  if (!previous) return { ...next, turns: mergeTurns([], next.turns) };
  return { ...next, turns: mergeTurns(previous.turns, next.turns) };
}

// ---------------------------------------------------------------- conversation (recruiter side)
export const OPEN_STATUSES: readonly ConversationStatus[] = ["invited", "consented", "in_progress", "paused"];

export function isOpen(status: ConversationStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

type BadgeColor = "brand" | "success" | "warning" | "danger" | "informative" | "subtle" | "important";

export const STATUS_BADGE: Record<ConversationStatus, { label: string; color: BadgeColor }> = {
  invited: { label: "Invited", color: "informative" },
  consented: { label: "In progress", color: "brand" },
  in_progress: { label: "In progress", color: "brand" },
  paused: { label: "Paused", color: "warning" },
  completed: { label: "Completed", color: "success" },
  reviewed: { label: "Reviewed", color: "success" },
  expired: { label: "Expired", color: "subtle" },
  withdrawn: { label: "Withdrawn", color: "subtle" },
  handed_off: { label: "Handed off", color: "important" },
  taken_over: { label: "Taken over", color: "important" },
  consent_refused: { label: "Consent refused", color: "danger" },
  cancelled: { label: "Cancelled", color: "subtle" },
};

/** "Invited" until the disclosure went out; then "Waiting for consent" until the candidate agrees. */
export function statusBadge(c: Pick<ConversationOut, "status" | "last_outbound_at" | "consented_at">): { label: string; color: BadgeColor } {
  if (c.status === "invited" && c.last_outbound_at && !c.consented_at) return { label: "Waiting for consent", color: "warning" };
  return STATUS_BADGE[c.status] ?? { label: c.status, color: "subtle" };
}

export type ConversationAction = "pause" | "resume" | "take-over" | "cancel";

/** Which recruiter controls apply to a conversation in `status` (all need `screening:conduct`). */
export function availableActions(status: ConversationStatus, canConduct: boolean): ConversationAction[] {
  if (!canConduct) return [];
  const out: ConversationAction[] = [];
  if (status === "invited" || status === "consented" || status === "in_progress") out.push("pause");
  if (status === "paused") out.push("resume");
  if (isOpen(status)) out.push("take-over");
  if (isOpen(status) || status === "taken_over") out.push("cancel");
  return out;
}

/** The recruiter composer exists only after take-over. */
export function canRecruiterMessage(c: Pick<ConversationOut, "status">, canConduct: boolean): boolean {
  return canConduct && c.status === "taken_over";
}

/** WhatsApp outside the 24-hour window accepts only templates. */
export function whatsappWindowClosed(c: Pick<ConversationOut, "channel" | "wa_window_open">): boolean {
  return c.channel === "whatsapp" && !c.wa_window_open;
}

/** `posting:work_mode` → "work mode". Other citation kinds are internal and not shown. */
export function citationSources(citations: readonly string[]): string[] {
  return citations.filter((c) => c.startsWith("posting:")).map((c) => c.slice("posting:".length).replace(/_/g, " "));
}

/** Answers / reviews make sense once the conversation has run. */
export function hasReview(status: ConversationStatus): boolean {
  return ["completed", "reviewed", "handed_off", "taken_over", "expired", "cancelled", "withdrawn"].includes(status);
}

// ---------------------------------------------------------------- start dialog
export const START_CHANNEL_LABELS: Record<StartChannel, string> = {
  auto: "Best available",
  portal_chat: "Candidate portal chat",
  link_chat: "Chat link by email",
  whatsapp: "WhatsApp",
  email: "Email",
};

/** The dialog's choices, in spec order (email-only conversations are not offered from here). */
export const START_CHANNEL_ORDER: readonly StartChannel[] = ["auto", "portal_chat", "link_chat", "whatsapp"];

export const START_ERRORS: Record<string, string> = {
  screening_conversation_open: "An AI screening is already open",
  alternative_process_requested: "The candidate asked for a non-AI process",
  no_channel: "No channel to reach this candidate",
  screening_agent_off: "The Screening Agent is off",
  application_closed: "This application is closed",
};

export function startErrorText(e: unknown): string {
  if (isApiError(e) && START_ERRORS[e.code]) return START_ERRORS[e.code];
  if (isApiError(e) && e.message) return e.message;
  return "Could not start the AI screening. Please try again.";
}

export function blockedText(code: string | null | undefined): string | null {
  if (!code) return null;
  return START_ERRORS[code] ?? code.replace(/_/g, " ");
}

// ---------------------------------------------------------------- candidate chat
export interface CandidateChatState {
  /** Disclosure card with "I agree" / "No thanks" (no questions, no composer before consent). */
  showConsent: boolean;
  /** "Your answer" + "Send". */
  canType: boolean;
  /** "Talk to a person" (stop) stays available until the chat ends. */
  showStop: boolean;
  ended: boolean;
}

export function candidateChatState(chat: Pick<PortalScreeningChat, "status" | "consent_needed" | "can_reply">): CandidateChatState {
  const ended = chat.status === "ended";
  const showConsent = !ended && (chat.consent_needed || chat.status === "waiting_for_consent");
  return {
    showConsent,
    canType: !ended && !showConsent && chat.can_reply && chat.status === "open",
    showStop: !ended,
    ended,
  };
}

export const CHAT_STATUS_LABELS: Record<CandidateChatStatus, string> = {
  waiting_for_consent: "Waiting for you",
  open: "Open",
  paused: "Paused",
  ended: "Ended",
};

/** Accessible attributes of the chat transcript (screen readers announce new messages politely). */
export const CHAT_LOG_A11Y = { role: "log", "aria-live": "polite", "aria-relevant": "additions" } as const;

export const MAX_MESSAGE = 2000;

// ---------------------------------------------------------------- answer review
export function toNumber(value: DecimalValue | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Below the tenant threshold (or flagged by the server, or without a confidence) → highlighted with "Check". */
export function isBelowThreshold(answer: Pick<AnswerOut, "confidence" | "low_confidence" | "flags">, threshold: DecimalValue): boolean {
  if (answer.low_confidence || answer.flags.includes("low_confidence")) return true;
  const c = toNumber(answer.confidence);
  const t = toNumber(threshold) ?? 0.7;
  return c === null || c < t;
}

export function formatConfidence(value: DecimalValue | null | undefined): string {
  const n = toNumber(value);
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

export function isDecided(answer: Pick<AnswerOut, "status">): boolean {
  return answer.status !== "unconfirmed";
}

export interface ReviewGate {
  canComplete: boolean;
  undecided: number;
  lowConfidenceUndecided: number;
  reason: string | null;
}

/** "Complete review" needs every answer decided; low-confidence answers are never bulk-accepted (each is explicit). */
export function reviewGate(answers: readonly Pick<AnswerOut, "status" | "confidence" | "low_confidence" | "flags">[], threshold: DecimalValue, serverAllows = true): ReviewGate {
  const undecided = answers.filter((a) => !isDecided(a));
  const low = undecided.filter((a) => isBelowThreshold(a, threshold));
  let reason: string | null = null;
  if (low.length > 0) reason = `${low.length} low-confidence ${low.length === 1 ? "answer needs" : "answers need"} your check.`;
  else if (undecided.length > 0) reason = `${undecided.length} ${undecided.length === 1 ? "answer needs" : "answers need"} a decision.`;
  else if (!serverAllows) reason = "This review cannot be completed yet.";
  return { canComplete: undecided.length === 0 && serverAllows, undecided: undecided.length, lowConfidenceUndecided: low.length, reason };
}

/** Ids a bulk "Accept confident answers" may accept: undecided and at or above the threshold only. */
export function bulkAcceptable(answers: readonly AnswerOut[], threshold: DecimalValue): string[] {
  return answers.filter((a) => !isDecided(a) && !isBelowThreshold(a, threshold)).map((a) => a.id);
}

/** Display of a normalised value `{value, unit?, currency?}` (falls back to compact JSON). */
export function formatValue(v: Record<string, unknown> | null | undefined, unit?: string | null): string {
  if (!v) return "—";
  if ("value" in v) {
    const raw = v.value;
    const text = typeof raw === "boolean" ? (raw ? "Yes" : "No") : raw === null || raw === undefined ? "—" : Array.isArray(raw) ? raw.join(", ") : String(raw);
    const u = (typeof v.unit === "string" && v.unit) || (typeof v.currency === "string" && v.currency) || unit || "";
    return u && text !== "—" ? `${text} ${u}` : text;
  }
  try {
    return JSON.stringify(v);
  } catch {
    return "—";
  }
}

/** Parse an edited value typed by the reviewer into `{value[, unit]}` for `POST /screening-answers/{id}/decision`. */
export function parseEditedValue(type: string, raw: string, unit?: string | null): Record<string, unknown> | null {
  const text = raw.trim();
  if (!text) return null;
  let value: unknown = text;
  if (type === "number" || type === "money" || type === "rating") {
    const n = Number(text.replace(/,/g, ""));
    if (!Number.isFinite(n)) return null;
    value = n;
  } else if (type === "boolean") {
    const t = text.toLowerCase();
    if (["yes", "y", "true"].includes(t)) value = true;
    else if (["no", "n", "false"].includes(t)) value = false;
    else return null;
  }
  return unit ? { value, unit } : { value };
}

export function turnRef(a: Pick<AnswerOut, "segment_refs" | "start_ms" | "source">): string {
  if (a.source === "voice" && a.start_ms != null) {
    const s = Math.floor(a.start_ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  return a.segment_refs.length ? a.segment_refs.map((n) => `#${n}`).join(", ") : "—";
}

// ---------------------------------------------------------------- questionnaire admin
export const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  text: "Text",
  number: "Number",
  boolean: "Yes / No",
  choice: "Choice",
  money: "Money",
  date: "Date",
  rating: "Rating",
};

export const UNIT_LABELS: Record<Unit, string> = {
  days: "Days",
  weeks: "Weeks",
  months: "Months",
  years: "Years",
  hours: "Hours",
  km: "Kilometres",
  lpa: "LPA",
  percent: "Percent",
};

export const KNOCKOUT_OP_LABELS: Record<KnockoutOp, string> = {
  lt: "Less than",
  lte: "At most",
  gt: "More than",
  gte: "At least",
  eq: "Equals",
  neq: "Not equal to",
  in: "Is one of",
  not_in: "Is not one of",
};

export function knockoutOps(type: AnswerType): KnockoutOp[] {
  switch (type) {
    case "number":
    case "money":
    case "rating":
    case "date":
      return ["lt", "lte", "gt", "gte", "eq", "neq"];
    case "boolean":
      return ["eq"];
    case "choice":
      return ["eq", "neq", "in", "not_in"];
    default:
      return [];
  }
}

/** Coerce a knockout value typed in the editor to the question type (server re-validates: 422 `knockout_invalid`). */
export function knockoutValue(type: AnswerType, op: KnockoutOp, raw: string): unknown {
  if (op === "in" || op === "not_in") return raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (type === "number" || type === "money" || type === "rating") {
    const n = Number(raw);
    return Number.isFinite(n) && raw.trim() !== "" ? n : raw;
  }
  if (type === "boolean") return raw === "true";
  return raw;
}

export const VERSION_STATUS_LABELS = { draft: "Draft", approved: "Approved", retired: "Retired" } as const;

export function needsAcceptance(q: { origin?: string; accepted_by?: string | null }): boolean {
  return q.origin === "ai_generated" && !q.accepted_by;
}

export const CHANNEL_LABELS: Record<ScreeningChannel, string> = {
  portal_chat: "Portal chat",
  link_chat: "Chat link",
  email: "Email",
  whatsapp: "WhatsApp",
};
