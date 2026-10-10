"use client";

import { Badge } from "@fluentui/react-components";
import { Warning12Regular } from "@fluentui/react-icons";
import { isEscalationEntry } from "./escalation-model";

/** "Escalated" badge rendered on escalation entries of the activity feed. */
export function EscalatedBadge({ activity }: { activity: { kind: string; body: string } }) {
  if (!isEscalationEntry(activity)) return null;
  return (
    <Badge appearance="tint" color="warning" icon={<Warning12Regular />}>
      Escalated
    </Badge>
  );
}
