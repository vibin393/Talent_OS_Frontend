/** Pure helpers of the Talent Pools UI (Epic 38): labels, template availability, refresh and diff text. */
import type { Visibility } from "@/features/segments/types";
import { isApiError } from "@/lib/api/errors";
import type {
  ConsentState,
  MemberReason,
  MemberSource,
  PipelineAddItem,
  PoolFilter,
  PoolKind,
  PoolOut,
  PoolTemplate,
  RefreshOut,
  RefreshStatus,
  RefreshTrigger,
} from "./types";

type BadgeColor = "brand" | "success" | "warning" | "danger" | "informative" | "subtle";

export const POOL_FILTERS: { value: PoolFilter; label: string }[] = [
  { value: "all", label: "All pools" },
  { value: "mine", label: "My pools" },
  { value: "team", label: "Team pools" },
  { value: "tenant", label: "Organization pools" },
];

export const KIND_LABELS: Record<PoolKind, string> = { static: "Static", dynamic: "Dynamic" };
export const KIND_COLORS: Record<PoolKind, BadgeColor> = { static: "informative", dynamic: "brand" };

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  private: "Private",
  team: "Team",
  tenant: "Organization",
};

export const SOURCE_LABELS: Record<MemberSource, string> = {
  manual: "Added by hand",
  segment: "Segment",
  legacy_list: "Saved list",
  workflow: "Workflow",
};

export const CONSENT_LABELS: Record<ConsentState, string> = { granted: "Granted", withdrawn: "Withdrawn", none: "Not given" };
export const CONSENT_COLORS: Record<ConsentState, BadgeColor> = { granted: "success", withdrawn: "danger", none: "subtle" };

export const REFRESH_STATUS: Record<RefreshStatus, { label: string; color: BadgeColor }> = {
  running: { label: "Running", color: "informative" },
  done: { label: "Done", color: "success" },
  failed: { label: "Failed", color: "danger" },
  skipped_needs_repair: { label: "Skipped: needs repair", color: "warning" },
};

export const TRIGGER_LABELS: Record<RefreshTrigger, string> = {
  nightly: "Nightly",
  manual: "Manual",
  skill_graph: "Skill graph change",
  created: "Pool created",
};

/** Visibilities the user may pick: Organization needs `pool:manage`. */
export function visibilityOptions(canManage: boolean): Visibility[] {
  return canManage ? ["private", "team", "tenant"] : ["private", "team"];
}

/** "+3 / −1" for a refresh diff, or "No changes". */
export function diffText(diff: { added: number; removed: number } | null | undefined): string {
  if (!diff) return "—";
  if (!diff.added && !diff.removed) return "No changes";
  return `+${diff.added} / −${diff.removed}`;
}

/** Template availability as rendered in the Templates dialog. */
export function templateStatus(t: PoolTemplate): { label: string; color: BadgeColor; canEnable: boolean; reason: string | null } {
  if (t.enabled) return { label: "Enabled", color: "success", canEnable: false, reason: null };
  if (!t.available) {
    return {
      label: "Unavailable",
      color: "subtle",
      canEnable: false,
      reason: t.unavailable_reason?.trim() || "The fields this template needs are not available yet.",
    };
  }
  return { label: "Available", color: "informative", canEnable: true, reason: null };
}

/** Templates whose enable action needs a batch value (campus templates). */
export function templateNeedsBatch(t: Pick<PoolTemplate, "key">): boolean {
  return t.key.startsWith("campus");
}

/** User-facing message for a failed template enable. */
export function templateErrorMessage(e: unknown): string | null {
  if (!isApiError(e)) return null;
  if (e.code === "template_unavailable") return "This template is not available yet: the fields it needs are not registered.";
  if (e.code === "template_enabled") return "This template is already enabled.";
  return null;
}

/** User-facing message for a refused manual refresh. */
export function refreshErrorMessage(e: unknown): string | null {
  if (!isApiError(e)) return null;
  if (e.status === 429) return "This pool was refreshed less than 5 minutes ago. Try again shortly.";
  return null;
}

/** Short reason tags of a member: matched criteria and skill weights, or who added it. */
export function reasonTags(reason: MemberReason | null | undefined, source: MemberSource): string[] {
  if (!reason) return [SOURCE_LABELS[source]];
  const tags: string[] = [];
  for (const m of reason.matched ?? []) tags.push(m.label || `${m.field} ${m.op}`);
  for (const s of reason.skills ?? []) {
    const w = Number(s.weight);
    tags.push(Number.isFinite(w) && w < 1 ? `${s.skill_key} (${Math.round(w * 100)}%)` : s.skill_key);
  }
  if (reason.note) tags.push(reason.note);
  if (tags.length === 0) tags.push(SOURCE_LABELS[source]);
  return tags;
}

/** "3 added, 1 already in the pipeline, 1 failed". */
export function pipelineResultText(items: PipelineAddItem[]): string {
  const n = (s: PipelineAddItem["status"]) => items.filter((i) => i.status === s).length;
  const parts = [`${n("created")} added`];
  if (n("exists")) parts.push(`${n("exists")} already in the pipeline`);
  if (n("error")) parts.push(`${n("error")} failed`);
  return parts.join(", ");
}

/** The latest refresh is still running. */
export function isRefreshing(refreshes: RefreshOut[] | undefined): boolean {
  return !!refreshes?.some((r) => r.status === "running");
}

/** "N matching Pools" for the rediscovery card ("" when none). */
export function matchingPoolsText(n: number | null | undefined): string {
  if (!n) return "";
  return `${n} matching ${n === 1 ? "Pool" : "Pools"}`;
}

/** Whether the pool members can be changed by hand. */
export function canEditMembers(pool: Pick<PoolOut, "kind" | "can_edit" | "status">): boolean {
  return pool.kind === "static" && pool.can_edit && pool.status === "active";
}
