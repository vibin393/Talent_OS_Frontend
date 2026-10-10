/**
 * Pure helpers for the Epic 49 fairness UI (self-ID defaults, suppressed-cell rendering, report row order,
 * four-fifths badges, run form validation, notice gating, score-hidden labels). React-free for Vitest.
 */
import type {
  AedtFeature,
  AedtStatus,
  Cell,
  DimensionKey,
  DimensionOut,
  Intersection,
  PublicNoticeOut,
  RunCreate,
  RunStatus,
  ScoreHiddenReason,
  SelectionPoint,
  SelfIdAnswers,
  SnapshotRow,
} from "./types";

export const PERM_READ = "fairness:read";
export const PERM_CONFIGURE = "fairness:configure";
export const PERM_AEDT = "aedt:manage";

export const PREFER_NOT = "prefer_not_to_say";
export const PREFER_NOT_LABEL = "Prefer not to say";
export const SELF_ID_STATEMENT = "Optional. Never shown to recruiters or used in decisions.";
export const MIN_K = 5;
export const MIN_NOTICE_DAYS = 10;
export const FOUR_FIFTHS = 0.8;

/** The only dimensions Talent OS may ever collect (no caste, religion or race/ethnicity). */
export const ALLOWED_DIMENSIONS: readonly DimensionKey[] = ["gender", "age_band", "disability"];

export function isAllowedDimension(key: unknown): key is DimensionKey {
  return typeof key === "string" && (ALLOWED_DIMENSIONS as readonly string[]).includes(key);
}

/** Enabled, allowed dimensions in display order (anything else the API might send is dropped). */
export function visibleDimensions(dims: readonly DimensionOut[]): DimensionOut[] {
  return dims.filter((d) => d.enabled && isAllowedDimension(d.key)).sort((a, b) => a.position - b.position);
}

/** Options of a dimension, always including "Prefer not to say" (last). */
export function dimensionOptions(dim: DimensionOut): { key: string; label: string }[] {
  const rest = dim.options.filter((o) => o.key !== PREFER_NOT);
  const prefer = dim.options.find((o) => o.key === PREFER_NOT) ?? { key: PREFER_NOT, label: PREFER_NOT_LABEL };
  return [...rest, prefer];
}

/** One answer per visible dimension: the existing valid answer, else "prefer_not_to_say". */
export function defaultAnswers(dims: readonly DimensionOut[], existing?: SelfIdAnswers | null): SelfIdAnswers {
  const out: SelfIdAnswers = {};
  for (const d of visibleDimensions(dims)) {
    const v = existing?.[d.key];
    out[d.key] = v && dimensionOptions(d).some((o) => o.key === v) ? v : PREFER_NOT;
  }
  return out;
}

/** Answers restricted to visible dimensions and their option keys (the payload sent to the API). */
export function answersPayload(dims: readonly DimensionOut[], answers: SelfIdAnswers): SelfIdAnswers {
  const out: SelfIdAnswers = {};
  for (const d of visibleDimensions(dims)) {
    const v = answers[d.key];
    out[d.key] = v && dimensionOptions(d).some((o) => o.key === v) ? v : PREFER_NOT;
  }
  return out;
}

// ---------------------------------------------------------------- report cells

export function isSuppressedCell(cell: Cell | null | undefined): boolean {
  return typeof cell === "string";
}

/** A count cell: numbers formatted, suppressed strings (e.g. "<5") shown verbatim. */
export function cellText(cell: Cell | null | undefined, suppressedLabel = `<${MIN_K}`): string {
  if (cell === null || cell === undefined) return "—";
  if (typeof cell === "string") return cell.trim() || suppressedLabel;
  return Number.isFinite(cell) ? cell.toLocaleString("en-US") : "—";
}

export function formatRate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : value;
}

export function formatRatio(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : value;
}

export const UNKNOWN_LABEL = "Unknown / prefer not to say";

/** Rows with the unknown row always present (added with zero counts if missing) and sorted last. */
export function orderedRows(rows: readonly SnapshotRow[]): SnapshotRow[] {
  const known = rows.filter((r) => !r.unknown);
  const unknown = rows.filter((r) => r.unknown);
  const tail: SnapshotRow[] = unknown.length
    ? unknown
    : [
        {
          category: "unknown",
          label: UNKNOWN_LABEL,
          unknown: true,
          suppressed: false,
          applicants: 0,
          selected: 0,
          rate: null,
          impact_ratio: null,
          flag: null,
        },
      ];
  return [...known, ...tail];
}

export type BadgeColor = "success" | "warning" | "danger" | "informative" | "subtle" | "brand";

/** Four-fifths rule badge: flag true = impact ratio below 0.8. Null when not applicable. */
export function fourFifthsBadge(flag: boolean | null | undefined): { label: string; color: BadgeColor } | null {
  if (flag === true) return { label: "Below 4/5", color: "danger" };
  if (flag === false) return { label: "Meets 4/5", color: "success" };
  return null;
}

/** Whether any non-unknown row of a table carries the scoring-rate columns. */
export function hasScoring(rows: readonly SnapshotRow[]): boolean {
  return rows.some((r) => r.scoring_rate !== undefined || r.scoring_impact_ratio !== undefined);
}

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  gender: "Gender",
  age_band: "Age band",
  disability: "Disability",
};

/** "Gender × Age band" from a table's dimensions (or its key). */
export function tableTitle(dimensions: readonly string[], key: string): string {
  const parts = dimensions.length ? dimensions : key.split(/[×|]/);
  return parts.map((d) => (isAllowedDimension(d) ? DIMENSION_LABELS[d] : d)).join(" × ");
}

// ---------------------------------------------------------------- runs

export const SELECTION_POINT_LABELS: Record<SelectionPoint, string> = {
  stage_transition: "Pipeline stage transition",
  ai_match_threshold: "AI Match score threshold",
  ai_screening_pass: "AI Screening pass",
  assessment_pass: "Assessment pass",
  agent_shortlist_added: "Agent shortlist → added to pipeline",
  agent_screening_flag_advanced: "Agent screening flag → advanced",
  agent_draft_rating_accepted: "Interview Assistant draft rating accepted",
};

/** Epic 65: the agent selection points, offered only when the server reports them `available`. */
export const AGENT_SELECTION_POINTS: readonly SelectionPoint[] = [
  "agent_shortlist_added",
  "agent_screening_flag_advanced",
  "agent_draft_rating_accepted",
];
export const SCREENING_SOURCES = [
  { value: "text", label: "Text" },
  { value: "voice", label: "Voice" },
  { value: "both", label: "Both" },
] as const;

/** Selection points of the run form: the base ones plus each agent point the server lists as available. */
export function runSelectionPoints(available: readonly { key: string; available: boolean }[] | undefined): SelectionPoint[] {
  const base = (Object.keys(SELECTION_POINT_LABELS) as SelectionPoint[]).filter((p) => !AGENT_SELECTION_POINTS.includes(p));
  const extra = AGENT_SELECTION_POINTS.filter((p) => (available ?? []).some((a) => a.key === p && a.available));
  return [...base, ...extra];
}

export const METHOD_LABELS: Record<string, string> = {
  selection_rate: "Selection rate (selected ÷ applicants per category)",
  scoring_rate: "Scoring rate (share of the category scoring above the median score)",
  both: "Selection rate and scoring rate",
};

export const INTERSECTIONS: readonly Intersection[] = ["gender×age_band", "gender×disability"];

export const RUN_STATUS: Record<RunStatus, { label: string; color: BadgeColor }> = {
  queued: { label: "Queued", color: "informative" },
  running: { label: "Running", color: "brand" },
  completed: { label: "Completed", color: "success" },
  failed: { label: "Failed", color: "danger" },
};

export function isRunActive(status: RunStatus | string | null | undefined): boolean {
  return status === "queued" || status === "running";
}

export type RunDraft = {
  selection_point: SelectionPoint;
  from_stage_key: string | null;
  to_stage_key: string | null;
  min_score: number | null;
  assessment_id: string | null;
  source: "text" | "voice" | "both";
  min_accepted_share: number | null;
  date_from: string;
  date_to: string;
  demand_ids: string[];
  client_id: string | null;
  job_category: string;
  intersections: Intersection[];
};

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function defaultRunDraft(today = new Date()): RunDraft {
  const from = new Date(today);
  from.setFullYear(from.getFullYear() - 1);
  return {
    selection_point: "ai_match_threshold",
    from_stage_key: null,
    to_stage_key: null,
    min_score: 70,
    assessment_id: null,
    source: "both",
    min_accepted_share: null,
    date_from: isoDate(from),
    date_to: isoDate(today),
    demand_ids: [],
    client_id: null,
    job_category: "",
    intersections: ["gender×age_band"],
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function runDraftErrors(d: RunDraft): Partial<Record<keyof RunDraft, string>> {
  const e: Partial<Record<keyof RunDraft, string>> = {};
  if (d.selection_point === "stage_transition" && !d.to_stage_key) e.to_stage_key = "Choose the stage candidates move to.";
  if (d.selection_point === "ai_match_threshold") {
    if (d.min_score === null || !Number.isFinite(d.min_score) || d.min_score < 0 || d.min_score > 100) e.min_score = "Enter a score from 0 to 100.";
  }
  if (d.selection_point === "assessment_pass" && !d.assessment_id) e.assessment_id = "Choose an assessment.";
  if (d.selection_point === "agent_draft_rating_accepted" && d.min_accepted_share !== null) {
    if (!Number.isFinite(d.min_accepted_share) || d.min_accepted_share < 0 || d.min_accepted_share > 1) e.min_accepted_share = "Enter a share from 0 to 1.";
  }
  if (!DATE_RE.test(d.date_from)) e.date_from = "Enter a start date.";
  if (!DATE_RE.test(d.date_to)) e.date_to = "Enter an end date.";
  if (!e.date_from && !e.date_to && d.date_from > d.date_to) e.date_to = "The end date must be on or after the start date.";
  return e;
}

export function runCreatePayload(d: RunDraft): RunCreate {
  const params: RunCreate["params"] = {};
  if (d.selection_point === "stage_transition") {
    params.from_stage_key = d.from_stage_key;
    params.to_stage_key = d.to_stage_key;
  } else if (d.selection_point === "ai_match_threshold") {
    params.min_score = d.min_score;
  } else if (d.selection_point === "assessment_pass") {
    params.assessment_id = d.assessment_id;
  } else if (d.selection_point === "agent_screening_flag_advanced") {
    params.source = d.source;
  } else if (d.selection_point === "agent_draft_rating_accepted" && d.min_accepted_share !== null) {
    params.min_accepted_share = d.min_accepted_share;
  }
  const filters: RunCreate["filters"] = {};
  if (d.demand_ids.length) filters.demand_ids = [...d.demand_ids];
  if (d.client_id) filters.client_id = d.client_id;
  if (d.job_category.trim()) filters.job_category = d.job_category.trim();
  return {
    selection_point: d.selection_point,
    params,
    date_from: d.date_from,
    date_to: d.date_to,
    filters,
    intersections: d.intersections.filter((i) => INTERSECTIONS.includes(i)),
  };
}

/** "Score ≥ 70", "→ Shortlisted" etc. for the runs list. */
export function runParamsText(point: SelectionPoint, params: Record<string, unknown>): string {
  if (point === "ai_match_threshold" && params.min_score !== undefined && params.min_score !== null) return `Score ≥ ${String(params.min_score)}`;
  if (point === "stage_transition") {
    const from = typeof params.from_stage_key === "string" ? params.from_stage_key : "any stage";
    const to = typeof params.to_stage_key === "string" ? params.to_stage_key : "?";
    return `${from} → ${to}`;
  }
  return "";
}

/** Pack file links are relative API paths; accept both `/api/v1/...` and `/fairness/...`. */
export function packFileHref(url: string): string {
  if (url.startsWith("/api/")) return url;
  return `/api/v1${url.startsWith("/") ? "" : "/"}${url}`;
}

// ---------------------------------------------------------------- AEDT inventory

export const AEDT_FEATURE_LABELS: Record<AedtFeature, string> = {
  ai_match: "AI Match",
  ai_screening: "AI Screening",
  assessment_autoscore: "Assessment auto-scoring",
  other: "Other",
  agent_sourcing: "Sourcing Agent",
  agent_screening: "Screening Agent",
  agent_voice_screening: "Voice Screening",
  agent_interview_assist: "Interview Assistant",
};

export const AEDT_STATUS: Record<AedtStatus, { label: string; color: BadgeColor }> = {
  active: { label: "Active", color: "success" },
  inactive: { label: "Inactive (confirm)", color: "warning" },
  retired: { label: "Retired", color: "subtle" },
};

// ---------------------------------------------------------------- settings

export function clampMin(value: number | null | undefined, min: number): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return min;
  return Math.max(min, Math.round(value));
}

// ---------------------------------------------------------------- notice / hidden scores

/** The LL144 notice block renders only for a notice that applies. */
export function showNoticeBlock(notice: PublicNoticeOut | null | undefined): notice is PublicNoticeOut {
  return !!notice && notice.applies === true;
}

export const SCORE_HIDDEN_LABELS: Record<ScoreHiddenReason, string> = {
  alternative_process: "Hidden — alternative process requested",
  notice_period: "Hidden — notice period",
};

/** Reads the optional `score_hidden_reason` field from any API object (matching, pipeline, assessments). */
export function scoreHiddenReason(obj: unknown): ScoreHiddenReason | null {
  if (!obj || typeof obj !== "object") return null;
  const v = (obj as { score_hidden_reason?: unknown }).score_hidden_reason;
  return v === "alternative_process" || v === "notice_period" ? v : null;
}

export function scoreHiddenLabel(reason: ScoreHiddenReason | null | undefined): string | null {
  return reason ? SCORE_HIDDEN_LABELS[reason] : null;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}
