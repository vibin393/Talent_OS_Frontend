"use client";

import { Badge, Tooltip } from "@fluentui/react-components";
import { EyeOff16Regular } from "@fluentui/react-icons";
import { scoreHiddenLabel } from "./logic";
import type { ScoreHiddenReason } from "./types";

/**
 * "Hidden — alternative process requested" / "Hidden — notice period" in place of an AEDT score (Epic 49).
 * Renders nothing without a reason.
 */
export function ScoreHiddenBadge({ reason, size = "small" }: { reason: ScoreHiddenReason | null | undefined; size?: "small" | "medium" | "large" }) {
  const label = scoreHiddenLabel(reason);
  if (!label) return null;
  return (
    <Tooltip content="Automated scores are not shown for this candidate (NYC Local Law 144)." relationship="description">
      <Badge appearance="tint" color="subtle" size={size} icon={<EyeOff16Regular />}>
        {label}
      </Badge>
    </Tooltip>
  );
}
