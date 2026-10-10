"use client";

import { Badge } from "@fluentui/react-components";
import { DSC_STATUS_BADGE, normalizeDscStatus } from "./logic";

/** DSC signing state of an invoice / credit note. `not_required` (or absent, e.g. debit notes) renders nothing
 * unless `showNotRequired` asks for a subtle "No DSC". */
export function DscStatusBadge({ status, showNotRequired }: { status: string | null | undefined; showNotRequired?: boolean }) {
  const meta = DSC_STATUS_BADGE[normalizeDscStatus(status)];
  if (!meta) {
    return showNotRequired ? (
      <Badge appearance="tint" color="subtle">
        No DSC
      </Badge>
    ) : null;
  }
  return (
    <Badge appearance="tint" color={meta.color}>
      {meta.label}
    </Badge>
  );
}
