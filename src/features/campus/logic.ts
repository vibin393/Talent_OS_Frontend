/**
 * Pure logic of Epic 43 campus hiring: labels, the registration form schema (builder rules and the public
 * renderer's validation), eligibility reason text, the funnel and the interview slot grid.
 */
import type {
  BatchIn,
  BatchOut,
  DriveStatus,
  FieldKind,
  FormField,
  FunnelRow,
  FunnelStage,
  Panel,
  PublicFormField,
  RegistrationFilters,
  RegistrationOut,
  RegistrationSource,
  RegistrationStatus,
  SlotOut,
  Tier,
} from "./types";

type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

// ---------------------------------------------------------------- labels
export const TIER_LABELS: Record<Tier, string> = { tier_1: "Tier 1", tier_2: "Tier 2", tier_3: "Tier 3", other: "Other" };
export const TIERS = Object.keys(TIER_LABELS) as Tier[];

export const DRIVE_STATUS_LABELS: Record<DriveStatus, string> = {
  draft: "Draft",
  registration_open: "Registration open",
  in_progress: "In progress",
  closed: "Closed",
  cancelled: "Cancelled",
};
export const DRIVE_STATUS_COLORS: Record<DriveStatus, BadgeColor> = {
  draft: "subtle",
  registration_open: "success",
  in_progress: "brand",
  closed: "informative",
  cancelled: "danger",
};

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  registered: "Registered",
  eligible: "Eligible",
  not_eligible: "Not eligible",
  assessed: "Assessed",
  shortlisted: "Shortlisted",
  interviewed: "Interviewed",
  offered: "Offered",
  joined: "Joined",
  reneged: "Reneged",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};
export const REGISTRATION_STATUSES = Object.keys(REGISTRATION_STATUS_LABELS) as RegistrationStatus[];
export const REGISTRATION_STATUS_COLORS: Record<RegistrationStatus, BadgeColor> = {
  registered: "informative",
  eligible: "success",
  not_eligible: "warning",
  assessed: "brand",
  shortlisted: "brand",
  interviewed: "brand",
  offered: "important",
  joined: "success",
  reneged: "danger",
  rejected: "danger",
  withdrawn: "subtle",
};

export const SOURCE_LABELS: Record<RegistrationSource, string> = { link: "Link", import: "Import", walk_in: "Walk-in" };

export const FIELD_KIND_LABELS: Record<FieldKind, string> = {
  text: "Text",
  number: "Whole number",
  decimal: "Decimal",
  select: "Single choice",
  multiselect: "Multiple choice",
  date: "Date",
  bool: "Yes / no",
  file: "File upload",
};
export const FIELD_KINDS = Object.keys(FIELD_KIND_LABELS) as FieldKind[];

/** Registration list query string; `status` repeats (`?status=eligible&status=assessed`). */
export function registrationQuery(f: RegistrationFilters, limit: number, offset: number): string {
  const p = new URLSearchParams();
  for (const s of f.status ?? []) p.append("status", s);
  if (f.institution_id) p.set("institution_id", f.institution_id);
  if (f.q?.trim()) p.set("q", f.q.trim());
  if (f.flagged != null) p.set("flagged", String(f.flagged));
  p.set("limit", String(limit));
  p.set("offset", String(offset));
  return `?${p.toString()}`;
}

// ---------------------------------------------------------------- form schema (builder)
/** Keys the builder refuses (the backend refuses them too): protected characteristics are never collected. */
export const PROTECTED_KEYS = [
  "caste",
  "religion",
  "race",
  "ethnicity",
  "gender",
  "age",
  "dob",
  "disability",
  "marital_status",
] as const;
const PROTECTED_ALIASES = ["date_of_birth", "birth_date", "birthdate", "sex", "marital"];

export const MAX_CUSTOM_FIELDS = 20;
export const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

/** The standard fields every campus form carries (typed, always present, used by eligibility rules). */
export const STANDARD_FIELDS: readonly FormField[] = [
  { key: "program", label: "Program", type: "select", required: true, standard: true },
  { key: "branch", label: "Branch", type: "select", required: true, standard: true },
  { key: "cgpa", label: "CGPA", type: "decimal", required: false, min: "0", max: "10", standard: true },
  { key: "percentage", label: "Percentage", type: "decimal", required: false, min: "0", max: "100", standard: true },
  { key: "backlogs", label: "Active backlogs", type: "number", required: false, min: "0", max: "50", standard: true },
  { key: "graduation_year", label: "Graduation year", type: "number", required: true, min: "2000", max: "2100", standard: true },
];
export const STANDARD_KEYS = new Set(STANDARD_FIELDS.map((f) => f.key));

/** True when `key` names (or contains as a word) a protected characteristic. */
export function isProtectedKey(key: string): boolean {
  const k = key.trim().toLowerCase();
  if (!k) return false;
  if ((PROTECTED_KEYS as readonly string[]).includes(k) || PROTECTED_ALIASES.includes(k)) return true;
  if (k.includes("marital_status") || k.includes("date_of_birth")) return true;
  const parts = k.split("_");
  return parts.some((p) => (PROTECTED_KEYS as readonly string[]).includes(p) || PROTECTED_ALIASES.includes(p));
}

/** A field key derived from a label (`"LinkedIn profile"` -> `linkedin_profile`). */
export function keyFromLabel(label: string): string {
  let k = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!/^[a-z]/.test(k)) k = `f_${k}`;
  return k.slice(0, 40).replace(/_+$/, "") || "field";
}

/** The schema with the standard fields first (typed as the standard), then the custom fields in order. */
export function normalizeSchema(fields: readonly FormField[] | null | undefined): FormField[] {
  const byKey = new Map((fields ?? []).map((f) => [f.key, f]));
  const standard = STANDARD_FIELDS.map((s) => {
    const own = byKey.get(s.key);
    return { ...s, label: own?.label?.trim() || s.label, required: own?.required ?? s.required, help: own?.help ?? null };
  });
  const custom = (fields ?? []).filter((f) => !STANDARD_KEYS.has(f.key)).map((f) => ({ ...f, standard: false }));
  return [...standard, ...custom];
}

export type FieldErrors = Record<number, string>;

/** Builder validation: one message per offending field index (empty when the schema can be saved). */
export function validateFormSchema(fields: readonly FormField[]): FieldErrors {
  const errors: FieldErrors = {};
  const seen = new Set<string>();
  const custom = fields.filter((f) => !STANDARD_KEYS.has(f.key));
  fields.forEach((f, i) => {
    const key = f.key.trim();
    if (!f.label.trim()) errors[i] = "Give the field a label.";
    else if (!KEY_RE.test(key)) errors[i] = "Keys start with a letter and use a–z, 0–9 and _ (up to 40 characters).";
    else if (isProtectedKey(key)) errors[i] = `"${key}" is a protected characteristic and cannot be collected.`;
    else if (seen.has(key)) errors[i] = `The key "${key}" is used twice.`;
    else if (!f.standard && (f.type === "select" || f.type === "multiselect") && !(f.options ?? []).some((o) => o.trim()))
      errors[i] = "Add at least one option.";
    else if (f.min != null && f.max != null && f.min !== "" && f.max !== "" && Number(f.min) > Number(f.max))
      errors[i] = "The minimum is larger than the maximum.";
    seen.add(key);
  });
  if (custom.length > MAX_CUSTOM_FIELDS) {
    const lastIdx = fields.lastIndexOf(custom[custom.length - 1]);
    errors[lastIdx] = errors[lastIdx] ?? `At most ${MAX_CUSTOM_FIELDS} custom fields.`;
  }
  return errors;
}

/** The schema body for `PATCH /drives/{id}` (empty numbers dropped, options trimmed). */
export function schemaBody(fields: readonly FormField[]): { fields: FormField[] } {
  return {
    fields: fields.map((f) => {
      const out: FormField = { key: f.key.trim(), label: f.label.trim(), type: f.type, required: !!f.required, standard: STANDARD_KEYS.has(f.key) };
      if (f.help?.trim()) out.help = f.help.trim();
      if ((f.type === "select" || f.type === "multiselect") && !out.standard)
        out.options = [...new Set((f.options ?? []).map((o) => o.trim()).filter(Boolean))];
      if ((f.type === "number" || f.type === "decimal") && f.min !== "" && f.min != null) out.min = String(f.min);
      if ((f.type === "number" || f.type === "decimal") && f.max !== "" && f.max != null) out.max = String(f.max);
      return out;
    }),
  };
}

// ---------------------------------------------------------------- public form (renderer)
export type AnswerValue = string | string[] | boolean | null | undefined;
export type Answers = Record<string, AnswerValue>;
export type Files = Record<string, File | null | undefined>;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Branches to offer for the chosen program (all known branches when the program has none listed). */
export function branchesFor(program: string | null | undefined, byProgram: Record<string, string[]>): string[] {
  if (program && byProgram[program]?.length) return byProgram[program];
  if (program) return [];
  return [...new Set(Object.values(byProgram).flat())];
}

function isEmpty(v: AnswerValue): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

/** Options for a public field (program options come from the drive's programs when the field has none). */
export function optionsFor(field: PublicFormField, answers: Answers, byProgram: Record<string, string[]>): string[] {
  if (field.key === "program") return field.options?.length ? field.options : Object.keys(byProgram);
  if (field.key === "branch") return branchesFor(typeof answers.program === "string" ? answers.program : null, byProgram);
  return field.options ?? [];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Renderer validation over the drive's schema; returns `{key: message}` (empty when valid). */
export function validateAnswers(
  fields: readonly PublicFormField[],
  answers: Answers,
  files: Files,
  byProgram: Record<string, string[]> = {},
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = answers[f.key];
    if (f.type === "file") {
      const file = files[f.key];
      if (!file) {
        if (f.required) errors[f.key] = "Attach a file.";
      } else if (file.size > MAX_FILE_BYTES) errors[f.key] = "The file is larger than 5 MB.";
      continue;
    }
    if (f.type === "bool") {
      if (f.required && v !== true) errors[f.key] = "This must be ticked to continue.";
      continue;
    }
    if (isEmpty(v)) {
      if (f.required) errors[f.key] = "This field is required.";
      continue;
    }
    const min = f.min != null && f.min !== "" ? Number(f.min) : null;
    const max = f.max != null && f.max !== "" ? Number(f.max) : null;
    if (f.type === "number" || f.type === "decimal") {
      const s = String(v).trim();
      const re = f.type === "number" ? /^-?\d+$/ : /^-?\d+(\.\d{1,2})?$/;
      if (!re.test(s)) {
        errors[f.key] = f.type === "number" ? "Enter a whole number." : "Enter a number (up to 2 decimals).";
        continue;
      }
      const n = Number(s);
      if (min !== null && n < min) errors[f.key] = `Enter ${min} or more.`;
      else if (max !== null && n > max) errors[f.key] = `Enter ${max} or less.`;
      continue;
    }
    if (f.type === "date") {
      if (typeof v !== "string" || !DATE_RE.test(v) || Number.isNaN(Date.parse(v))) errors[f.key] = "Enter a valid date.";
      continue;
    }
    const opts = optionsFor(f, answers, byProgram);
    if (f.type === "select" && opts.length && !opts.includes(String(v))) errors[f.key] = "Choose one of the options.";
    if (f.type === "multiselect" && opts.length && (!Array.isArray(v) || v.some((x) => !opts.includes(x))))
      errors[f.key] = "Choose from the options.";
    if (f.type === "text" && typeof v === "string" && v.length > 2000) errors[f.key] = "Use 2,000 characters or fewer.";
  }
  return errors;
}

/** Answers as sent to the API: empties dropped, whole numbers as numbers, decimals as strings, files excluded. */
export function cleanAnswers(fields: readonly PublicFormField[], answers: Answers): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "file") continue;
    const v = answers[f.key];
    if (f.type === "bool") {
      if (typeof v === "boolean") out[f.key] = v;
      continue;
    }
    if (isEmpty(v)) continue;
    if (f.type === "number") out[f.key] = Number(String(v).trim());
    else if (f.type === "decimal" || f.type === "text") out[f.key] = String(v).trim();
    else out[f.key] = v;
  }
  return out;
}

export const E164_RE = /^\+[1-9]\d{6,14}$/;
export function isE164(phone: string): boolean {
  return E164_RE.test(phone.replace(/[\s-]/g, ""));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

// ---------------------------------------------------------------- eligibility
export type EligibilityDisplay = { tone: "success" | "warning" | "subtle" | "brand"; text: string; detail: string | null };

/** The eligibility column: Eligible / Not eligible with the first failing rule's label / Overridden / Not evaluated. */
export function eligibilityReason(r: Pick<RegistrationOut, "eligibility" | "overridden" | "override_reason" | "status">): EligibilityDisplay {
  if (r.overridden) return { tone: "brand", text: "Overridden ★", detail: r.override_reason };
  const e = r.eligibility;
  if (!e) return { tone: "subtle", text: "Not evaluated", detail: null };
  if (e.eligible) return { tone: "success", text: "Eligible", detail: null };
  const label = e.failing_rule?.label?.trim();
  return { tone: "warning", text: "Not eligible", detail: label ? `Fails: ${label}` : null };
}

/** Override is available on not-eligible registrations that a human has not already overridden. */
export function canOverride(r: Pick<RegistrationOut, "status" | "overridden">): boolean {
  return r.status === "not_eligible" && !r.overridden;
}

export const OVERRIDE_MIN = 5;
export function overrideReasonError(reason: string): string | null {
  const n = reason.trim().length;
  if (n < OVERRIDE_MIN) return `Give a reason of at least ${OVERRIDE_MIN} characters.`;
  if (n > 1000) return "Use 1,000 characters or fewer.";
  return null;
}

// ---------------------------------------------------------------- funnel
export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  registered: "Registered",
  eligible: "Eligible",
  assessed: "Assessed",
  shortlisted: "Shortlisted",
  interviewed: "Interviewed",
  offered: "Offered",
  accepted: "Accepted",
  joined: "Joined",
};

/** One sequential blue ramp (light -> dark) so stage order reads at a glance; stable across every chart. */
export const FUNNEL_STAGE_COLORS: Record<FunnelStage, string> = {
  registered: "#cfe4fa",
  eligible: "#a9cdf3",
  assessed: "#7fb3ea",
  shortlisted: "#5698de",
  interviewed: "#2f7fd0",
  offered: "#1866b4",
  accepted: "#0f4f91",
  joined: "#083a6e",
};
/** Text colour that keeps 4.5:1 contrast on each stage swatch. */
export function stageTextColor(stage: FunnelStage): string {
  return ["registered", "eligible", "assessed"].includes(stage) ? "#0b2340" : "#ffffff";
}

/**
 * Exclusive stage counts for a stacked bar: how many Candidates *stopped* at each stage (cumulative counts
 * `registered >= eligible >= …` become segments that add up to `registered`). Negative gaps clamp to 0.
 */
export function funnelSegments(row: Pick<FunnelRow, FunnelStage>, stages: readonly FunnelStage[]): { stage: FunnelStage; count: number }[] {
  return stages.map((stage, i) => {
    const next = i + 1 < stages.length ? row[stages[i + 1]] : 0;
    return { stage, count: Math.max(0, (row[stage] ?? 0) - (next ?? 0)) };
  });
}

export function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

// ---------------------------------------------------------------- interview slot grid
export type SlotGrid = {
  /** Slot start instants (ISO), ascending, de-duplicated across panels. */
  times: string[];
  panels: { index: number; label: string; cells: (SlotOut | null)[] }[];
};

/** Rows = slot start times, columns = panels; a cell is the panel's slot at that time (or null). */
export function buildSlotGrid(batch: Pick<BatchOut, "panels" | "slots">): SlotGrid {
  const times = [...new Set(batch.slots.map((s) => s.starts_at))].sort((a, b) => Date.parse(a) - Date.parse(b));
  const panels = batch.panels.map((p, index) => {
    const mine = new Map(batch.slots.filter((s) => s.panel_index === index).map((s) => [s.starts_at, s]));
    return { index, label: p.label || `Panel ${index + 1}`, cells: times.map((t) => mine.get(t) ?? null) };
  });
  return { times, panels };
}

export type AssignmentPreview = { assigned: { slotId: string; name: string }[]; unassigned: string[]; free: number };

/**
 * What Auto-slot would do (display only; the server decides): candidates are placed into the empty slots in
 * time order, filling every panel at a time before moving to the next time.
 */
export function previewAssignment(batch: Pick<BatchOut, "panels" | "slots">, names: readonly string[]): AssignmentPreview {
  const grid = buildSlotGrid(batch);
  const free: SlotOut[] = [];
  grid.times.forEach((_, ti) => {
    for (const p of grid.panels) {
      const cell = p.cells[ti];
      if (cell && !cell.registration_id) free.push(cell);
    }
  });
  const assigned = names.slice(0, free.length).map((name, i) => ({ slotId: free[i].id, name }));
  return { assigned, unassigned: names.slice(free.length), free: free.length };
}

/** Slots an occupied slot may be moved to: empty slots of the same batch. */
export function moveTargets(batch: Pick<BatchOut, "slots">, slotId: string): SlotOut[] {
  return batch.slots.filter((s) => s.id !== slotId && !s.registration_id);
}

/** Panels as sent to `POST /batches`: trimmed, empty room / video link dropped. */
export function panelsBody(
  panels: readonly { label: string; interviewer_user_ids: string[]; room?: string | null; video_link?: string | null }[],
): Panel[] {
  return panels.map((p) => ({
    label: p.label.trim(),
    interviewer_user_ids: p.interviewer_user_ids,
    room: p.room?.trim() || null,
    video_link: p.video_link?.trim() || null,
  }));
}

/** First problem with a batch body (null when it can be sent). */
export function validateBatch(b: Pick<BatchIn, "demand_id" | "date" | "start_time" | "end_time" | "panels"> & { slot_minutes?: number }): string | null {
  if (!b.demand_id) return "Choose a Demand.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return "Choose a date.";
  if (!/^\d{2}:\d{2}/.test(b.start_time) || !/^\d{2}:\d{2}/.test(b.end_time)) return "Enter start and end times.";
  if (b.end_time <= b.start_time) return "The batch must end after it starts.";
  if (b.slot_minutes !== undefined && (b.slot_minutes < 15 || b.slot_minutes > 180)) return "Slots are 15 to 180 minutes.";
  if (b.panels.length === 0) return "Add at least one panel.";
  const bad = b.panels.findIndex((p) => !p.label.trim() || p.interviewer_user_ids.length === 0);
  if (bad >= 0) return `Panel ${bad + 1} needs a label and at least one interviewer.`;
  const link = b.panels.findIndex((p) => p.video_link && !/^https?:\/\//i.test(p.video_link));
  if (link >= 0) return `Panel ${link + 1}: the video link must start with https://.`;
  return null;
}

/** Wall-clock `HH:MM` of an instant in `tz`. */
export function timeLabel(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

// ---------------------------------------------------------------- institutions
export type ProgramDraft = { name: string; branches: string };

/** Programs from the editor rows: blank rows dropped, branches split on commas and de-duplicated. */
export function programsFromDraft(rows: readonly ProgramDraft[]): { name: string; branches: string[] }[] {
  return rows
    .filter((r) => r.name.trim())
    .map((r) => ({ name: r.name.trim(), branches: [...new Set(r.branches.split(",").map((b) => b.trim()).filter(Boolean))] }));
}

// ---------------------------------------------------------------- errors
/** Field errors keyed by the last path segment (`answers.cgpa` / `body.payload.email` -> `cgpa` / `email`). */
export function plainFieldKeys(errors: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors)) {
    const key = k.split(".").pop() ?? k;
    if (!(key in out)) out[key] = v;
  }
  return out;
}

// ---------------------------------------------------------------- misc
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** `datetime-local` input value -> ISO (null when empty / invalid). */
export function localToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO -> `datetime-local` input value in the browser zone. */
export function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Status actions offered for a drive. */
export function driveActions(status: DriveStatus): ("open" | "close_registration" | "close" | "cancel")[] {
  switch (status) {
    case "draft":
      return ["open", "cancel"];
    case "registration_open":
      return ["close_registration", "cancel"];
    case "in_progress":
      return ["open", "close", "cancel"];
    default:
      return [];
  }
}

/** Where a generic secure link (`/l/{token}`) of an Epic 43 purpose continues, or null for other purposes. */
export function campusLinkPath(purpose: string, token: string): string | null {
  const t = encodeURIComponent(token);
  if (purpose === "campus_registration") return `/campus/r/${t}`;
  if (purpose === "event_checkin") return `/campus/e/${t}`;
  return null;
}
