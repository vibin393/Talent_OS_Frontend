import type { GenericSlaTargetIn, GenericSlaTargetOut, SlaClockStatus, SlaMilestoneOut, SlaPriority } from "./types";

/** Pure helpers of the Phase 2 SLA admin and the shared SLA badge (Epic 32). */

export const STATUS_LABELS: Record<SlaClockStatus, string> = {
  healthy: "Healthy",
  at_risk: "At risk",
  breached: "Breached",
  met: "Met",
  cancelled: "Cancelled",
};

/** Badge colour per status (Fluent `Badge` `color`). */
export const STATUS_COLORS: Record<SlaClockStatus, "success" | "warning" | "danger" | "subtle" | "informative"> = {
  healthy: "success",
  at_risk: "warning",
  breached: "danger",
  met: "subtle",
  cancelled: "informative",
};

export const SCOPE_LABELS: Record<string, string> = {
  vendor_id: "Vendor",
  client_id: "Client",
  bgv_package_id: "BGV package",
  route_step: "Route step",
  priority: "Priority",
};

export const PRIORITY_OPTIONS: readonly SlaPriority[] = ["low", "medium", "high", "critical"];

export function humanize(key: string): string {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type TargetDraft = {
  subjectType: string;
  milestone: string;
  scopeKey: string | null;
  scopeValue: string;
  priority: SlaPriority | null;
  targetHours: string;
  atRiskPercent: string;
  calendar: "business" | "calendar";
  isActive: boolean;
};

export function emptyTarget(m?: SlaMilestoneOut): TargetDraft {
  return {
    subjectType: m?.subject_type ?? "",
    milestone: m?.milestone ?? "",
    scopeKey: null,
    scopeValue: "",
    priority: null,
    targetHours: "24",
    atRiskPercent: "75",
    calendar: m?.calendar === "calendar" ? "calendar" : "business",
    isActive: true,
  };
}

export function targetDraft(t: GenericSlaTargetOut): TargetDraft {
  const [scopeKey, scopeValue] = Object.entries(t.scope)[0] ?? [null, ""];
  return {
    subjectType: t.subject_type,
    milestone: t.milestone,
    scopeKey,
    scopeValue: scopeValue ?? "",
    priority: t.priority,
    targetHours: String(Number(t.target_hours)),
    atRiskPercent: String(t.at_risk_percent),
    calendar: t.calendar,
    isActive: t.is_active,
  };
}

export type TargetErrors = Partial<Record<"milestone" | "scope" | "targetHours" | "atRiskPercent", string>>;

/** Mirrors the API rules: hours in (0, 8760], at-risk 1-99 %, scope key from the milestone. */
export function validateTarget(d: TargetDraft, milestone: SlaMilestoneOut | undefined): TargetErrors {
  const errors: TargetErrors = {};
  if (!d.subjectType || !d.milestone) errors.milestone = "Choose a milestone.";
  else if (d.subjectType === "demand") errors.milestone = "Demand SLAs are set on the Demands tab.";
  const hours = Number(d.targetHours);
  if (!d.targetHours.trim() || !Number.isFinite(hours) || hours <= 0 || hours > 8760) errors.targetHours = "Enter 0.01 to 8760 hours.";
  const pct = Number(d.atRiskPercent);
  if (!Number.isInteger(pct) || pct < 1 || pct > 99) errors.atRiskPercent = "Enter a whole number from 1 to 99.";
  if (d.scopeKey) {
    if (milestone && !milestone.scope_keys.includes(d.scopeKey)) errors.scope = "This scope does not apply to the milestone.";
    else if (!d.scopeValue.trim()) errors.scope = `Choose the ${SCOPE_LABELS[d.scopeKey]?.toLowerCase() ?? "scope"}.`;
  }
  return errors;
}

export function targetIn(d: TargetDraft): GenericSlaTargetIn {
  return {
    subject_type: d.subjectType,
    milestone: d.milestone,
    scope: d.scopeKey && d.scopeValue.trim() ? { [d.scopeKey]: d.scopeValue.trim() } : {},
    priority: d.priority,
    target_hours: d.targetHours.trim(),
    at_risk_percent: Number(d.atRiskPercent),
    calendar: d.calendar,
    is_active: d.isActive,
  };
}

export type TargetGroup = { subjectType: string; label: string; rows: GenericSlaTargetOut[] };

/** Targets grouped by subject type (grid sections), in milestone order. */
export function groupTargets(targets: readonly GenericSlaTargetOut[]): TargetGroup[] {
  const groups = new Map<string, GenericSlaTargetOut[]>();
  for (const t of targets) {
    if (t.subject_type === "demand") continue;
    groups.set(t.subject_type, [...(groups.get(t.subject_type) ?? []), t]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([subjectType, rows]) => ({
      subjectType,
      label: humanize(subjectType),
      rows: [...rows].sort((a, b) => a.milestone.localeCompare(b.milestone) || Object.keys(a.scope).length - Object.keys(b.scope).length),
    }));
}

export function scopeText(t: Pick<GenericSlaTargetOut, "scope">): string {
  const entries = Object.entries(t.scope);
  if (entries.length === 0) return "All";
  return entries.map(([k, v]) => `${SCOPE_LABELS[k] ?? humanize(k)}: ${v.length > 12 ? `${v.slice(0, 8)}…` : v}`).join(", ");
}

export function hoursText(hours: string | number): string {
  const h = Number(hours);
  if (!Number.isFinite(h)) return String(hours);
  if (h >= 24 && h % 24 === 0) return `${h / 24} ${h / 24 === 1 ? "day" : "days"}`;
  return `${h} ${h === 1 ? "hour" : "hours"}`;
}

/** Tooltip text of the shared SLA badge. */
export function badgeTooltip(status: SlaClockStatus, dueAt: string, now: Date = new Date()): string {
  const due = new Date(dueAt);
  const when = due.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  if (status === "met") return `Met (was due ${when})`;
  if (status === "cancelled") return `Cancelled (was due ${when})`;
  if (status === "breached") return `Breached: was due ${when}`;
  const mins = Math.round((due.getTime() - now.getTime()) / 60000);
  const left = mins >= 120 ? `${Math.round(mins / 60)} h` : `${Math.max(mins, 0)} min`;
  return `Due ${when} (${left} left)`;
}
