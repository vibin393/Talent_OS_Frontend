/** Pure helpers for match scores, sub-score rows, dismiss reasons and matching weights. */
import type { DismissReason } from "@/lib/api/types";

export type ScoreColor = "success" | "warning" | "danger";

export const STRONG_DEFAULT = 70;
export const RELEVANT_DEFAULT = 40;

/** Colour of a 0–100 score: success ≥ 70, warning 40–69, danger < 40. */
export function scoreColor(score: number, strong = STRONG_DEFAULT, relevant = RELEVANT_DEFAULT): ScoreColor {
  if (score >= strong) return "success";
  if (score >= relevant) return "warning";
  return "danger";
}

/** `ProgressBar` colour for a score (it has no "danger", only "error"). */
export function barColor(score: number): "success" | "warning" | "error" {
  const c = scoreColor(score);
  return c === "danger" ? "error" : c;
}

export const SUB_SCORES = [
  { key: "skills", label: "Skills" },
  { key: "experience", label: "Experience" },
  { key: "location", label: "Location" },
  { key: "compensation", label: "Compensation" },
  { key: "availability", label: "Availability" },
  { key: "domain", label: "Domain" },
  { key: "similarity", label: "Profile similarity" },
] as const;

export type SubScoreKey = (typeof SUB_SCORES)[number]["key"];

/** Sub-score rows in display order; missing keys are `null` ("No data"). */
export function subScoreRows(sub: Record<string, number | null | undefined>) {
  return SUB_SCORES.map(({ key, label }) => {
    const v = sub[key];
    return { key, label, value: typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : null };
  });
}

export function formatScore(overall: number): string {
  return Number.isInteger(overall) ? String(overall) : overall.toFixed(1);
}

export const DISMISS_REASONS: { value: DismissReason; label: string }[] = [
  { value: "not_interested", label: "Candidate not interested" },
  { value: "skills_gap", label: "Skills gap" },
  { value: "experience", label: "Experience mismatch" },
  { value: "compensation", label: "Compensation mismatch" },
  { value: "location", label: "Location mismatch" },
  { value: "availability", label: "Not available in time" },
  { value: "duplicate", label: "Duplicate" },
  { value: "other", label: "Other" },
];

export function dismissReasonLabel(reason: string | null | undefined): string {
  return DISMISS_REASONS.find((r) => r.value === reason)?.label ?? "Dismissed";
}

// ---------------------------------------------------------------- weights
export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 60;
export const SKILLS_WEIGHT_MIN = 15;

/**
 * Each weight as a whole-number percent of the total (largest-remainder rounding so they sum to 100).
 * All zero -> all 0.
 */
export function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights).map(([k, v]) => [k, Math.max(0, Number.isFinite(v) ? v : 0)] as const);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const out: Record<string, number> = {};
  if (total <= 0) {
    for (const [k] of entries) out[k] = 0;
    return out;
  }
  const raw = entries.map(([k, v]) => ({ k, exact: (v / total) * 100 }));
  let assigned = 0;
  for (const r of raw) {
    out[r.k] = Math.floor(r.exact);
    assigned += out[r.k];
  }
  const byRemainder = [...raw].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)));
  for (let i = 0; i < 100 - assigned; i++) out[byRemainder[i % byRemainder.length].k] += 1;
  return out;
}

/** Client-side bound errors mirroring the API (0–60 each, skills ≥ 15, sum > 0), keyed by weight. */
export function weightErrors(weights: Record<string, number>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [k, v] of Object.entries(weights)) {
    if (!Number.isFinite(v) || v < WEIGHT_MIN || v > WEIGHT_MAX) errors[k] = `Must be between ${WEIGHT_MIN} and ${WEIGHT_MAX}`;
  }
  if ((weights.skills ?? 0) < SKILLS_WEIGHT_MIN && !errors.skills) errors.skills = `Must be at least ${SKILLS_WEIGHT_MIN}`;
  if (Object.values(weights).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0) <= 0) {
    errors.weights = "At least one weight must be above 0";
  }
  return errors;
}

/** "just now" / "3 min ago" / "2 h ago" / a date, relative to `now`. */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "never";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}
