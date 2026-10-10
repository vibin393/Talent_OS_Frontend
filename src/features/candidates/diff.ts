/**
 * Resume diff (POST /candidates/{id}/resumes -> `diff`) helpers: stable row keys, display text, and
 * the `ResumeApply` body for the rows the user selected.
 */
import type { DiffEntry, LocationOut, ResumeApply } from "@/lib/api/types";
import { EMPTY, formatExperience, formatLocation } from "./format";

/** Diff entries for list fields carry the value itself; `apply` selects them by value. */
const VALUE_FIELDS = ["emails", "phones", "links", "skills"] as const;
/** Diff entries for row fields carry an index into the parsed rows; `apply` selects them by index. */
const INDEX_FIELDS = { employment: "employment_idx", education: "education_idx", certifications: "certification_idx" } as const;

type ValueField = (typeof VALUE_FIELDS)[number];
type IndexField = keyof typeof INDEX_FIELDS;

function isValueField(f: string): f is ValueField {
  return (VALUE_FIELDS as readonly string[]).includes(f);
}
function isIndexField(f: string): f is IndexField {
  return f in INDEX_FIELDS;
}

/** Stable, unique key for a diff row (used for the per-row checkbox state). */
export function diffKey(entry: DiffEntry): string {
  if (isValueField(entry.field)) return `${entry.field}:${String(entry.parsed)}`;
  if (isIndexField(entry.field)) return `${entry.field}#${entry.index ?? -1}`;
  return entry.field;
}

/**
 * The `ResumeApply` body for the selected rows only. Scalar fields go to `fields`, list values to
 * `emails`/`phones`/`links`/`skills`, row entries to `*_idx`. Unknown keys are ignored.
 */
export function buildDiffPatch(diff: readonly DiffEntry[], selected: ReadonlySet<string> | readonly string[]): ResumeApply {
  const chosen = selected instanceof Set ? selected : new Set(selected as readonly string[]);
  const patch = {
    fields: [] as string[],
    emails: [] as string[],
    phones: [] as string[],
    links: [] as string[],
    skills: [] as string[],
    employment_idx: [] as number[],
    education_idx: [] as number[],
    certification_idx: [] as number[],
  };
  for (const entry of diff) {
    if (!chosen.has(diffKey(entry))) continue;
    if (isValueField(entry.field)) {
      const v = String(entry.parsed);
      if (!patch[entry.field].includes(v)) patch[entry.field].push(v);
    } else if (isIndexField(entry.field)) {
      if (typeof entry.index === "number") {
        const list = patch[INDEX_FIELDS[entry.field]];
        if (!list.includes(entry.index)) list.push(entry.index);
      }
    } else if (!patch.fields.includes(entry.field)) {
      patch.fields.push(entry.field);
    }
  }
  return patch;
}

export function allDiffKeys(diff: readonly DiffEntry[]): string[] {
  return diff.map(diffKey);
}

const FIELD_LABELS: Record<string, string> = {
  full_name: "Name",
  current_title: "Current title",
  current_employer: "Current employer",
  location: "Location",
  total_experience_months: "Total experience",
  emails: "Email",
  phones: "Phone",
  links: "Link",
  skills: "Skill",
  employment: "Employment",
  education: "Education",
  certifications: "Certification",
};

export function diffFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function joinParts(parts: unknown[], sep: string): string {
  return parts
    .map((p) => (p === null || p === undefined ? "" : String(p).trim()))
    .filter(Boolean)
    .join(sep);
}

/** Display text for a diff value (current or parsed side). */
export function diffValueText(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  if (field === "location" && isRecord(value)) return formatLocation(value as LocationOut);
  if (field === "total_experience_months" && typeof value === "number") return formatExperience(value);
  if (field === "employment" && isRecord(value)) {
    const role = joinParts([value.title, value.employer], " @ ");
    const dates = joinParts([value.start_date, value.is_current ? "present" : value.end_date], " – ");
    return joinParts([role, dates], ", ") || EMPTY;
  }
  if (field === "education" && isRecord(value)) {
    const what = joinParts([value.degree, value.field], ", ");
    const years = joinParts([value.start_year, value.end_year], " – ");
    return joinParts([what, value.institution, years], " · ") || EMPTY;
  }
  if (field === "certifications" && isRecord(value)) {
    return joinParts([value.name, value.issuer], " · ") || EMPTY;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Rows for list/row fields are additions (nothing current to replace). */
export function isAddition(entry: DiffEntry): boolean {
  return isValueField(entry.field) || isIndexField(entry.field);
}
