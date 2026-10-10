"use client";

import { Badge, Tooltip } from "@fluentui/react-components";
import { Sparkle16Regular } from "@fluentui/react-icons";

export interface AiBadgeProps {
  /** Agent display name, e.g. "Sourcing Agent". */
  agentName: string;
  /** The Accountable Owner the agent acted for. */
  ownerName?: string | null;
  /** Resolved autonomy mode of the action, when known. */
  mode?: "off" | "suggest" | "auto" | null;
  size?: "small" | "medium";
}

/** Tooltip text: "<Agent> for <Owner>" plus the resolved mode (Phase 4 consistency rule: AI output is always labelled). */
export function aiBadgeLabel({ agentName, ownerName, mode }: Pick<AiBadgeProps, "agentName" | "ownerName" | "mode">): string {
  const who = ownerName ? `${agentName} for ${ownerName}` : agentName;
  if (mode === "auto") return `${who} · ran automatically`;
  if (mode === "suggest") return `${who} · proposed, a person decides`;
  return who;
}

/** The "AI" badge shown on every agent-produced item (Epic 53). */
export function AiBadge({ agentName, ownerName, mode, size = "small" }: AiBadgeProps) {
  const label = aiBadgeLabel({ agentName, ownerName, mode });
  return (
    <Tooltip content={label} relationship="description">
      <Badge appearance="tint" color="brand" size={size} icon={<Sparkle16Regular />} aria-label={`AI: ${label}`}>
        AI
      </Badge>
    </Tooltip>
  );
}
