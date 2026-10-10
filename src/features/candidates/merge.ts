/** Pure helpers for the duplicate review / merge screen. */
import type { Candidate360Out, MergeIn, MergeOut } from "@/lib/api/types";
import {
  EMPTY,
  formatDate,
  formatExperience,
  formatLocation,
  formatMoney,
  HIDDEN,
  SOURCE_LABELS,
  UNIT_LABELS,
} from "./format";

export type Side = "a" | "b";

/** Fields compared side by side (backend `COMPARE_FIELDS`), with labels. */
export const COMPARE_FIELDS: { field: string; label: string }[] = [
  { field: "full_name", label: "Name" },
  { field: "current_title", label: "Current title" },
  { field: "current_employer", label: "Current employer" },
  { field: "location", label: "Location" },
  { field: "total_experience_months", label: "Experience" },
  { field: "current_ctc_amount", label: "Current CTC" },
  { field: "current_ctc_currency", label: "Current CTC currency" },
  { field: "current_ctc_unit", label: "Current CTC per" },
  { field: "expected_ctc_amount", label: "Expected CTC" },
  { field: "expected_ctc_currency", label: "Expected CTC currency" },
  { field: "expected_ctc_unit", label: "Expected CTC per" },
  { field: "availability_date", label: "Available from" },
  { field: "notice_period_days", label: "Notice period (days)" },
  { field: "last_working_date", label: "Last working day" },
  { field: "work_authorization", label: "Work authorization" },
  { field: "willing_to_relocate", label: "Willing to relocate" },
  { field: "preferred_locations", label: "Preferred locations" },
  { field: "source", label: "Source" },
  { field: "source_detail", label: "Source detail" },
  { field: "owner_id", label: "Owner" },
];

/** Every differing field defaults to the survivor's value. */
export function defaultFieldChoices(differing: readonly string[], survivor: Side): Record<string, Side> {
  return Object.fromEntries(differing.map((f) => [f, survivor]));
}

/** Merge body: survivor id plus a choice for every differing field (missing choices -> survivor). */
export function buildMergeBody(
  survivor: Side,
  ids: { a: string; b: string },
  differing: readonly string[],
  choices: Readonly<Record<string, Side>>,
): MergeIn {
  const field_choices: Record<string, Side> = {};
  for (const f of differing) field_choices[f] = choices[f] ?? survivor;
  return { survivor_id: ids[survivor], field_choices };
}

/** Number of fields taken from the other (non-survivor) profile. */
export function fieldsFromOther(survivor: Side, differing: readonly string[], choices: Readonly<Record<string, Side>>): number {
  return differing.filter((f) => (choices[f] ?? survivor) !== survivor).length;
}

/** Display text of a compared field for one profile. */
export function compareValueText(field: string, p: Candidate360Out): string {
  if ((p.masked_fields ?? []).includes(field)) return HIDDEN;
  const v = (p as unknown as Record<string, unknown>)[field];
  if (v === null || v === undefined || v === "") return EMPTY;
  switch (field) {
    case "location":
      return formatLocation(p.location);
    case "preferred_locations":
      return p.preferred_locations?.length ? p.preferred_locations.map((l) => formatLocation(l)).join("; ") : EMPTY;
    case "total_experience_months":
      return formatExperience(p.total_experience_months);
    case "current_ctc_amount":
      return formatMoney(String(v), p.current_ctc_currency);
    case "expected_ctc_amount":
      return formatMoney(String(v), p.expected_ctc_currency);
    case "current_ctc_unit":
    case "expected_ctc_unit":
      return UNIT_LABELS[v as keyof typeof UNIT_LABELS] ?? String(v);
    case "availability_date":
    case "last_working_date":
      return formatDate(String(v));
    case "willing_to_relocate":
      return v ? "Yes" : "No";
    case "source":
      return SOURCE_LABELS[v as keyof typeof SOURCE_LABELS] ?? String(v);
    case "owner_id":
      return p.owner_name ?? String(v);
    default:
      return typeof v === "object" ? JSON.stringify(v) : String(v);
  }
}

/** Undo is offered while the merge is not undone and `undo_until` is in the future. */
export function canUndoMerge(m: Pick<MergeOut, "can_undo" | "undone_at" | "undo_until">, now: Date = new Date()): boolean {
  if (m.undone_at) return false;
  const until = new Date(m.undo_until);
  return m.can_undo !== false && !Number.isNaN(until.getTime()) && until.getTime() > now.getTime();
}
