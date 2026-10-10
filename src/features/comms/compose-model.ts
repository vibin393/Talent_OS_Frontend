/** Pure state helpers for the compose dialog (recipients, drafts, template overwrite, send body). */
import type {
  EmailAddressStatusOut,
  EmailContextRefs,
  EmailRecipientIn,
  EmailSendIn,
  EmailTemplateKey,
  MailboxConnectionOut,
} from "@/lib/api/types";
import { htmlToText, isEmptyHtml } from "./merge-tokens";

export type RecipientEntityType = "candidate" | "contact";

/** A person chip in To / Cc: an entity (its email is resolved by the server) or a bare address. */
export type ComposeRecipient = {
  key: string;
  name: string;
  address: string | null;
  entityType?: RecipientEntityType;
  entityId?: string;
};

export type ComposeEntityType = "candidate" | "contact" | "client" | "demand" | "application";

/** Where the dialog was opened from: drives merge values, related timelines, suggestions and the draft key. */
export type ComposeContext = {
  entityType: ComposeEntityType;
  entityId: string;
  /** Human label of the entity, e.g. "Priya Sharma" or "REQ-1001". */
  label: string;
  contextRefs: EmailContextRefs;
  related: { entity_type: string; entity_id: string }[];
  /** People offered in the To / Cc pickers. */
  suggested: ComposeRecipient[];
  /** Pre-filled To. */
  initialTo: ComposeRecipient[];
};

export type ComposeDraft = {
  to: ComposeRecipient[];
  cc: ComposeRecipient[];
  subject: string;
  bodyHtml: string;
  templateVariantId: string | null;
  templateKey: EmailTemplateKey;
  /** Subject + body as last inserted from a template (or empty); edits beyond it need confirmation. */
  pristine: { subject: string; bodyHtml: string };
};

export function emptyDraft(ctx: Pick<ComposeContext, "initialTo">): ComposeDraft {
  return {
    to: ctx.initialTo,
    cc: [],
    subject: "",
    bodyHtml: "",
    templateVariantId: null,
    templateKey: "custom",
    pristine: { subject: "", bodyHtml: "" },
  };
}

const CANDIDATE_KEYS: EmailTemplateKey[] = [
  "interview_invite",
  "interview_reminder",
  "rejection",
  "offer",
  "application_confirmation",
  "ai_screening_invite",
  "custom",
];
const CLIENT_KEYS: EmailTemplateKey[] = ["submission", "client_feedback_request", "custom"];

/** Template keys offered by "Insert template" for a context. */
export function templateKeysFor(entityType: ComposeEntityType): EmailTemplateKey[] {
  return entityType === "candidate" || entityType === "application" ? CANDIDATE_KEYS : CLIENT_KEYS;
}

// ---------------------------------------------------------------- drafts (sessionStorage, per entity)
export function draftKey(ctx: Pick<ComposeContext, "entityType" | "entityId">): string {
  return `tos.compose.${ctx.entityType}.${ctx.entityId}`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function session(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function isDraft(v: unknown): v is ComposeDraft {
  if (typeof v !== "object" || v === null) return false;
  const d = v as Record<string, unknown>;
  return (
    Array.isArray(d.to) &&
    Array.isArray(d.cc) &&
    typeof d.subject === "string" &&
    typeof d.bodyHtml === "string" &&
    typeof d.pristine === "object" &&
    d.pristine !== null
  );
}

export function loadDraft(key: string, storage: StorageLike | null = session()): ComposeDraft | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, draft: ComposeDraft, storage: StorageLike | null = session()): void {
  try {
    storage?.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: drafts are a convenience only.
  }
}

export function clearDraft(key: string, storage: StorageLike | null = session()): void {
  try {
    storage?.removeItem(key);
  } catch {
    // ignore
  }
}

/** True when the subject or body holds anything worth keeping. */
export function hasContent(draft: Pick<ComposeDraft, "subject" | "bodyHtml">): boolean {
  return draft.subject.trim() !== "" || !isEmptyHtml(draft.bodyHtml);
}

/** Inserting a template replaces subject and body: confirm when the user edited them beyond the last template. */
export function needsOverwriteConfirm(draft: Pick<ComposeDraft, "subject" | "bodyHtml" | "pristine">): boolean {
  if (!hasContent(draft)) return false;
  const same = (a: string, b: string) => htmlToText(a) === htmlToText(b);
  return !(draft.subject.trim() === draft.pristine.subject.trim() && same(draft.bodyHtml, draft.pristine.bodyHtml));
}

// ---------------------------------------------------------------- recipients
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/;

export function isEmailAddress(text: string): boolean {
  return EMAIL_RE.test(text.trim());
}

export function addressRecipient(address: string): ComposeRecipient {
  const a = address.trim();
  return { key: `addr:${a.toLowerCase()}`, name: a, address: a };
}

export function entityRecipient(
  entityType: RecipientEntityType,
  entityId: string,
  name: string,
  address: string | null,
): ComposeRecipient {
  return { key: `${entityType}:${entityId}`, name, address, entityType, entityId };
}

export function toRecipientIn(r: ComposeRecipient): EmailRecipientIn {
  return r.entityType && r.entityId
    ? { entity_type: r.entityType, entity_id: r.entityId }
    : { address: r.address ?? r.name };
}

/** Lower-cased addresses with a recorded hard bounce. */
export function bouncedSet(statuses: readonly EmailAddressStatusOut[] | undefined): Set<string> {
  return new Set((statuses ?? []).filter((s) => !!s.hard_bounced_at).map((s) => s.address.toLowerCase()));
}

export function isBounced(r: ComposeRecipient, bounced: ReadonlySet<string>): boolean {
  return !!r.address && bounced.has(r.address.toLowerCase());
}

/** Addresses to check with `GET /emails/address-status` before sending. */
export function knownAddresses(recipients: readonly ComposeRecipient[]): string[] {
  const out = new Set<string>();
  for (const r of recipients) if (r.address && isEmailAddress(r.address)) out.add(r.address.toLowerCase());
  return [...out].sort();
}

// ---------------------------------------------------------------- send / validation
export type ComposeErrors = { to?: string; subject?: string; body?: string };

export function validateDraft(draft: ComposeDraft): ComposeErrors {
  const errors: ComposeErrors = {};
  if (draft.to.length === 0) errors.to = "Add at least one recipient.";
  else if (draft.to.some((r) => !r.entityType && !isEmailAddress(r.address ?? "")))
    errors.to = "One of the addresses is not valid.";
  if (!draft.subject.trim()) errors.subject = "Add a subject.";
  if (isEmptyHtml(draft.bodyHtml)) errors.body = "Write a message.";
  return errors;
}

export function buildSendBody(draft: ComposeDraft, ctx: Pick<ComposeContext, "contextRefs" | "related">): EmailSendIn {
  return {
    to: draft.to.map(toRecipientIn),
    cc: draft.cc.map(toRecipientIn),
    template_variant_id: draft.templateVariantId,
    subject: draft.subject.trim(),
    body_html: draft.bodyHtml,
    category: "process",
    related: ctx.related,
    context_refs: ctx.contextRefs,
  };
}

// ---------------------------------------------------------------- From line
const PROVIDER_LABELS: Record<string, string> = {
  microsoft: "Microsoft 365",
  google: "Google Workspace",
};

/** Read-only "From" line: the user's connected mailbox, else the platform sender with replies to the user. */
export function fromLine(userEmail: string, connections: readonly MailboxConnectionOut[] | undefined): string {
  const mailbox = (connections ?? []).find(
    (c) => c.status === "active" && (c.provider === "microsoft" || c.provider === "google"),
  );
  if (mailbox) return `${mailbox.account_email ?? userEmail} (${PROVIDER_LABELS[mailbox.provider] ?? mailbox.provider})`;
  return `Talent OS on behalf of you — replies go to ${userEmail}`;
}
