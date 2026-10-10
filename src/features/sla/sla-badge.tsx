"use client";

import { Badge, Tooltip } from "@fluentui/react-components";
import { Checkmark12Regular, Clock12Regular, ErrorCircle12Regular, Warning12Regular } from "@fluentui/react-icons";
import { badgeTooltip, STATUS_COLORS, STATUS_LABELS } from "./sla-model";
import type { SlaClockStatus } from "./types";

const ICONS: Record<SlaClockStatus, React.ReactElement> = {
  healthy: <Clock12Regular />,
  at_risk: <Warning12Regular />,
  breached: <ErrorCircle12Regular />,
  met: <Checkmark12Regular />,
  cancelled: <Clock12Regular />,
};

/**
 * Shared SLA badge (Epic 32 B5): Healthy success / At risk warning / Breached danger / Met subtle, with the due
 * time in a tooltip. Domain epics render it on their lists from `GET /sla/clocks` or `clocks_for`.
 */
export function SlaBadge({ status, dueAt, label }: { status: SlaClockStatus; dueAt: string; label?: string }) {
  const text = label ? `${label}: ${STATUS_LABELS[status]}` : STATUS_LABELS[status];
  return (
    <Tooltip content={badgeTooltip(status, dueAt)} relationship="description">
      <Badge appearance={status === "met" || status === "cancelled" ? "tint" : "filled"} color={STATUS_COLORS[status]} icon={ICONS[status]}>
        {text}
      </Badge>
    </Tooltip>
  );
}
