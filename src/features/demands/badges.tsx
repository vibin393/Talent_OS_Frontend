"use client";

import { Badge, Tooltip } from "@fluentui/react-components";
import { Archive16Regular, Clock16Regular } from "@fluentui/react-icons";
import type { DemandOut, DemandPriority, SlaClockOut, SlaStatus } from "@/lib/api/types";
import { formatDateTime } from "@/features/admin/ui";
import {
  MILESTONE_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  PROGRESS_LABELS,
  slaBadge,
  STATUS_COLORS,
  STATUS_LABELS,
} from "./status";

export function DemandStatusBadge({ demand }: { demand: Pick<DemandOut, "status" | "archived_at"> }) {
  if (demand.archived_at) {
    return (
      <Badge appearance="tint" color="subtle" icon={<Archive16Regular />}>
        Archived
      </Badge>
    );
  }
  return (
    <Badge appearance="tint" color={STATUS_COLORS[demand.status]}>
      {STATUS_LABELS[demand.status]}
    </Badge>
  );
}

export function ProgressBadge({ progress }: { progress: DemandOut["progress"] }) {
  if (!progress) return <span aria-label="No progress yet">—</span>;
  return (
    <Badge appearance="outline" color="informative">
      {PROGRESS_LABELS[progress]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: DemandPriority }) {
  return (
    <Badge appearance="ghost" color={PRIORITY_COLORS[priority]}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

/** SLA badge for a worst status; with `clock`, the tooltip names the milestone and due time. */
export function SlaBadge({ status, clock }: { status: SlaStatus | null | undefined; clock?: SlaClockOut }) {
  const b = slaBadge(status);
  if (!b) return <span aria-label="No SLA">—</span>;
  const badge = (
    <Badge appearance="tint" color={b.color} icon={<Clock16Regular />}>
      {clock ? `${MILESTONE_LABELS[clock.milestone]}: ${b.label}` : b.label}
    </Badge>
  );
  if (!clock) return badge;
  return (
    <Tooltip content={`Due ${formatDateTime(clock.due_at)}`} relationship="description">
      {badge}
    </Tooltip>
  );
}

/** Open clocks first, then by due time. */
export function sortClocks(clocks: readonly SlaClockOut[]): SlaClockOut[] {
  return [...clocks].sort((a, b) => {
    if (!!a.completed_at !== !!b.completed_at) return a.completed_at ? 1 : -1;
    return a.due_at.localeCompare(b.due_at);
  });
}
