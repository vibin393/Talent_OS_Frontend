/**
 * Pure helpers for the Epic 48 prediction UI (badge mapping, permission gating, progress text,
 * contribution bars, batch lookup). Kept free of React so Vitest can cover them in the node environment.
 */
import { hasPermission, type PermissionMap } from "@/features/auth/permissions";
import type {
  AnalyticsSettings,
  Contribution,
  ModelStatus,
  PredictionBand,
  PredictionBatchItem,
  PredictionEntry,
  PredictionInterval,
  PredictionProgress,
  PredictionSubjectKind,
} from "./types";

export const PERM_READ = "prediction:read";
export const PERM_READ_ATTRITION = "prediction:read_attrition";
export const PERM_MODEL_MANAGE = "model:manage";

export const SUPPORTING_SIGNAL = "Supporting signal";
export const DEFAULT_DISCLAIMER = "Supporting signal, not a decision";
export const EXPLANATION_UNAVAILABLE = "Explanation unavailable – see the contributions above";
export const DISABLED_TEXT = "Turned off by your administrator";
export const NO_MODEL_TEXT = "No model yet. Predictions appear after the first successful training run.";
export const TOP_CONTRIBUTIONS = 5;

export type BadgeColor = "success" | "warning" | "danger" | "informative" | "subtle";

export const BAND_BADGE: Record<PredictionBand, { label: string; color: BadgeColor }> = {
  low: { label: "Low", color: "success" },
  medium: { label: "Medium", color: "warning" },
  high: { label: "High", color: "danger" },
};

export function bandBadge(band: string | null | undefined): { label: string; color: BadgeColor } | null {
  return band && band in BAND_BADGE ? BAND_BADGE[band as PredictionBand] : null;
}

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** "≈ 34 days (25–48)"; null without a prediction. */
export function formatDays(predictedDays: string | null | undefined, interval: PredictionInterval | null | undefined): string | null {
  const days = toNumber(predictedDays);
  if (days === null) return null;
  const rounded = Math.round(days);
  const base = `≈ ${rounded} ${rounded === 1 ? "day" : "days"}`;
  const lo = toNumber(interval?.p20);
  const hi = toNumber(interval?.p80);
  return lo !== null && hi !== null ? `${base} (${Math.round(lo)}–${Math.round(hi)})` : base;
}

/** "0.62" from "0.6200". */
export function formatProbability(score: string | null | undefined): string | null {
  const n = toNumber(score);
  return n === null ? null : n.toFixed(2);
}

/** What the compact badge shows for one prediction, or null when there is nothing to show. */
export type BadgeView = { text: string; color: BadgeColor };

export function predictionBadgeView(p: {
  kind: string;
  status: string;
  band: string | null;
  predicted_days: string | null;
  interval: PredictionInterval | null;
  score?: string | null;
}): BadgeView | null {
  if (p.status !== "ok") return null;
  if (p.kind === "time_to_fill") {
    const text = formatDays(p.predicted_days ?? p.score ?? null, p.interval);
    return text ? { text, color: "informative" } : null;
  }
  const band = bandBadge(p.band);
  return band ? { text: band.label, color: band.color } : null;
}

/** The panel is shown only to `prediction:read` holders. */
export function canSeePredictions(permissions: PermissionMap): boolean {
  return hasPermission(permissions, PERM_READ);
}

/**
 * Entries the user may see: attrition only with `prediction:read_attrition` (the backend omits it too;
 * this is the belt-and-braces client gate). Nothing at all without `prediction:read`.
 */
export function visibleEntries(entries: readonly PredictionEntry[], permissions: PermissionMap): PredictionEntry[] {
  if (!canSeePredictions(permissions)) return [];
  const attrition = hasPermission(permissions, PERM_READ_ATTRITION);
  return entries.filter((e) => e.kind !== "attrition" || attrition);
}

/** "Not enough data yet (150 of 200)", with the minority class when that is the short side. */
export function progressText(progress: PredictionProgress | null | undefined): string {
  if (!progress) return "Not enough data yet";
  const parts: string[] = [];
  const samplesShort = progress.n < progress.required;
  if (samplesShort) parts.push(`${progress.n} of ${progress.required}`);
  const minorityShort =
    progress.n_minority !== null && progress.required_minority !== null && progress.n_minority < progress.required_minority;
  if (minorityShort) parts.push(`${progress.n_minority} of ${progress.required_minority} in the minority class`);
  if (parts.length === 0) parts.push(`${progress.n} of ${progress.required}`);
  return `Not enough data yet (${parts.join("; ")})`;
}

/** Progress as a 0..1 fraction for a `ProgressBar` (the shorter of samples and minority). */
export function progressValue(progress: PredictionProgress | null | undefined): number {
  if (!progress || progress.required <= 0) return 0;
  let v = progress.n / progress.required;
  if (progress.n_minority !== null && progress.required_minority) v = Math.min(v, progress.n_minority / progress.required_minority);
  return Math.max(0, Math.min(1, v));
}

/** Top `limit` contributions (already sorted by |contribution| desc by the backend; re-sorted defensively). */
export function topContributions(list: readonly Contribution[], showAll: boolean, limit = TOP_CONTRIBUTIONS): Contribution[] {
  const sorted = [...list].sort((a, b) => Math.abs(toNumber(b.contribution) ?? 0) - Math.abs(toNumber(a.contribution) ?? 0));
  return showAll ? sorted : sorted.slice(0, limit);
}

/** Bar width in percent relative to the largest |contribution| shown. */
export function contributionWidth(c: Contribution, list: readonly Contribution[]): number {
  const max = Math.max(0, ...list.map((x) => Math.abs(toNumber(x.contribution) ?? 0)));
  if (max <= 0) return 0;
  return Math.max(2, Math.round((Math.abs(toNumber(c.contribution) ?? 0) / max) * 100));
}

/** Text that carries the direction (meaning is never colour alone). */
export function directionText(kind: string, direction: Contribution["direction"]): string {
  if (kind === "time_to_fill") return direction === "up" ? "adds time" : "saves time";
  return direction === "up" ? "raises risk" : "lowers risk";
}

/** The kinds a subject may carry, in display order. */
export const SUBJECT_KINDS: Record<PredictionSubjectKind, readonly string[]> = {
  demand: ["time_to_fill"],
  offer: ["offer_drop"],
  placement: ["offer_drop", "attrition"],
};

/** subject_id -> the first `ok` batch item in `preferred` kind order (attrition dropped without permission). */
export function batchBySubject(
  items: readonly PredictionBatchItem[],
  preferred: readonly string[],
  permissions: PermissionMap,
): Map<string, PredictionBatchItem> {
  const attrition = hasPermission(permissions, PERM_READ_ATTRITION);
  const out = new Map<string, PredictionBatchItem>();
  const rank = (k: string) => {
    const i = preferred.indexOf(k);
    return i < 0 ? preferred.length : i;
  };
  for (const item of items) {
    if (item.status !== "ok") continue;
    if (item.kind === "attrition" && !attrition) continue;
    const current = out.get(item.subject_id);
    if (!current || rank(item.kind) < rank(current.kind)) out.set(item.subject_id, item);
  }
  return out;
}

/** Batch requests take at most 200 ids. */
export const BATCH_LIMIT = 200;

export const MODEL_STATUS: Record<ModelStatus, { label: string; color: BadgeColor }> = {
  active: { label: "Active", color: "success" },
  insufficient_data: { label: "Not enough data", color: "warning" },
  failed: { label: "Failed", color: "danger" },
  disabled: { label: "Off", color: "subtle" },
  no_model: { label: "No model yet", color: "informative" },
  training: { label: "Training", color: "informative" },
};

export function modelStatus(status: string): { label: string; color: BadgeColor } {
  return MODEL_STATUS[status as ModelStatus] ?? { label: status.replace(/_/g, " "), color: "informative" };
}

export const FAILURE_LABELS: Record<string, string> = {
  below_baseline: "Did not beat the baseline",
  insufficient_data: "Not enough data",
  single_class: "Only one outcome in the data",
  error: "Training error",
};

export function failureLabel(code: string | null | undefined): string {
  if (!code) return "";
  return FAILURE_LABELS[code] ?? code.replace(/_/g, " ");
}

export const METRIC_LABELS: Record<string, string> = {
  auc: "AUC (higher is better)",
  brier: "Brier score (lower is better)",
  mae_days: "Mean absolute error, days (lower is better)",
  coverage: "Interval coverage",
};

/** Settings form errors (client-side mirror of the 422s). */
export function settingsErrors(s: AnalyticsSettings): string[] {
  const errors: string[] = [];
  if (s.min_samples < s.platform_min_samples) errors.push(`Minimum samples cannot be below ${s.platform_min_samples}.`);
  if (s.min_minority < s.platform_min_minority) errors.push(`Minimum minority class cannot be below ${s.platform_min_minority}.`);
  for (const kind of ["offer_drop", "attrition"] as const) {
    const t = s.band_thresholds[kind];
    const m = toNumber(t.medium);
    const h = toNumber(t.high);
    const name = kind === "offer_drop" ? "Offer drop" : "Attrition";
    if (m === null || h === null || m <= 0 || h >= 1 || m >= h) errors.push(`${name} thresholds must satisfy 0 < medium < high < 1.`);
  }
  return errors;
}
