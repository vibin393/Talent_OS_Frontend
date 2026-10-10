/** Pure helpers of the Epic 37 skills screens (tested in `skills-graph.test.ts`). */
import type { EdgeKind, ProficiencyBucket, SkillInsightRow, SuggestionSource, Verification } from "./types";

export const PROFICIENCY_LABELS: Record<number, string> = {
  1: "Awareness",
  2: "Beginner",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

export function proficiencyLabel(p: number | null | undefined): string {
  return p ? `${p} · ${PROFICIENCY_LABELS[p] ?? ""}`.trim() : "Not recorded";
}

export type BadgeColor = "success" | "informative" | "subtle";

/** Verified = success, Declared = informative, Inferred = subtle (with a "not verified" tooltip). */
export function verificationBadge(v: Verification): { label: string; color: BadgeColor; tooltip: string | null } {
  if (v === "verified") return { label: "Verified", color: "success", tooltip: null };
  if (v === "declared") return { label: "Declared", color: "informative", tooltip: "Stated by the candidate" };
  return { label: "Inferred", color: "subtle", tooltip: "Not verified — from resume, graph or project" };
}

export const EDGE_KIND_LABELS: Record<EdgeKind, string> = {
  parent_of: "Is a parent of",
  implies: "Implies",
  related_to: "Is related to",
};

export const SUGGESTION_SOURCE_LABELS: Record<SuggestionSource, string> = {
  ai_resume: "AI (resume)",
  graph: "Skills graph",
  project: "Project",
  assessment: "Assessment",
  interview: "Interview", // Epic 60
};

/** Weight input: a number in (0, 1] with at most 2 decimals. Returns the error text or null. */
export function weightError(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "Enter a weight";
  if (!/^\d*(\.\d{1,2})?$/.test(t) || t === ".") return "Use a number like 0.8";
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0 || n > 1) return "Must be greater than 0 and at most 1";
  return null;
}

/** Slider value -> "0.80". */
export function formatWeight(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** Snap to the slider grid 0.05..1.00 (step 0.05). */
export function clampWeight(n: number): number {
  if (!Number.isFinite(n)) return 0.8;
  return Math.min(1, Math.max(0.05, Math.round(n * 20) / 20));
}

/** Deep links of an insight row: demand list, candidate search, verified-only search and the bench. */
export function insightLinks(row: Pick<SkillInsightRow, "skill_key">, proficiencyMin?: number): Record<string, string> {
  const id = row.skill_key.split(":", 2)[1] ?? "";
  const cand = new URLSearchParams();
  cand.append("skills", id);
  cand.set("skills_mode", "all");
  if (proficiencyMin) cand.set("proficiency_min", String(proficiencyMin));
  const demands = new URLSearchParams({ skill_id: id, status: "open" });
  return {
    demands: `/demands?${demands}`,
    candidates: `/candidates/search?${cand}`,
    verified: `/candidates/search?${cand}&verification=verified`,
    bench: `/bench?${new URLSearchParams({ skill_id: id })}`,
  };
}

const BUCKETS: readonly ProficiencyBucket[] = ["5", "4", "3", "2", "1", "unknown"];

/** Stacked-bar segments (percent of total) for supply by proficiency, highest first, unknown last. */
export function supplySegments(
  row: Pick<SkillInsightRow, "supply_by_proficiency" | "supply_total">,
): { key: ProficiencyBucket; count: number; pct: number }[] {
  const total = row.supply_total || 0;
  return BUCKETS.map((k) => {
    const count = row.supply_by_proficiency[k] ?? 0;
    return { key: k, count, pct: total ? (count / total) * 100 : 0 };
  }).filter((s) => s.count > 0);
}

/** SVG polyline points for a 13-week sparkline of width `w` and height `h`. */
export function sparkPoints(values: number[], w = 80, h = 20): string {
  if (!values.length) return "";
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  return values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(" ");
}
