"use client";

import { Body1, Caption1, Card, Field, Input, Text } from "@fluentui/react-components";
import { useState } from "react";
import { ErrorBlock, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { ApiError } from "@/lib/api/errors";
import { useClientLeaveCalendar } from "./use-leave-calendar";
import { clientCalendarCells, monthDates } from "./validation";

/** `/client/leave-calendar`: who is on leave this month ("On leave" only; no type, reason or balances). */
export function ClientLeaveCalendar() {
  const portal = usePortalStyles();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const dates = monthDates(month);
  const q = useClientLeaveCalendar(dates[0], dates[dates.length - 1]);
  if (q.isPending) return <LoadingBlock label="Loading leave calendar" />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 404)
      return (
        <div className={portal.page}>
          <PortalPageHeader title="Leave calendar" />
          <Body1>The leave calendar is not enabled for your organization.</Body1>
        </div>
      );
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  }
  const cells = clientCalendarCells(q.data);
  return (
    <div className={portal.page}>
      <PortalPageHeader title="Leave calendar" subtitle="Workers on leave this month." />
      <Field label="Month">
        <Input type="month" value={month.slice(0, 7)} onChange={(_, d) => d.value && setMonth(`${d.value}-01`)} />
      </Field>
      <Card className={portal.card}>
        {cells.length === 0 ? (
          <Body1 className={portal.empty}>Nobody is on leave this month.</Body1>
        ) : (
          <ul className={portal.list}>
            {cells.map((c) => (
              <li key={`${c.worker}-${c.date}`} className={portal.row}>
                <Text weight="semibold">{c.worker}</Text>
                <Caption1>
                  {c.date} · {c.text}
                </Caption1>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
