/** Pure scorecard state: kit normalisation, draft editing, submit validation and the blinded summary text. */
import type { Recommendation, ScorecardDraftIn, ScorecardListOut, ScorecardOut } from "./types";

export type KitView = {
  name?: string | null;
  ratingScale: number;
  competencies: { key: string; label: string; guidance?: string | null }[];
  questions: { key: string; competency_key?: string | null; text: string; guidance?: string | null }[];
};

export type ScorecardDraft = {
  ratings: Record<string, { rating: number | null; note: string }>;
  answers: Record<string, string>;
  recommendation: Recommendation | null;
  summary: string;
};

export type ScorecardErrors = { ratings: Record<string, string>; recommendation?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Read the kit snapshot a scorecard carries (a loose JSON object) into a typed view. */
export function kitFromSnapshot(kit: Record<string, unknown> | null | undefined, fallbackScale = 5): KitView {
  const k = isRecord(kit) ? kit : {};
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(isRecord) : []);
  const scale = Number(k.rating_scale);
  return {
    name: typeof k.name === "string" ? k.name : null,
    ratingScale: Number.isInteger(scale) && scale >= 2 ? scale : fallbackScale,
    competencies: list(k.competencies)
      .filter((c) => typeof c.key === "string")
      .map((c) => ({ key: String(c.key), label: typeof c.label === "string" ? c.label : String(c.key), guidance: typeof c.guidance === "string" ? c.guidance : null })),
    questions: list(k.questions)
      .filter((q) => typeof q.key === "string" && typeof q.text === "string")
      .map((q) => ({
        key: String(q.key),
        competency_key: typeof q.competency_key === "string" ? q.competency_key : null,
        text: String(q.text),
        guidance: typeof q.guidance === "string" ? q.guidance : null,
      })),
  };
}

export function draftFromScorecard(card: Pick<ScorecardOut, "ratings" | "answers" | "recommendation" | "summary"> | null, kit: KitView): ScorecardDraft {
  const ratings: ScorecardDraft["ratings"] = {};
  for (const c of kit.competencies) {
    const r = card?.ratings.find((x) => x.competency_key === c.key);
    ratings[c.key] = { rating: r?.rating ?? null, note: r?.note ?? "" };
  }
  const answers: Record<string, string> = {};
  for (const q of kit.questions) answers[q.key] = card?.answers.find((a) => a.question_key === q.key)?.note ?? "";
  return { ratings, answers, recommendation: card?.recommendation ?? null, summary: card?.summary ?? "" };
}

/** Everything required to submit: every competency rated within 1..scale and a recommendation. */
export function validateScorecard(draft: ScorecardDraft, kit: KitView): ScorecardErrors {
  const errors: ScorecardErrors = { ratings: {} };
  for (const c of kit.competencies) {
    const r = draft.ratings[c.key]?.rating;
    if (r === null || r === undefined || !Number.isInteger(r) || r < 1 || r > kit.ratingScale) {
      errors.ratings[c.key] = `Rate ${c.label} from 1 to ${kit.ratingScale}`;
    }
  }
  if (!draft.recommendation) errors.recommendation = "Choose a recommendation";
  return errors;
}

export function hasErrors(e: ScorecardErrors): boolean {
  return Object.keys(e.ratings).length > 0 || !!e.recommendation;
}

/** The API body (drafts may be partial: unrated competencies are left out). */
export function toScorecardBody(draft: ScorecardDraft): ScorecardDraftIn {
  return {
    ratings: Object.entries(draft.ratings)
      .filter(([, v]) => v.rating !== null)
      .map(([key, v]) => ({ competency_key: key, rating: v.rating!, note: v.note.trim() || null })),
    answers: Object.entries(draft.answers)
      .filter(([, note]) => note.trim())
      .map(([key, note]) => ({ question_key: key, note: note.trim() })),
    recommendation: draft.recommendation,
    summary: draft.summary.trim() || null,
  };
}

/** "2 of 3 submitted — submit yours to view" for a blinded list; null when the list is visible. */
export function blindedText(list: Pick<ScorecardListOut, "hidden" | "submitted_count" | "required_count">): string | null {
  if (!list.hidden) return null;
  return `${list.submitted_count} of ${list.required_count} submitted — submit yours to view`;
}

/** Average rating of a submitted scorecard (null when unrated). */
export function averageRating(card: Pick<ScorecardOut, "ratings">): number | null {
  const r = card.ratings.map((x) => x.rating).filter((x) => Number.isFinite(x));
  return r.length ? Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10 : null;
}
