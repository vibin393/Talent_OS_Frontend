/** Pure validation of the Candidate Portal dialogs (withdraw, accept/decline offer, privacy requests). */
import { namesMatch } from "./format";

export type WithdrawDraft = { reason: string; note: string };

export function validateWithdraw(d: WithdrawDraft, reasons: readonly { code: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!d.reason) errors.reason = "Choose a reason";
  else if (!reasons.some((r) => r.code === d.reason)) errors.reason = "Choose one of the listed reasons";
  if (d.note.trim().length > 2000) errors.note = "Keep your note under 2000 characters";
  return errors;
}

export type AcceptDraft = { typedName: string; agreed: boolean };

export function validateAccept(d: AcceptDraft, expectedName: string | null | undefined): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!d.typedName.trim()) errors.typedName = "Type your full name to sign";
  else if (!namesMatch(d.typedName, expectedName)) errors.typedName = `Type your name exactly as it appears on the offer${expectedName ? `: ${expectedName}` : ""}`;
  if (!d.agreed) errors.agreed = "Confirm that you accept the terms of this offer";
  return errors;
}

export function validateDecline(reason: string): Record<string, string> {
  return reason.trim().length > 2000 ? { reason: "Keep your reason under 2000 characters" } : {};
}

export type PrivacyRequestDraft = { kind: "correction" | "erasure" | ""; details: string; fields: string[] };

export function validatePrivacyRequest(d: PrivacyRequestDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (d.kind !== "correction" && d.kind !== "erasure") errors.kind = "Choose the type of request";
  if (!d.details.trim()) errors.details = d.kind === "erasure" ? "Tell us what you want erased" : "Describe what needs to be corrected";
  else if (d.details.trim().length > 4000) errors.details = "Keep the description under 4000 characters";
  if (d.fields.length > 20) errors.fields = "Choose at most 20 fields";
  return errors;
}
