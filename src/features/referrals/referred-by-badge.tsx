"use client";

import { Badge, Tooltip } from "@fluentui/react-components";
import { usePermission } from "@/features/auth/use-permission";
import { formatDate, STATUS_LABELS } from "./logic";
import { useCandidateReferrals } from "./use-referrals";

/** Candidate 360 header: "Referred by …" when the candidate came in through a referral (needs `referral:read`). */
export function ReferredByBadge({ candidateId }: { candidateId: string }) {
  const canRead = usePermission("referral:read");
  const q = useCandidateReferrals(candidateId, canRead);
  const latest = q.data?.[0];
  if (!canRead || !latest) return null;
  const who = latest.referrer_name ?? (latest.referrer_kind === "worker" ? "a worker" : "an employee");
  return (
    <Tooltip
      relationship="description"
      content={`${latest.human_id} · ${STATUS_LABELS[latest.status] ?? latest.status} · ${formatDate(latest.created_at)}${
        q.data && q.data.length > 1 ? ` (+${q.data.length - 1} more)` : ""
      }`}
    >
      <Badge appearance="tint" color="brand" tabIndex={0}>
        {`Referred by ${who}`}
      </Badge>
    </Tooltip>
  );
}
