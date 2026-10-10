"use client";

import { Badge, Body1, Caption1, Card, Text } from "@fluentui/react-components";
import NextLink from "next/link";
import { ErrorBlock, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { normalizeHours } from "./decimal";
import { formatPeriod, statusColor, statusLabel } from "./format";
import { useMyTimesheets } from "./use-my-timesheets";

/** `/portal/work/timesheets`: the Worker's timesheets (period, status, total hours). */
export function WorkerTimesheetList() {
  const portal = usePortalStyles();
  const q = useMyTimesheets();
  if (q.isPending) return <LoadingBlock label="Loading timesheets" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className={portal.page}>
      <PortalPageHeader title="My timesheets" subtitle="Enter your hours each period and submit them for approval." />
      <Card className={portal.card}>
        {q.data.length === 0 ? (
          <Body1 className={portal.empty}>You have no timesheets yet.</Body1>
        ) : (
          <ul className={portal.list}>
            {q.data.map((t) => (
              <li key={t.id} className={portal.row}>
                <span className={portal.rowMain}>
                  <NextLink href={`/portal/work/timesheets/${encodeURIComponent(t.id)}`} className={portal.rowTitle}>
                    {t.kind === "adjustment" ? `Adjustment · ${formatPeriod(t.period_start, t.period_end)}` : formatPeriod(t.period_start, t.period_end)}
                  </NextLink>
                  <Caption1>{[t.client_name, t.role_title, t.human_id].filter(Boolean).join(" · ")}</Caption1>
                </span>
                <span className={portal.actions}>
                  <Badge appearance="tint" color={statusColor(t.status)}>
                    {statusLabel(t.status)}
                  </Badge>
                  <Text weight="semibold">{normalizeHours(t.total_hours) || "0.00"} h</Text>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
