"use client";

import { Badge, Caption1, Text } from "@fluentui/react-components";
import NextLink from "next/link";
import { usePortalStyles } from "@/features/portal/ui";
import { formatDate, statusColor, statusLabel } from "./format";
import { formatMoney } from "./money";
import type { ClientClaimSummary } from "./types";

/** Client Portal summary row of an expense claim (billable lines only — never Worker reimbursement totals). */
export function ClientClaimCard({ claim }: { claim: ClientClaimSummary }) {
  const portal = usePortalStyles();
  return (
    <li className={portal.row}>
      <span className={portal.rowMain}>
        <NextLink href={`/client/expenses/${encodeURIComponent(claim.id)}`} className={portal.rowTitle}>
          {`${claim.worker_name ?? "Worker"} · ${claim.title || claim.human_id}`}
        </NextLink>
        <Caption1>
          {[
            claim.role_title,
            claim.human_id,
            `${claim.billable_line_count} billable expense${claim.billable_line_count === 1 ? "" : "s"}`,
            claim.submitted_at ? `Submitted ${formatDate(claim.submitted_at)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Caption1>
      </span>
      <span className={portal.actions}>
        <Badge appearance="tint" color={claim.awaiting_client ? "warning" : statusColor(claim.status)}>
          {claim.awaiting_client ? "Awaiting you" : statusLabel(claim.status)}
        </Badge>
        <Text weight="semibold">{formatMoney(claim.billable_total, claim.currency)}</Text>
      </span>
    </li>
  );
}
