"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  Option,
  type TableColumnDefinition,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";
import NextLink from "next/link";
import { useState } from "react";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import type { LeaveRequestOut } from "./types";
import { useLeaveBalances } from "./use-leave-balances";
import { useLeaveCalendar } from "./use-leave-calendar";
import { useLeaveRequests } from "./use-leave-requests";
import { adjustmentErrors, formatDays, halfLabel, monthDates, STATUS_COLOR, STATUS_LABEL } from "./validation";

const useStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  bar: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "flex-end" },
  scroll: { overflowX: "auto" },
  grid: { borderCollapse: "collapse", fontSize: tokens.fontSizeBase200 },
  cell: { minWidth: "26px", height: "26px", textAlign: "center", border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}` },
  name: { textAlign: "left", paddingRight: tokens.spacingHorizontalM, whiteSpace: "nowrap" },
  approved: { backgroundColor: tokens.colorPaletteGreenBackground2 },
  requested: { backgroundColor: tokens.colorPaletteYellowBackground2 },
  holiday: { backgroundColor: tokens.colorNeutralBackground3 },
  half: { backgroundImage: `linear-gradient(135deg, transparent 50%, ${tokens.colorNeutralBackground1} 50%)` },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

const STATUSES = ["requested", "approved", "cancellation_requested", "rejected", "withdrawn", "cancelled"] as const;

/** `/leave`: internal leave requests (decisions go through the shared approvals inbox). */
export function LeaveRequestsAdmin() {
  const styles = useStyles();
  const [status, setStatus] = useState<string>("requested,cancellation_requested");
  const q = useLeaveRequests({ status: status || undefined });
  const columns: TableColumnDefinition<LeaveRequestOut>[] = [
    createTableColumn({ columnId: "id", renderHeaderCell: () => "Request", renderCell: (r) => r.human_id }),
    createTableColumn({ columnId: "worker", renderHeaderCell: () => "Worker", renderCell: (r) => r.worker_name ?? "—" }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (r) => r.client_name ?? "—" }),
    createTableColumn({ columnId: "type", renderHeaderCell: () => "Type", renderCell: (r) => r.leave_type_name ?? "—" }),
    createTableColumn({
      columnId: "dates",
      renderHeaderCell: () => "Dates",
      renderCell: (r) => `${r.start_date}${halfLabel(r.start_half)} → ${r.end_date}${halfLabel(r.end_half)}`,
    }),
    createTableColumn({ columnId: "days", renderHeaderCell: () => "Days", renderCell: (r) => formatDays(r.days) }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <Badge appearance="tint" color={STATUS_COLOR[r.status]}>
          {STATUS_LABEL[r.status]}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "approve",
      renderHeaderCell: () => "",
      renderCell: (r) =>
        r.approval_request_id && (r.status === "requested" || r.status === "cancellation_requested") ? (
          <NextLink href="/approvals">Open in approvals</NextLink>
        ) : null,
    }),
  ];
  return (
    <div className={styles.page}>
      <Title2>Leave requests</Title2>
      <div className={styles.bar}>
        <Field label="Status">
          <Dropdown
            value={status ? status.split(",").map((s) => STATUS_LABEL[s as keyof typeof STATUS_LABEL]).join(", ") : "All"}
            selectedOptions={[status]}
            onOptionSelect={(_, d) => setStatus(d.optionValue ?? "")}
          >
            <Option value="requested,cancellation_requested">Waiting for a decision</Option>
            <Option value="">All</Option>
            {STATUSES.map((s) => (
              <Option key={s} value={s}>
                {STATUS_LABEL[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <NextLink href="/leave/calendar">Team calendar</NextLink>
      </div>
      {q.isPending ? (
        <GridSkeleton />
      ) : q.isError ? (
        <ErrorBar message={errorMessage(q.error)} />
      ) : q.data.length === 0 ? (
        <Body1>No leave requests.</Body1>
      ) : (
        <DataGrid items={q.data} columns={columns} getRowId={(r) => r.id} aria-label="Leave requests">
          <DataGridHeader>
            <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
          </DataGridHeader>
          <DataGridBody<LeaveRequestOut>>
            {({ item, rowId }) => (
              <DataGridRow<LeaveRequestOut> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
            )}
          </DataGridBody>
        </DataGrid>
      )}
    </div>
  );
}

function monthStart(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** `/leave/calendar`: month grid by Worker (approved / requested / half days / holidays), Client filter. */
export function TeamLeaveCalendar() {
  const styles = useStyles();
  const [month, setMonth] = useState(monthStart());
  const [clientId, setClientId] = useState("");
  const dates = monthDates(month);
  const q = useLeaveCalendar(dates[0], dates[dates.length - 1], clientId || undefined);
  const holidayDates = new Set((q.data?.holidays ?? []).map((h) => h.date));
  return (
    <div className={styles.page}>
      <Title2>Team leave calendar</Title2>
      <div className={styles.bar}>
        <Field label="Month">
          <Input type="month" value={month.slice(0, 7)} onChange={(_, d) => d.value && setMonth(`${d.value}-01`)} />
        </Field>
        <Field label="Client id (optional)">
          <Input value={clientId} onChange={(_, d) => setClientId(d.value.trim())} placeholder="All clients" />
        </Field>
      </div>
      {q.isPending ? (
        <GridSkeleton />
      ) : q.isError ? (
        <ErrorBar message={errorMessage(q.error)} />
      ) : q.data.workers.length === 0 ? (
        <Body1>No leave in this month.</Body1>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.grid} aria-label="Team leave calendar">
            <thead>
              <tr>
                <th className={styles.name}>Worker</th>
                {dates.map((d) => (
                  <th key={d} className={mergeClasses(styles.cell, holidayDates.has(d) && styles.holiday)}>
                    {Number(d.slice(8))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data.workers.map((w) => {
                const byDate = new Map(w.days.map((d) => [d.date, d]));
                return (
                  <tr key={w.placement_id}>
                    <td className={styles.name}>{w.worker_name ?? "Worker"}</td>
                    {dates.map((d) => {
                      const cell = byDate.get(d);
                      return (
                        <td
                          key={d}
                          title={cell ? `${cell.leave_type_name ?? "Leave"}${halfLabel(cell.half)} · ${cell.status}` : undefined}
                          className={mergeClasses(
                            styles.cell,
                            holidayDates.has(d) && styles.holiday,
                            cell?.status === "approved" && styles.approved,
                            cell?.status === "requested" && styles.requested,
                            !!cell?.half && styles.half,
                          )}
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Caption1>Green: approved · Yellow: requested · Grey: holiday · Diagonal: half day</Caption1>
    </div>
  );
}

/** Worker 360 "Leave" tab: balances, ledger history and the audited balance adjustment. */
export function WorkerLeaveTab({ candidateId, legalEntityId }: { candidateId: string; legalEntityId: string }) {
  const styles = useStyles();
  const { balances, history, adjust } = useLeaveBalances(candidateId);
  const [open, setOpen] = useState<string | null>(null);
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const errs = adjustmentErrors(days, reason);
  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <Text weight="semibold">Balances</Text>
        {balances.isError && <ErrorBar message={errorMessage(balances.error)} />}
        {(balances.data ?? []).map((b) => (
          <div key={`${b.leave_type_id}-${b.legal_entity_id}`} className={styles.bar}>
            <Text>{b.leave_type_name}</Text>
            <Caption1>
              {b.balance} balance · {b.pending} pending · {b.available} available
            </Caption1>
            <Button size="small" onClick={() => setOpen(b.leave_type_id)}>
              Adjust
            </Button>
          </div>
        ))}
      </Card>
      <Card className={styles.card}>
        <Text weight="semibold">History</Text>
        {(history.data ?? []).map((e) => (
          <Caption1 key={e.id}>
            {e.effective_date} · {e.entry_kind} · {e.days} · {e.source_ref}
            {e.reason ? ` · ${e.reason}` : ""}
          </Caption1>
        ))}
      </Card>
      <Dialog open={open !== null} onOpenChange={(_, d) => !d.open && setOpen(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Adjust leave balance</DialogTitle>
            <DialogContent className={styles.page}>
              <Field label="Days (use a minus sign to deduct)" required validationMessage={days ? errs.days : undefined}>
                <Input value={days} onChange={(_, d) => setDays(d.value)} placeholder="-1.5" />
              </Field>
              <Field label="Reason" required validationMessage={reason ? undefined : errs.reason}>
                <Input value={reason} onChange={(_, d) => setReason(d.value)} />
              </Field>
              {adjust.isError && <ErrorBar message={errorMessage(adjust.error)} />}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(null)}>Cancel</Button>
              <Button
                appearance="primary"
                disabled={!!errs.days || !!errs.reason || adjust.isPending}
                onClick={() =>
                  open &&
                  adjust.mutate(
                    { candidate_id: candidateId, leave_type_id: open, legal_entity_id: legalEntityId, days: days.trim(), reason: reason.trim() },
                    { onSuccess: () => setOpen(null) },
                  )
                }
              >
                Save adjustment
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
