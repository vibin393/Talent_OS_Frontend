"use client";

import { Badge, Tooltip } from "@fluentui/react-components";
import type { Subscription } from "./api";
import { subscriptionBadge } from "./logic";

/** Subscription status badge (Epic 68, B2): Pending verification / Active / Paused / Turned off. */
export function StatusBadge({ sub }: { sub: Pick<Subscription, "status" | "disabled_reason" | "paused"> }) {
  const b = subscriptionBadge(sub);
  const badge = (
    <Badge appearance="tint" color={b.intent}>
      {b.label}
    </Badge>
  );
  return b.tooltip ? (
    <Tooltip content={b.tooltip} relationship="description">
      {badge}
    </Tooltip>
  ) : (
    badge
  );
}
