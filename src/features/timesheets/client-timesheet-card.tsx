"use client";

import { Badge, Caption1, Checkbox, makeStyles, Text, tokens } from "@fluentui/react-components";
import { Clock16Regular, CalendarStar16Regular, Warning16Regular } from "@fluentui/react-icons";
import NextLink from "next/link";
import { usePortalStyles } from "@/features/portal/ui";
import { normalizeHours } from "./decimal";
import { formatPeriod, statusColor, statusLabel } from "./format";
import type { ClientTimesheetFlags, ClientTimesheetSummary } from "./types";

const useStyles = makeStyles({
  flags: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  check: { minWidth: "44px", minHeight: "44px", display: "flex", alignItems: "center" },
});

export function TimesheetFlagBadges({ flags }: { flags: ClientTimesheetFlags }) {
  const styles = useStyles();
  return (
    <span className={styles.flags}>
      {flags.ot_above_threshold && (
        <Badge appearance="tint" color="warning" icon={<Clock16Regular />}>
          Overtime
        </Badge>
      )}
      {flags.holiday_entries && (
        <Badge appearance="tint" color="informative" icon={<CalendarStar16Regular />}>
          Holiday hours
        </Badge>
      )}
      {flags.above_daily_cap && (
        <Badge appearance="tint" color="danger" icon={<Warning16Regular />}>
          Above daily cap
        </Badge>
      )}
    </span>
  );
}

/** Client Portal summary row of a timesheet (hours only, flags), optionally selectable for bulk approval. */
export function ClientTimesheetCard({
  ts,
  selected,
  onSelect,
}: {
  ts: ClientTimesheetSummary;
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
}) {
  const portal = usePortalStyles();
  const styles = useStyles();
  const title = `${ts.worker_name ?? "Worker"} · ${formatPeriod(ts.period_start, ts.period_end)}`;
  return (
    <li className={portal.row}>
      {onSelect && (
        <span className={styles.check}>
          <Checkbox
            checked={!!selected}
            disabled={!ts.awaiting_client}
            aria-label={`Select ${title}`}
            onChange={(_, d) => onSelect(!!d.checked)}
          />
        </span>
      )}
      <span className={portal.rowMain}>
        <NextLink href={`/client/timesheets/${encodeURIComponent(ts.id)}`} className={portal.rowTitle}>
          {title}
        </NextLink>
        <Caption1>
          {[ts.role_title, ts.human_id, ts.kind === "adjustment" ? "Adjustment" : null].filter(Boolean).join(" · ")}
        </Caption1>
        <TimesheetFlagBadges flags={ts.flags} />
      </span>
      <span className={portal.actions}>
        <Badge appearance="tint" color={ts.awaiting_client ? "warning" : statusColor(ts.status)}>
          {ts.awaiting_client ? "Awaiting you" : statusLabel(ts.status)}
        </Badge>
        <Text weight="semibold">{normalizeHours(ts.total_hours) || "0.00"} h</Text>
      </span>
    </li>
  );
}
