"use client";

import {
  Badge,
  Button,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dropdown,
  Field,
  Input,
  Link,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  type TableColumnDefinition,
  type TableRowId,
  Text,
  tokens,
} from "@fluentui/react-components";
import { AlertUrgent20Regular, ArrowUpload20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { FlagsCell, HasFlagsFilter, NudgeNowButton, useFlagCounts } from "@/features/agents/finance/monitor-extras";
import { formatMoney } from "@/features/placements/format";
import { normalizeHours } from "./decimal";
import { codeLabel, formatPeriod, STATUS_LABELS, statusColor, statusLabel } from "./format";
import { TIMESHEET_STATUSES, type MonitorFilters, type MonitorRow } from "./types";
import { useTimesheetMonitor } from "./use-timesheet-monitor";

const useStyles = makeStyles({
  totals: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL, marginTop: tokens.spacingVerticalM },
});

/** `/timesheets`: the Timesheet monitor (FR-133) -- filters, missing / late flags, remind. */
export function TimesheetMonitor() {
  const admin = useAdminStyles();
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const perms = usePermissions();
  const canRead = hasAnyPermission(perms, ["timesheet:monitor", "timesheet:read"]);
  const canAdmin = hasAnyPermission(perms, ["timesheet:admin"]);
  const [periodStart, setPeriodStart] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Set<TableRowId>>(new Set());
  const filters: MonitorFilters = { period_start: periodStart || undefined, status: status || undefined };
  const { query, remind } = useTimesheetMonitor(filters, canRead);
  // Epic 63: open anomaly-flag counts ("Flags" column, "Has flags" filter).
  const [hasFlags, setHasFlags] = useState(false);
  const flagCounts = useFlagCounts(query.data?.rows.map((r) => r.timesheet_id) ?? [], canRead);
  if (!canRead) return <NoAccess what="timesheets" />;
  const data = query.data;
  const rows = (data?.rows ?? []).filter((r) => !hasFlags || (flagCounts[r.timesheet_id]?.open_count ?? 0) > 0);

  const columns: TableColumnDefinition<MonitorRow>[] = [
    createTableColumn({
      columnId: "id",
      renderHeaderCell: () => "Timesheet",
      renderCell: (r) => (
        <Link as="button" onClick={() => router.push(`/timesheets/${r.timesheet_id}`)}>
          {r.human_id}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "worker", renderHeaderCell: () => "Worker", renderCell: (r) => r.worker_name ?? "—" }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (r) => r.client_name ?? "—" }),
    createTableColumn({ columnId: "period", renderHeaderCell: () => "Period", renderCell: (r) => formatPeriod(r.period_start, r.period_end) }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <span className={admin.badges}>
          <Badge appearance="tint" color={statusColor(r.status)}>
            {statusLabel(r.status)}
          </Badge>
          {r.missing && (
            <Badge appearance="filled" color="danger">
              Missing
            </Badge>
          )}
          {r.late && (
            <Badge appearance="tint" color="warning">
              Late
            </Badge>
          )}
          {r.kind === "adjustment" && <Badge appearance="outline">Adjustment</Badge>}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "step",
      renderHeaderCell: () => "Current step",
      renderCell: (r) => (
        <span className={admin.cellStack}>
          <span>{r.current_step ?? "—"}</span>
          {r.current_approver && <span className={admin.muted}>{r.current_approver}</span>}
        </span>
      ),
    }),
    createTableColumn({ columnId: "age", renderHeaderCell: () => "Age (bd)", renderCell: (r) => String(r.age_business_days) }),
    createTableColumn({ columnId: "hours", renderHeaderCell: () => "Hours", renderCell: (r) => normalizeHours(r.total_hours) || "0.00" }),
    createTableColumn({ columnId: "flags", renderHeaderCell: () => "Flags", renderCell: (r) => <FlagsCell count={flagCounts[r.timesheet_id]} /> }),
  ];
  if (data && !data.masked) {
    columns.push(
      createTableColumn({
        columnId: "unbilled",
        renderHeaderCell: () => "Unbilled value",
        renderCell: (r) => (r.estimated_unbilled_value ? formatMoney(r.estimated_unbilled_value, r.currency) : "—"),
      }),
    );
  }

  const ids = [...selected].map(String);

  return (
    <>
      <PageHeader title="Timesheets" subtitle="Monitor submission and approval across placements" />
      <div className={admin.toolbar}>
        <Field label="Period starting" className={admin.filter}>
          <Input type="date" value={periodStart} onChange={(_, d) => setPeriodStart(d.value)} />
        </Field>
        <Field label="Status" className={admin.filter}>
          <Dropdown
            placeholder="Any"
            selectedOptions={status ? [status] : []}
            value={status ? statusLabel(status) : ""}
            onOptionSelect={(_, d) => setStatus(d.optionValue === "any" ? "" : (d.optionValue ?? ""))}
          >
            <Option value="any">Any</Option>
            {TIMESHEET_STATUSES.map((s) => (
              <Option key={s} value={s}>
                {STATUS_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <HasFlagsFilter checked={hasFlags} onChange={setHasFlags} />
        <span className={admin.grow} />
        <NudgeNowButton />
        {canAdmin && (
          <Button icon={<ArrowUpload20Regular />} onClick={() => router.push("/timesheets/imports")}>
            Import
          </Button>
        )}
        <Button
          appearance="primary"
          icon={<AlertUrgent20Regular />}
          disabled={ids.length === 0 || remind.isPending}
          onClick={async () => {
            try {
              const out = await remind.mutateAsync(ids);
              const skipped = out.skipped.length ? ` · ${out.skipped.length} skipped (${Array.from(new Set(out.skipped.map((s) => codeLabel(s.code)))).join(", ")})` : "";
              toast.success(`Reminders sent: ${out.sent.length}${skipped}`);
              setSelected(new Set());
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        >
          Remind ({ids.length})
        </Button>
      </div>
      {query.error && !data ? (
        <ErrorBar title="Could not load timesheets." message={errorMessage(query.error)} />
      ) : (
        <div className={admin.surface}>
          {!data ? (
            <GridSkeleton />
          ) : rows.length === 0 ? (
            <div className={admin.empty}>No timesheets match these filters.</div>
          ) : (
            <DataGrid
              items={rows}
              columns={columns}
              getRowId={(r) => r.timesheet_id}
              aria-label="Timesheets"
              className={admin.grid}
              selectionMode="multiselect"
              selectedItems={selected}
              onSelectionChange={(_, d) => setSelected(new Set(d.selectedItems))}
              focusMode="composite"
            >
              <DataGridHeader>
                <DataGridRow selectionCell={{ checkboxIndicator: { "aria-label": "Select all rows" } }}>
                  {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
                </DataGridRow>
              </DataGridHeader>
              <DataGridBody<MonitorRow>>
                {({ item, rowId }) => (
                  <DataGridRow<MonitorRow> key={rowId} selectionCell={{ checkboxIndicator: { "aria-label": `Select ${item.human_id}` } }}>
                    {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                  </DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
          )}
        </div>
      )}
      {data && !data.masked && data.totals.length > 0 && (
        <div className={styles.totals}>
          {data.totals.map((t) => (
            <Text key={t.currency}>
              Unbilled ({t.currency}): <strong>{t.estimated_unbilled_value ? formatMoney(t.estimated_unbilled_value, t.currency) : "—"}</strong>
            </Text>
          ))}
        </div>
      )}
      {data?.masked && (
        <MessageBar intent="info" style={{ marginTop: tokens.spacingVerticalM }}>
          <MessageBarBody>Unbilled values are hidden for your role.</MessageBarBody>
        </MessageBar>
      )}
    </>
  );
}
