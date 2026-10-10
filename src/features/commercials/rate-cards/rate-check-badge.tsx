"use client";

import { Badge, Spinner, Tooltip } from "@fluentui/react-components";
import { usePermission } from "@/features/auth/use-permission";
import { rateCheckView } from "../format";
import { type RateCheckInput, useRateCheck } from "./use-rate-check";

/** "Within rate card (min–max)" / "Outside rate card — needs approval" / "No matching rate card line" /
 * "Not validated", from a live preview. Mount it next to a bill-rate field (Demand form, Submit-to-client
 * Rates step, Offer form; later epics reuse it). Renders nothing until a bill rate is entered. */
export function RateCheckBadge({ input }: { input: RateCheckInput | null }) {
  const allowed = usePermission("rate_card:read");
  const check = useRateCheck(allowed ? input : null);
  if (!allowed || !input?.bill_rate) return null;
  if (check.isFetching && !check.data) return <Spinner size="extra-tiny" label="Checking rate card" />;
  if (!check.data) return null;
  const view = rateCheckView(check.data.result, check.data, input.currency);
  return (
    <Tooltip content="Checked against the client's effective rate card" relationship="description">
      <Badge appearance="tint" color={view.color} shape="rounded">
        {view.label}
      </Badge>
    </Tooltip>
  );
}
