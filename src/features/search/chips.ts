/**
 * NL-search "Interpreted as" chips <-> structured search state.
 *
 * Chips are derived from the (URL) state, never stored separately, so a shared link shows the same
 * chips without an AI call. Removing or editing a chip changes the structured state, which re-runs the
 * search in `structured` mode.
 */
import { EMPTY_FILTERS, type SearchFilters, type SearchState } from "./url-state";

export type ChipKey =
  | "keywords"
  | "semantic"
  | "skills"
  | "experience"
  | "countries"
  | "cities"
  | "workAuth"
  | "notice"
  | "availableBy"
  | "compensation"
  | "certifications"
  | "employers"
  | "tags"
  | "sources"
  | "owners"
  | "updated"
  | "notSubmittedTo";

export type Chip = { key: ChipKey; label: string; value: string };

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function rangeText(min: number | null, max: number | null, unit: string): string {
  if (min !== null && max !== null) return min === max ? `${fmtNum(min)} ${unit}` : `${fmtNum(min)}–${fmtNum(max)} ${unit}`;
  if (min !== null) return `≥ ${fmtNum(min)} ${unit}`;
  if (max !== null) return `≤ ${fmtNum(max)} ${unit}`;
  return "";
}

/** Chips for every active part of `state`, in a stable order. */
export function chipsFromState(state: SearchState, opts: { canViewComp?: boolean } = {}): Chip[] {
  const f = state.filters;
  const label = (id: string) => state.labels[id] ?? "Unknown";
  const chips: Chip[] = [];
  const push = (key: ChipKey, l: string, value: string) => {
    if (value) chips.push({ key, label: l, value });
  };
  push("keywords", "Keywords", state.q.trim());
  if (f.skills.length) {
    push("skills", f.skillsMode === "all" ? "Skills (all)" : "Skills (any)", f.skills.map(label).join(", "));
  }
  push("experience", "Experience", rangeText(f.expMin, f.expMax, "yrs"));
  push("countries", "Country", f.countries.join(", "));
  push("cities", "City", f.cities.join(", "));
  push("workAuth", "Work authorization", f.workAuth.join(", "));
  push("notice", "Notice", f.noticeMaxDays === null ? "" : `≤ ${f.noticeMaxDays} days`);
  push("availableBy", "Available by", f.availableBy ?? "");
  if (opts.canViewComp !== false) {
    push("compensation", "Compensation", rangeText(f.compMin, f.compMax, f.compCurrency));
  }
  push("certifications", "Certification", f.certifications.join(", "));
  push("employers", "Employer", f.employers.join(", "));
  push("tags", "Tags", f.tags.map(label).join(", "));
  push("sources", "Source", f.sources.join(", "));
  push("owners", "Owner", f.owners.map(label).join(", "));
  push(
    "updated",
    "Updated",
    f.updatedAfter || f.updatedBefore ? `${f.updatedAfter ?? "…"} → ${f.updatedBefore ?? "…"}` : "",
  );
  push("notSubmittedTo", "Not submitted to", f.notSubmittedTo ? label(f.notSubmittedTo) : "");
  push("semantic", "Similar to", state.sem.trim());
  return chips;
}

/** Filter fields cleared by removing each chip. */
const CHIP_FIELDS: Record<Exclude<ChipKey, "keywords" | "semantic">, (keyof SearchFilters)[]> = {
  skills: ["skills", "skillsMode"],
  experience: ["expMin", "expMax"],
  countries: ["countries"],
  cities: ["cities"],
  workAuth: ["workAuth"],
  notice: ["noticeMaxDays"],
  availableBy: ["availableBy"],
  compensation: ["compMin", "compMax", "compCurrency"],
  certifications: ["certifications"],
  employers: ["employers"],
  tags: ["tags"],
  sources: ["sources"],
  owners: ["owners"],
  updated: ["updatedAfter", "updatedBefore"],
  notSubmittedTo: ["notSubmittedTo"],
};

/** `state` without the part `key` stands for (page reset to 1). */
export function removeChip(state: SearchState, key: ChipKey): SearchState {
  if (key === "keywords") return { ...state, q: "", page: 1 };
  if (key === "semantic") return { ...state, sem: "", page: 1 };
  const filters = { ...state.filters };
  for (const field of CHIP_FIELDS[key]) {
    (filters as Record<string, unknown>)[field] = EMPTY_FILTERS[field];
  }
  return { ...state, filters, page: 1 };
}

/** Parse a comma-separated editor value into a clean list. */
export function listFromText(text: string): string[] {
  return [...new Set(text.split(",").map((s) => s.trim()).filter(Boolean))];
}
