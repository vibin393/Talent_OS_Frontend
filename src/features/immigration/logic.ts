/** Pure helpers for Immigration (Epic 46): labels, masking, definition validation, permit form, portal gating. */
import type {
  CaseStatus,
  ExpiryFieldDef,
  PermitIn,
  RequestStatus,
  StageCategory,
  StageOut,
  VisaTypeDefinition,
} from "./types";

type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const DISCLAIMER = "Operational checklist, not legal advice — verify with your counsel before use.";

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: "Open",
  in_stage: "In progress",
  approved: "Approved",
  refused: "Refused",
  withdrawn: "Withdrawn",
};

export const CASE_STATUS_COLORS: Record<CaseStatus, BadgeColor> = {
  open: "informative",
  in_stage: "brand",
  approved: "success",
  refused: "danger",
  withdrawn: "subtle",
};

export const STAGE_CATEGORIES: StageCategory[] = ["preparing", "filed", "pending_decision"];

export const STAGE_CATEGORY_LABELS: Record<StageCategory, string> = {
  preparing: "Preparing",
  filed: "Filed",
  pending_decision: "Pending decision",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  requested: "Requested",
  uploaded: "Uploaded",
  verified: "Verified",
  rejected: "Rejected",
  waived: "Waived",
};

export const REQUEST_STATUS_COLORS: Record<RequestStatus, BadgeColor> = {
  requested: "informative",
  uploaded: "brand",
  verified: "success",
  rejected: "danger",
  waived: "subtle",
};

export const PERMIT_STATUS_COLORS: Record<string, BadgeColor> = {
  active: "success",
  future: "informative",
  expired: "danger",
  superseded: "subtle",
};

export const COLLECT_FROM_LABELS: Record<string, string> = { worker: "Worker", counsel: "Counsel", internal: "Internal" };

/** `••••1234`; an em dash when nothing is stored. Never takes or renders the full number. */
export function maskedNumber(last4: string | null | undefined): string {
  return last4 ? `••••${last4}` : "—";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** Country label for an ISO-2 code ("GB" -> "United Kingdom"), falling back to the code. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "—";
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

// ---------------------------------------------------------------- case list filters
export type CaseFilters = {
  status?: string;
  stage?: string;
  country?: string;
  owner_user_id?: string;
  visa_type_id?: string;
  overdue?: boolean;
  candidate_id?: string;
  q?: string;
};

export const CASE_FILTER_KEYS = ["status", "stage", "country", "owner_user_id", "visa_type_id", "overdue", "candidate_id", "q"] as const;

export function caseQuery(filters: CaseFilters): string {
  const q = new URLSearchParams();
  for (const k of CASE_FILTER_KEYS) {
    const v = filters[k];
    if (v === undefined || v === null || v === "" || v === false) continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Case filters from URL search params (dashboard drill-down links). */
export function filtersFromParams(params: { get: (k: string) => string | null }): CaseFilters {
  const out: CaseFilters = {};
  for (const k of CASE_FILTER_KEYS) {
    const v = params.get(k);
    if (!v) continue;
    if (k === "overdue") out.overdue = v === "true";
    else out[k] = v;
  }
  return out;
}

/** `/immigration/cases?…` for a dashboard tile's filters. */
export function casesHref(filters: Record<string, string>): string {
  const q = new URLSearchParams(filters).toString();
  return q ? `/immigration/cases?${q}` : "/immigration/cases";
}

// ---------------------------------------------------------------- stages
export type StageGroup = { category: StageCategory | string; label: string; stages: StageOut[] };

/** Stages grouped by category in the canonical category order, keeping the definition order inside a group. */
export function groupStages(stages: StageOut[]): StageGroup[] {
  const order = [...STAGE_CATEGORIES, ...new Set(stages.map((s) => s.category).filter((c) => !STAGE_CATEGORIES.includes(c as StageCategory)))];
  return order
    .map((category) => ({
      category,
      label: STAGE_CATEGORY_LABELS[category as StageCategory] ?? category,
      stages: stages.filter((s) => s.category === category),
    }))
    .filter((g) => g.stages.length > 0);
}

/** Moving to an earlier stage needs a reason (backend `reason_required`). */
export function isBackwardMove(stages: Pick<StageOut, "key">[], from: string | null, to: string): boolean {
  if (!from) return false;
  const a = stages.findIndex((s) => s.key === from);
  const b = stages.findIndex((s) => s.key === to);
  return a >= 0 && b >= 0 && b < a;
}

// ---------------------------------------------------------------- definition validation
const KEY_RE = /^[a-z][a-z0-9_]*$/;

export type DefinitionIssue = { path: string; message: string };

function checkKeys(items: { key: string }[], section: string, issues: DefinitionIssue[]) {
  const seen = new Set<string>();
  items.forEach((it, i) => {
    if (!it.key || !KEY_RE.test(it.key) || it.key.length > 60)
      issues.push({ path: `${section}.${i}.key`, message: "Use lowercase letters, digits and underscores, starting with a letter." });
    else if (seen.has(it.key)) issues.push({ path: `${section}.${i}.key`, message: `Duplicate key "${it.key}".` });
    seen.add(it.key);
  });
}

function checkLabels(items: { label: string }[], section: string, issues: DefinitionIssue[]) {
  items.forEach((it, i) => {
    if (!it.label.trim()) issues.push({ path: `${section}.${i}.label`, message: "A label is required." });
  });
}

/** Problems with alert offsets: whole days 1..365, unique, descending, at most 10. */
export function offsetsError(offsets: number[]): string | null {
  if (offsets.length > 10) return "At most 10 alert offsets.";
  if (offsets.some((o) => !Number.isInteger(o) || o < 1 || o > 365)) return "Offsets are whole days between 1 and 365.";
  if (new Set(offsets).size !== offsets.length) return "Offsets must be unique.";
  for (let i = 1; i < offsets.length; i++) if (offsets[i] >= offsets[i - 1]) return "Offsets must be in descending order.";
  return null;
}

/** Adds an offset typed by the user: returns the new sorted list or an error message. */
export function addOffset(offsets: number[], raw: string): { offsets: number[] } | { error: string } {
  const n = Number(raw.trim());
  if (!raw.trim() || !Number.isInteger(n) || n < 1 || n > 365) return { error: "Enter a whole number of days between 1 and 365." };
  if (offsets.includes(n)) return { error: `${n} days is already in the list.` };
  if (offsets.length >= 10) return { error: "At most 10 alert offsets." };
  return { offsets: [...offsets, n].sort((a, b) => b - a) };
}

/** Client-side mirror of the backend definition rules (`visa_stage_category_invalid`, `visa_definition_invalid`). */
export function validateDefinition(def: VisaTypeDefinition): DefinitionIssue[] {
  const issues: DefinitionIssue[] = [];
  if (def.stages.length === 0) issues.push({ path: "stages", message: "Add at least one stage." });
  if (def.stages.length > 40) issues.push({ path: "stages", message: "At most 40 stages." });
  checkKeys(def.stages, "stages", issues);
  checkLabels(def.stages, "stages", issues);
  def.stages.forEach((s, i) => {
    if (!STAGE_CATEGORIES.includes(s.category as StageCategory))
      issues.push({ path: `stages.${i}.category`, message: "Choose Preparing, Filed or Pending decision." });
    if (s.sla_days != null && (!Number.isInteger(s.sla_days) || s.sla_days < 1 || s.sla_days > 730))
      issues.push({ path: `stages.${i}.sla_days`, message: "SLA is 1 to 730 days." });
  });
  checkKeys(def.checklist, "checklist", issues);
  checkLabels(def.checklist, "checklist", issues);
  def.checklist.forEach((c, i) => {
    if (!c.document_category.trim()) issues.push({ path: `checklist.${i}.document_category`, message: "A document category is required." });
  });
  if (def.expiry_fields.length === 0) issues.push({ path: "expiry_fields", message: "Add at least one expiry field." });
  checkKeys(def.expiry_fields, "expiry_fields", issues);
  checkLabels(def.expiry_fields, "expiry_fields", issues);
  const primaries = def.expiry_fields.filter((f) => f.primary).length;
  if (def.expiry_fields.length > 0 && primaries !== 1)
    issues.push({ path: "expiry_fields", message: "Exactly one expiry field must be primary (it drives the permit expiry)." });
  const off = offsetsError(def.alert_offsets);
  if (off) issues.push({ path: "alert_offsets", message: off });
  checkKeys(def.key_dates, "key_dates", issues);
  checkLabels(def.key_dates, "key_dates", issues);
  return issues;
}

/** Marks `index` as the only primary expiry field. */
export function setPrimary(fields: ExpiryFieldDef[], index: number): ExpiryFieldDef[] {
  return fields.map((f, i) => ({ ...f, primary: i === index }));
}

/** Drops empty optional values before sending (the API rejects unknown / null-ish shapes). */
export function cleanDefinition(def: VisaTypeDefinition): VisaTypeDefinition {
  return {
    stages: def.stages.map((s) => ({
      key: s.key.trim(),
      label: s.label.trim(),
      category: s.category,
      ...(s.sla_days ? { sla_days: s.sla_days } : {}),
      ...(s.help?.trim() ? { help: s.help.trim() } : {}),
    })),
    checklist: def.checklist.map((c) => ({
      key: c.key.trim(),
      label: c.label.trim(),
      document_category: c.document_category.trim(),
      mandatory: c.mandatory,
      applies_to: c.applies_to,
      collect_from: c.collect_from,
      ...(c.validity_rule ? { validity_rule: c.validity_rule } : {}),
      ...(c.help?.trim() ? { help: c.help.trim() } : {}),
    })),
    expiry_fields: def.expiry_fields.map((f) => ({ key: f.key.trim(), label: f.label.trim(), primary: f.primary, required: f.required })),
    alert_offsets: [...def.alert_offsets],
    key_dates: def.key_dates.map((k) => ({ key: k.key.trim(), label: k.label.trim() })),
  };
}

export function emptyDefinition(): VisaTypeDefinition {
  return {
    stages: [{ key: "preparing", label: "Preparing documents", category: "preparing" }],
    checklist: [],
    expiry_fields: [{ key: "permit_expiry", label: "Permit expiry", primary: true, required: true }],
    alert_offsets: [120, 90, 60, 30],
    key_dates: [],
  };
}

// ---------------------------------------------------------------- permit form
export type PermitForm = {
  permit_type: string;
  number: string;
  valid_from: string;
  /** Values keyed by expiry field key (the primary one becomes `valid_to`). */
  values: Record<string, string>;
  conditions: string;
};

export function emptyPermitForm(): PermitForm {
  return { permit_type: "", number: "", valid_from: "", values: {}, conditions: "" };
}

/** Field errors for a permit driven by the case's pinned `expiry_fields`. Keys: `number`, `valid_from`, `expiry.<key>`. */
export function permitErrors(fields: ExpiryFieldDef[], form: PermitForm): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!form.number.trim()) errs.number = "The permit number is required.";
  else if (form.number.trim().length > 40) errs.number = "At most 40 characters.";
  if (!form.valid_from) errs.valid_from = "The start date is required.";
  for (const f of fields) {
    const v = form.values[f.key] ?? "";
    if (f.required && !v) errs[`expiry.${f.key}`] = `${f.label} is required.`;
    else if (v && form.valid_from && v < form.valid_from) errs[`expiry.${f.key}`] = `${f.label} cannot be before the start date.`;
  }
  return errs;
}

/** `PermitIn` from the form: the primary field maps to `valid_to`, the others to `expiry_values`. */
export function buildPermit(fields: ExpiryFieldDef[], form: PermitForm): PermitIn {
  const primary = fields.find((f) => f.primary);
  const expiry_values: Record<string, string> = {};
  for (const f of fields) {
    const v = form.values[f.key];
    if (v && f !== primary) expiry_values[f.key] = v;
  }
  return {
    permit_type: form.permit_type.trim() || null,
    number: form.number.trim(),
    valid_from: form.valid_from,
    valid_to: (primary && form.values[primary.key]) || null,
    expiry_values,
    conditions: form.conditions.trim() || null,
  };
}

// ---------------------------------------------------------------- worker portal
export type PortalGate = "consent" | "upload" | "done" | "none";

/** Notice + consent is shown before the first upload; afterwards uploadable requests show the file picker. */
export function portalUploadGate(consentGiven: boolean, request: { can_upload: boolean; status: string }): PortalGate {
  if (!request.can_upload) return request.status === "verified" || request.status === "waived" ? "done" : "none";
  return consentGiven ? "upload" : "consent";
}

export const PORTAL_REQUEST_LABELS: Record<string, string> = {
  requested: "Needed from you",
  uploaded: "Received — being checked",
  verified: "Accepted",
  rejected: "Please upload again",
  waived: "Not needed",
};

/** Public counsel page: upload is allowed only once the consent box is ticked (when required). */
export function publicCanUpload(consentRequired: boolean, consentTicked: boolean, item: { can_upload: boolean }): boolean {
  return item.can_upload && (!consentRequired || consentTicked);
}

export const UPLOAD_ACCEPT = ".pdf,.png,.jpg,.jpeg,image/*";
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function fileError(file: File | { size: number; name: string }): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name} is larger than 10 MB.`;
  return null;
}
