"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Field,
  Link as FluentLink,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeft20Regular, Checkmark20Regular, Dismiss20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { errorMessage } from "@/lib/api/errors";
import { TimesheetFlagBadges } from "./client-timesheet-card";
import { formatDelta, normalizeHours } from "./decimal";
import { categoryLabel, dayLabel, decisionError, formatPeriod, statusColor, statusLabel } from "./format";
import type { ClientDecision, ClientTimesheetDay } from "./types";
import { useClientTimesheet } from "./use-client-timesheets";

const useStyles = makeStyles({
  scroll: { overflowX: "auto" },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    "& th, & td": {
      padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
      borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
      textAlign: "end",
      fontVariantNumeric: "tabular-nums",
    },
    "& th:first-child, & td:first-child": { textAlign: "start", whiteSpace: "nowrap" },
  },
  comment: { color: tokens.colorNeutralForeground3, fontStyle: "italic" },
});

/** Read-only day x category grid (hours only). `signed` renders adjustment deltas with their sign. */
export function ClientHoursGrid({ days, signed = false, label }: { days: ClientTimesheetDay[]; signed?: boolean; label: string }) {
  const styles = useStyles();
  const cats = Array.from(new Set(days.flatMap((d) => Object.keys(d.hours))));
  const fmt = (v: string | undefined) => (v === undefined ? "—" : signed ? formatDelta(v) : normalizeHours(v));
  return (
    <div className={styles.scroll}>
      <table className={styles.table} aria-label={label}>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {cats.map((c) => (
              <th key={c} scope="col">
                {categoryLabel(c)}
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">
                {dayLabel(d.date)}
                {d.day_comment && <div className={styles.comment}>{d.day_comment}</div>}
              </th>
              {cats.map((c) => (
                <td key={c}>{fmt(d.hours[c])}</td>
              ))}
              <td>{fmt(d.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** `/client/timesheets/[id]`: read-only hours with approve / reject (reject requires a comment). */
export function ClientTimesheetDetailView({ id }: { id: string }) {
  const portal = usePortalStyles();
  const { query, decide } = useClientTimesheet(id);
  const [action, setAction] = useState<ClientDecision | null>(null);
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);
  if (query.isPending) return <LoadingBlock label="Loading timesheet" />;
  if (query.isError) return <ErrorBlock error={query.error} onRetry={() => query.refetch()} />;
  const ts = query.data;
  const validation = action ? decisionError(action, comment) : null;
  return (
    <div className={portal.page}>
      <FluentLink href="/client/timesheets" style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44 }}>
        <ArrowLeft20Regular aria-hidden /> Timesheets
      </FluentLink>
      <PortalPageHeader
        title={`${ts.worker_name ?? "Worker"} · ${formatPeriod(ts.period_start, ts.period_end)}`}
        subtitle={[ts.role_title, ts.human_id, ts.kind === "adjustment" ? "Adjustment" : null].filter(Boolean).join(" · ")}
      />
      <Card className={portal.card}>
        <div className={portal.actions}>
          <Badge appearance="tint" color={ts.awaiting_client ? "warning" : statusColor(ts.status)}>
            {ts.awaiting_client ? "Awaiting you" : statusLabel(ts.status)}
          </Badge>
          <Text weight="semibold">Total {normalizeHours(ts.total_hours) || "0.00"} h</Text>
          <TimesheetFlagBadges flags={ts.flags} />
        </div>
        {Object.keys(ts.totals).length > 0 && (
          <Caption1>
            {Object.entries(ts.totals)
              .map(([c, h]) => `${categoryLabel(c)} ${normalizeHours(h)}`)
              .join(" · ")}
          </Caption1>
        )}
        {ts.rejection_comment && (
          <MessageBar intent="warning" layout="multiline">
            <MessageBarBody>Rejection comment: {ts.rejection_comment}</MessageBarBody>
          </MessageBar>
        )}
        {ts.days.length > 0 && <ClientHoursGrid days={ts.days} label="Hours by day" />}
        {ts.adjustment_deltas.length > 0 && (
          <>
            <Text weight="semibold">Adjustments</Text>
            <ClientHoursGrid days={ts.adjustment_deltas} signed label="Adjusted hours by day" />
          </>
        )}
        {ts.days.length === 0 && ts.adjustment_deltas.length === 0 && <Body1 className={portal.empty}>No hours recorded.</Body1>}
      </Card>

      {ts.awaiting_client && (
        <Card className={portal.card}>
          <Text weight="semibold">Your decision</Text>
          <Field
            label="Comment"
            hint={action === "reject" ? "Required when rejecting — tell the worker what to change." : "Optional"}
            validationMessage={touched ? validation : undefined}
            required={action === "reject"}
          >
            <Textarea value={comment} maxLength={4000} onChange={(_, d) => setComment(d.value)} />
          </Field>
          <div className={portal.actions}>
            <Button
              appearance="primary"
              className={portal.button}
              icon={<Checkmark20Regular />}
              disabled={decide.isPending}
              onClick={() => {
                setAction("approve");
                setTouched(true);
                if (!decisionError("approve", comment)) decide.mutate({ action: "approve", comment: comment.trim() || null });
              }}
            >
              Approve
            </Button>
            <Button
              className={portal.button}
              icon={<Dismiss20Regular />}
              disabled={decide.isPending}
              onClick={() => {
                setAction("reject");
                setTouched(true);
                if (!decisionError("reject", comment)) decide.mutate({ action: "reject", comment: comment.trim() });
              }}
            >
              Reject
            </Button>
          </div>
          <InlineError message={decide.isError ? errorMessage(decide.error) : null} />
        </Card>
      )}
      {decide.isSuccess && (
        <MessageBar intent="success">
          <MessageBarBody>Decision recorded.</MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}
