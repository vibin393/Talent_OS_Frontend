/** Epic 61 pure helpers: labels, badges, the Submission dialog prefill mapping and client-rules validation. */
import type {
  CheckKey,
  CheckLevel,
  ClientSubmissionRulesIn,
  PackDetailOut,
  PackRateUnit,
  PackResumeKind,
} from "./types";

type BadgeColor = "informative" | "success" | "danger" | "warning" | "subtle" | "brand";

export const AGENT_NAME = "Submission Agent";

export function packBadge(pack: Pick<PackDetailOut, "status" | "lifecycle" | "resume_stale">): { label: string; color: BadgeColor } {
  if (pack.lifecycle === "used") return { label: "Sent", color: "success" };
  if (pack.lifecycle === "discarded") return { label: "Discarded", color: "subtle" };
  if (pack.lifecycle === "stale" || pack.resume_stale) return { label: "Out of date", color: "warning" };
  if (pack.status === "ready") return { label: "Ready to review", color: "success" };
  if (pack.status === "blocked") return { label: "Blocked", color: "danger" };
  return { label: "Draft", color: "informative" };
}

export const LEVEL_LABELS: Record<CheckLevel, { label: string; color: BadgeColor }> = {
  pass: { label: "Pass", color: "success" },
  warn: { label: "Warning", color: "warning" },
  block: { label: "Blocked", color: "danger" },
  needs_input: { label: "Needs input", color: "informative" },
  unavailable: { label: "Not available", color: "subtle" },
};

const CHECK_ORDER: CheckKey[] = ["consent", "margin", "rate_card", "duplicate", "vendor_ownership", "required_fields", "resume_format"];

export function checkLabel(key: CheckKey, clientName: string | null | undefined): string {
  switch (key) {
    case "consent":
      return `Candidate consent for ${clientName || "this client"}`;
    case "margin":
      return "Margin";
    case "rate_card":
      return "Rate card";
    case "duplicate":
      return "Duplicate submission";
    case "vendor_ownership":
      return "Vendor ownership";
    case "required_fields":
      return "Required fields";
    case "resume_format":
      return "Resume format";
  }
}

/** Checks in display order. */
export function orderedChecks<T extends { key: CheckKey }>(checks: T[]): T[] {
  return [...checks].sort((a, b) => CHECK_ORDER.indexOf(a.key) - CHECK_ORDER.indexOf(b.key));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function resumeLine(pack: Pick<PackDetailOut, "resume_kind" | "resume_version" | "resume_uploaded_at">): string {
  if (pack.resume_kind === "client_formatted") return "Client-formatted PDF (no contact details)";
  if (pack.resume_kind === "original") {
    return `Original resume — version ${pack.resume_version ?? 1}, uploaded ${formatDate(pack.resume_uploaded_at)}`;
  }
  return "No resume can be used yet";
}

export function wordCounter(count: number, max: number): string {
  return `${count} / ${max} words`;
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

const FIELD_LABELS: Record<string, string> = {
  resume_kind: "resume",
  pay_rate: "pay rate",
  bill_rate: "bill rate",
  pay_rate_unit: "pay unit",
  bill_rate_unit: "bill unit",
  currency: "currency",
  subject: "subject",
  note: "note to the client",
};

export function changedFieldsText(fields: string[] | null | undefined): string {
  const list = (fields ?? []).map((f) => FIELD_LABELS[f] ?? f.replace(/_/g, " "));
  return list.length ? list.join(", ") : "nothing";
}

export function usedLine(pack: Pick<PackDetailOut, "submission_human_id" | "used_at" | "user_changes">): string {
  return `Sent as ${pack.submission_human_id ?? "a submission"} on ${formatDate(pack.used_at)}. You changed: ${changedFieldsText(
    pack.user_changes?.changed_fields,
  )}.`;
}

export function money(amount: string | null, currency: string | null, unit: PackRateUnit | null, hidden: boolean): string {
  if (hidden) return "Hidden";
  if (amount == null) return "—";
  return `${currency ?? ""} ${amount}${unit ? ` per ${unit}` : ""}`.trim();
}

export function marginText(pack: Pick<PackDetailOut, "checks" | "rates_hidden">): string {
  if (pack.rates_hidden) return "Hidden";
  const margin = pack.checks.find((c) => c.key === "margin");
  const pct = margin?.details?.margin_pct;
  if (typeof pct === "string" || typeof pct === "number") return `${pct}%`;
  return margin?.level === "needs_input" ? "Needs rates" : "—";
}

/** What the P1 Submission dialog pre-fills from a pack (FR-307). Rates stay empty when hidden. */
export interface PackPrefill {
  resumeKind: PackResumeKind;
  payAmount: string | null;
  billAmount: string | null;
  currency: string | null;
  payUnit: PackRateUnit | null;
  billUnit: PackRateUnit | null;
  subject: string | null;
  note: string | null;
}

export function prefillFromPack(pack: PackDetailOut): PackPrefill {
  return {
    resumeKind: pack.resume_kind ?? "original",
    payAmount: pack.rates_hidden ? null : pack.pay_rate,
    billAmount: pack.rates_hidden ? null : pack.bill_rate,
    currency: pack.currency,
    payUnit: pack.pay_rate_unit,
    billUnit: pack.bill_rate_unit,
    subject: pack.email_subject,
    note: pack.summary_text,
  };
}

export function prefillNotice(humanId: string): string {
  return `Pre-filled from submission pack ${humanId} prepared by the Submission Agent. Review everything before you submit.`;
}

export type RulesForm = {
  resume_format: ClientSubmissionRulesIn["resume_format"];
  mask_contact_details: boolean;
  write_up_max_words: string;
  write_up_instructions: string;
  duplicate_window_days: string;
  require_candidate_consent: boolean;
  show_notice_period: boolean;
};

export function rulesErrors(form: RulesForm): Partial<Record<keyof RulesForm, string>> {
  const errors: Partial<Record<keyof RulesForm, string>> = {};
  const words = Number(form.write_up_max_words);
  if (!Number.isInteger(words) || words < 40 || words > 400) errors.write_up_max_words = "Enter a whole number from 40 to 400.";
  if (form.duplicate_window_days.trim()) {
    const days = Number(form.duplicate_window_days);
    if (!Number.isInteger(days) || days < 1 || days > 730) errors.duplicate_window_days = "Enter a whole number from 1 to 730, or leave it empty.";
  }
  if (form.write_up_instructions.length > 1000) errors.write_up_instructions = "Use at most 1,000 characters.";
  return errors;
}

export function rulesBody(form: RulesForm): ClientSubmissionRulesIn {
  return {
    resume_format: form.resume_format,
    mask_contact_details: form.mask_contact_details,
    write_up_max_words: Number(form.write_up_max_words),
    write_up_instructions: form.write_up_instructions.trim() || null,
    duplicate_window_days: form.duplicate_window_days.trim() ? Number(form.duplicate_window_days) : null,
    require_candidate_consent: form.require_candidate_consent,
    show_notice_period: form.show_notice_period,
  };
}

/** Which "prepare" button the empty / footer state shows. */
export function prepareMode(status: { enabled: boolean; paused: boolean } | undefined): "agent" | "manual" | "paused" {
  if (status?.paused) return "paused";
  return status?.enabled ? "agent" : "manual";
}
