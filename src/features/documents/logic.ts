/** Pure logic for the documents feature (no React): labels, badges, reordering, verify copy, error parsing. */
import { isApiError } from "@/lib/api/errors";
import type { AccessLevel, SignerRole, SignerRoleKind, TemplateKind, VerifyOut } from "./types";

export const TEMPLATE_KIND_LABELS: Record<TemplateKind, string> = {
  employment_agreement: "Employment agreement",
  contractor_agreement: "Contractor agreement",
  nda: "NDA",
  policy: "Policy",
  offer_letter: "Offer letter",
  extension_letter: "Extension letter",
  relieving_letter: "Relieving letter",
  experience_letter: "Experience letter",
  client_form: "Client form",
  other: "Other",
};
export const TEMPLATE_KINDS = Object.keys(TEMPLATE_KIND_LABELS) as TemplateKind[];

export function templateKindLabel(kind: string): string {
  return TEMPLATE_KIND_LABELS[kind as TemplateKind] ?? humanize(kind);
}

export const SIGNER_ROLE_LABELS: Record<SignerRoleKind, string> = {
  worker: "Worker / candidate",
  tenant_signatory: "Company signatory",
  client: "Client",
  vendor: "Vendor",
};

/** Suggested document categories (the API accepts any short text). */
export const DOCUMENT_CATEGORIES = [
  "id_proof",
  "address_proof",
  "education",
  "employment",
  "agreement",
  "nda",
  "policy",
  "offer_letter",
  "payslip",
  "tax",
  "bank",
  "other",
] as const;

/** Category text as stored: "ID proof" -> "id_proof" (max 40 chars). */
export function categorySlug(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 40);
}

export function humanize(value: string): string {
  const s = value.replace(/[_-]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : value;
}

export const ACCESS_LEVELS: AccessLevel[] = ["entity", "hr", "finance"];

/** Label and whether the level is restricted (shown with a shield icon). */
export function accessLevelInfo(level: string): { label: string; restricted: boolean; description: string } {
  switch (level) {
    case "hr":
      return { label: "HR only", restricted: true, description: "Only people with HR document access can open this file." };
    case "finance":
      return { label: "Finance only", restricted: true, description: "Only people with finance document access can open this file." };
    default:
      return { label: "Everyone with access", restricted: false, description: "Anyone who can see the record can open this file." };
  }
}

export type ExpiryState = "none" | "ok" | "soon" | "expired";

/** Expiry badge: expired = danger, within 30 days = warning. `today` is YYYY-MM-DD (local). */
export function expiryBadge(
  expiresOn: string | null | undefined,
  today: string,
): { state: ExpiryState; color: "danger" | "warning" | "informative" | "subtle"; label: string; days: number | null } {
  if (!expiresOn) return { state: "none", color: "subtle", label: "No expiry", days: null };
  const days = daysBetween(today, expiresOn);
  if (days === null) return { state: "none", color: "subtle", label: "No expiry", days: null };
  if (days < 0) return { state: "expired", color: "danger", label: `Expired ${expiresOn}`, days };
  if (days === 0) return { state: "soon", color: "warning", label: "Expires today", days };
  if (days < 30) return { state: "soon", color: "warning", label: `Expires in ${days} day${days === 1 ? "" : "s"}`, days };
  return { state: "ok", color: "informative", label: `Expires ${expiresOn}`, days };
}

function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** Today's date as YYYY-MM-DD in local time. */
export function localToday(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Move `items[index]` one step up (-1) or down (+1); out-of-range moves return the same array. */
export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

/** Signer roles renumbered 1..n in list order (the order sent to the API). */
export function renumberRoles(roles: readonly SignerRole[]): SignerRole[] {
  return roles.map((r, i) => ({ ...r, order: i + 1 }));
}

/** Insert `text` at the selection [start, end) of `value`; returns the new value and caret position. */
export function insertAtCursor(value: string, start: number | null | undefined, end: number | null | undefined, text: string) {
  const s = Math.max(0, Math.min(start ?? value.length, value.length));
  const e = Math.max(s, Math.min(end ?? s, value.length));
  return { value: value.slice(0, s) + text + value.slice(e), caret: s + text.length };
}

export function mergeToken(namespace: string, attr: string): string {
  return `{{ ${namespace}.${attr} }}`;
}

/** Unknown merge fields from a 422 `unknown_merge_field` publish error. */
export function unknownMergeFields(e: unknown): string[] | null {
  if (!isApiError(e) || e.code !== "unknown_merge_field") return null;
  const f = e.details.fields;
  return Array.isArray(f) ? f.filter((x): x is string => typeof x === "string") : [];
}

export type VerifyCopy = { intent: "success" | "warning" | "error"; title: string; body: string };

export function verifyResultCopy(r: Pick<VerifyOut, "match" | "human_id" | "status">): VerifyCopy {
  const ref = r.human_id ? ` (${r.human_id})` : "";
  switch (r.match) {
    case "final":
      return { intent: "success", title: "Matches the signed document", body: `This file is exactly the final signed copy of signature request${ref}.` };
    case "original":
      return {
        intent: "warning",
        title: "Matches the original (unsigned) document",
        body: `This file is the document as sent for signature${ref}, not the final signed copy.`,
      };
    default:
      return { intent: "error", title: "No match", body: "This file does not match any document signed through Talent OS. It may have been changed." };
  }
}

export const REQUEST_STATUS: Record<string, { label: string; color: "brand" | "success" | "warning" | "danger" | "informative" | "subtle" }> = {
  draft: { label: "Draft", color: "subtle" },
  sent: { label: "Sent", color: "brand" },
  partially_signed: { label: "Partially signed", color: "warning" },
  completed: { label: "Completed", color: "success" },
  declined: { label: "Declined", color: "danger" },
  expired: { label: "Expired", color: "danger" },
  cancelled: { label: "Cancelled", color: "subtle" },
};

export function requestStatus(status: string) {
  return REQUEST_STATUS[status] ?? { label: humanize(status), color: "informative" as const };
}

export const SIGNER_STATUS_LABELS: Record<string, string> = {
  pending: "Waiting",
  notified: "Notified",
  signed: "Signed",
  declined: "Declined",
  void: "Not needed",
};

export function canCancelRequest(status: string): boolean {
  return status === "draft" || status === "sent" || status === "partially_signed";
}

const EVENT_LABELS: Record<string, string> = {
  created: "Created",
  sent: "Sent",
  notified: "Signer notified",
  remind: "Reminder sent",
  viewed: "Viewed",
  consented: "Agreed to sign electronically",
  consent: "Agreed to sign electronically",
  otp_sent: "Code sent",
  otp_verified: "Code verified",
  signed: "Signed",
  declined: "Declined",
  complete: "Completed",
  completed: "Completed",
  expired: "Expired",
  cancelled: "Cancelled",
  cancel: "Cancelled",
};

export function eventLabel(kind: string): string {
  return EVENT_LABELS[kind] ?? humanize(kind);
}

/** A file size in KB / MB. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** A signer row in the "Send for signature" drawer before it is sent. */
export type SignerDraft = {
  key: string;
  kind: "candidate" | "user" | "client_user" | "contact" | "vendor_user";
  principal_id?: string | null;
  contact_id?: string | null;
  name: string;
  email: string;
};

/** API payload for the ordered signer list (order is the list order). */
export function toSignerIns(drafts: readonly SignerDraft[]) {
  return drafts.map((d) => ({
    kind: d.kind,
    ...(d.principal_id ? { principal_id: d.principal_id } : {}),
    ...(d.contact_id ? { contact_id: d.contact_id } : {}),
    ...(d.email.trim() ? { email: d.email.trim() } : {}),
    ...(d.name.trim() ? { name: d.name.trim() } : {}),
  }));
}

/** Whether a principal / email is already in the list (no duplicate signers). */
export function hasSigner(drafts: readonly SignerDraft[], candidate: Pick<SignerDraft, "kind" | "principal_id" | "email">): boolean {
  return drafts.some(
    (d) =>
      (candidate.principal_id && d.kind === candidate.kind && d.principal_id === candidate.principal_id) ||
      (!!candidate.email && !!d.email && d.email.trim().toLowerCase() === candidate.email.trim().toLowerCase()),
  );
}

/** `merge_refs` for a request on an owner: the API looks sources up by `<namespace>_id`. */
export function ownerMergeRefs(ownerKind: string, ownerId: string): Record<string, string> {
  return { [`${ownerKind}_id`]: ownerId };
}

/** Human copy for signature-request create errors that carry details. */
export function requestErrorMessage(e: unknown, fallback: string): string {
  if (isApiError(e)) {
    if (e.code === "merge_source_missing") {
      const ns = Array.isArray(e.details.namespaces) ? (e.details.namespaces as unknown[]).filter((x) => typeof x === "string").join(", ") : "";
      return `The template uses merge fields with no data for this record${ns ? ` (${ns})` : ""}. Edit the template or send an existing document instead.`;
    }
    if (e.code === "signer_incomplete") return "Every signer needs a name and an email address.";
    if (e.code === "signer_not_found") return "One of the signers could not be found or is inactive.";
    if (e.code === "template_not_published") return "This template has no published version yet.";
  }
  return fallback;
}

/** Simple email check for external signers (the API is the authority). */
export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()); // NOSONAR
}
