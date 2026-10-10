"use client";

import {
  Badge,
  Button,
  Card,
  Checkbox,
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
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowUndo20Regular,
  Attach20Regular,
  Delete20Regular,
  Edit20Regular,
  LockClosed16Regular,
  Send20Regular,
} from "@fluentui/react-icons";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { TimesheetFlagsPanel } from "@/features/agents/finance/timesheet-flags-panel";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { formatDelta, isValidHoursInput, normalizeHours, toHundredths } from "./decimal";
import { categoryLabel, formatDay, formatPeriod, statusColor, statusLabel } from "./format";
import type { AdjustmentEntryIn, TimeCategory, TimesheetDetailOut } from "./types";
import { useTimesheet } from "./use-timesheet";

const useStyles = makeStyles({
  section: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, marginBottom: tokens.spacingVerticalL },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalL },
  adjRow: { display: "grid", gridTemplateColumns: "150px 160px 100px 1fr auto", gap: tokens.spacingHorizontalS, alignItems: "end" },
  num: { textAlign: "end", fontVariantNumeric: "tabular-nums" },
});

const ENTERABLE: TimeCategory[] = ["regular", "ot", "double_time", "holiday", "leave_paid", "leave_unpaid"];

/** `/timesheets/[id]`: internal timesheet detail -- entries, approval history, locks and admin actions. */
export function TimesheetDetail({ id }: { id: string }) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const perms = usePermissions();
  const canRead = hasAnyPermission(perms, ["timesheet:read", "timesheet:monitor", "timesheet:admin"]);
  const canAdmin = hasAnyPermission(perms, ["timesheet:admin"]);
  const t = useTimesheet(id);
  const [dialog, setDialog] = useState<null | "reopen" | "adjust" | "client" | "proxy" | "submit">(null);
  if (!canRead) return <NoAccess what="timesheets" />;
  if (t.query.isPending) return <GridSkeleton />;
  if (t.query.isError) return <ErrorBar title="Could not load the timesheet." message={errorMessage(t.query.error)} />;
  const ts = t.query.data;
  const isAdjustment = ts.kind === "adjustment";
  const locked = ts.locks.payroll_locked || ts.locks.billing_locked || ts.locks.in_draft_invoice;

  return (
    <>
      <PageHeader
        title={`${isAdjustment ? "Adjustment" : "Timesheet"} ${ts.human_id}`}
        subtitle={`${ts.worker_name ?? "Worker"} · ${ts.client_name ?? "Client"} · ${formatPeriod(ts.period_start, ts.period_end)}`}
      />
      <div className={styles.actions}>
        <span className={admin.badges}>
          <Badge appearance="tint" color={statusColor(ts.status)}>
            {statusLabel(ts.status)}
          </Badge>
          {ts.locks.payroll_locked && (
            <Badge color="danger" icon={<LockClosed16Regular />}>
              Payroll posted
            </Badge>
          )}
          {ts.locks.billing_locked && (
            <Badge color="danger" icon={<LockClosed16Regular />}>
              Invoiced
            </Badge>
          )}
          {ts.locks.in_draft_invoice && (
            <Badge color="warning" icon={<LockClosed16Regular />}>
              In draft invoice
            </Badge>
          )}
        </span>
        <span className={admin.grow} />
        {canAdmin && ts.status === "draft" && (
          <Button icon={<Edit20Regular />} onClick={() => setDialog("proxy")}>
            Proxy entry
          </Button>
        )}
        {canAdmin && ts.status === "draft" && (
          <Button icon={<Send20Regular />} onClick={() => setDialog("submit")}>
            Submit on behalf
          </Button>
        )}
        {canAdmin && (ts.status === "approved" || ts.status === "rejected" || ts.status === "in_approval" || ts.status === "submitted") && !isAdjustment && (
          <Button icon={<ArrowUndo20Regular />} onClick={() => setDialog("reopen")}>
            Reopen
          </Button>
        )}
        {canAdmin && ts.status === "approved" && !isAdjustment && (
          <Button icon={<Add20Regular />} onClick={() => setDialog("adjust")}>
            Create adjustment
          </Button>
        )}
        {canAdmin && (ts.status === "submitted" || ts.status === "in_approval") && (
          <Button icon={<Attach20Regular />} onClick={() => setDialog("client")}>
            Record client approval
          </Button>
        )}
      </div>

      {ts.rejection_comment && (
        <MessageBar intent="warning" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBarBody>Rejected: {ts.rejection_comment}</MessageBarBody>
        </MessageBar>
      )}

      <Card className={styles.section}>
        <dl className={admin.detailList}>
          <dt>Placement</dt>
          <dd>
            <NextLink href={`/placements/${ts.placement_id}`}>{ts.placement_human_id ?? ts.placement_id}</NextLink>
            {" · "}
            <NextLink href={`/timesheets/placements/${ts.placement_id}/config`}>Timesheet config</NextLink>
          </dd>
          {ts.original_timesheet_id && (
            <>
              <dt>Adjusts</dt>
              <dd>
                <NextLink href={`/timesheets/${ts.original_timesheet_id}`}>Original timesheet</NextLink>
              </dd>
            </>
          )}
          <dt>Entry mode</dt>
          <dd>
            {ts.entry_mode} · {normalizeHours(ts.hours_per_day)} h/day · cap {normalizeHours(ts.daily_cap)} h · config v{ts.config_version}
          </dd>
          <dt>Total</dt>
          <dd>
            {normalizeHours(ts.total_hours) || "0.00"} h ({ts.totals.map((x) => `${categoryLabel(x.category)} ${normalizeHours(x.hours)}`).join(", ") || "none"})
          </dd>
          <dt>Submitted</dt>
          <dd>{formatDateTime(ts.submitted_at)}</dd>
          <dt>Approved</dt>
          <dd>{formatDateTime(ts.approved_at)}</dd>
          <dt>Current step</dt>
          <dd>{ts.current_step ?? "—"}</dd>
          {ts.proxy_reason && (
            <>
              <dt>Proxy reason</dt>
              <dd>{ts.proxy_reason}</dd>
            </>
          )}
          {ts.reason && (
            <>
              <dt>Reason</dt>
              <dd>{ts.reason}</dd>
            </>
          )}
          {ts.client_approval_evidence_file_id && (
            <>
              <dt>Client approval</dt>
              <dd>Evidence on file</dd>
            </>
          )}
        </dl>
      </Card>

      <Card className={styles.section}>
        <Subtitle2 as="h2">{isAdjustment ? "Adjustment entries" : "Entries"}</Subtitle2>
        {isAdjustment ? (
          <Table aria-label="Adjustment entries" size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell>Delta</TableHeaderCell>
                <TableHeaderCell>Note</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ts.adjustment_entries.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{formatDay(a.entry_date)}</TableCell>
                  <TableCell>{categoryLabel(a.category)}</TableCell>
                  <TableCell className={styles.num}>{formatDelta(a.delta_hours)}</TableCell>
                  <TableCell>{a.note ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : ts.entries.length === 0 ? (
          <Text className={admin.muted}>No entries.</Text>
        ) : (
          <Table aria-label="Entries" size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell>Hours</TableHeaderCell>
                <TableHeaderCell>Time</TableHeaderCell>
                <TableHeaderCell>Source</TableHeaderCell>
                <TableHeaderCell>Note</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...ts.entries]
                .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.category.localeCompare(b.category))
                .map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDay(e.entry_date)}</TableCell>
                    <TableCell>{categoryLabel(e.category)}</TableCell>
                    <TableCell className={styles.num}>{normalizeHours(e.hours)}</TableCell>
                    <TableCell>{e.start_time && e.end_time ? `${e.start_time.slice(0, 5)}–${e.end_time.slice(0, 5)} (${e.break_minutes ?? 0}m)` : ""}</TableCell>
                    <TableCell>
                      <span className={admin.badges}>
                        {e.prefilled && <Badge appearance="tint" color="informative">Prefilled</Badge>}
                        {e.is_proxy && <Badge appearance="tint" color="warning">Proxy</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>{e.note ?? ""}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Epic 63: "Things to check" -- rule flags + Timesheet Agent explanations (internal approvers only). */}
      {!isAdjustment && <TimesheetFlagsPanel timesheetId={ts.id} />}

      <Card className={styles.section}>
        <Subtitle2 as="h2">Approval history</Subtitle2>
        {ts.approval_history.length === 0 ? (
          <Text className={admin.muted}>No approval steps yet.</Text>
        ) : (
          <Table aria-label="Approval history" size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>#</TableHeaderCell>
                <TableHeaderCell>Step</TableHeaderCell>
                <TableHeaderCell>Outcome</TableHeaderCell>
                <TableHeaderCell>By</TableHeaderCell>
                <TableHeaderCell>Comment</TableHeaderCell>
                <TableHeaderCell>When</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ts.approval_history.map((s, i) => (
                <TableRow key={`${s.position}-${i}`}>
                  <TableCell>{s.position}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>
                    {s.outcome ? (
                      <Badge appearance="tint" color={s.outcome === "approved" ? "success" : s.outcome === "rejected" ? "danger" : "subtle"}>
                        {s.outcome}
                      </Badge>
                    ) : (
                      "Pending"
                    )}
                  </TableCell>
                  <TableCell>{s.actor_kind ?? "—"}</TableCell>
                  <TableCell>{s.comment ?? ""}</TableCell>
                  <TableCell>{formatDateTime(s.decided_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {dialog === "reopen" && <ReopenDialog ts={ts} locked={locked} onClose={() => setDialog(null)} reopen={(r) => t.reopen.mutateAsync(r)} />}
      {dialog === "adjust" && <AdjustmentDialog ts={ts} onClose={() => setDialog(null)} adjust={(b) => t.adjust.mutateAsync(b)} />}
      {dialog === "client" && (
        <ClientApprovalDialog onClose={() => setDialog(null)} record={(v) => t.recordClientApproval.mutateAsync(v)} />
      )}
      {dialog === "proxy" && (
        <ProxyEntryDialog ts={ts} onClose={() => setDialog(null)} save={(b) => t.proxyEntries.mutateAsync(b)} />
      )}
      {dialog === "submit" && <ProxySubmitDialog onClose={() => setDialog(null)} submit={(b) => t.submit.mutateAsync(b)} />}
    </>
  );
}

function ActionDialog({
  title,
  children,
  confirmLabel,
  canConfirm,
  onConfirm,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  canConfirm: boolean;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {children}
            {error && (
              <MessageBar intent="error" layout="multiline">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={busy || !canConfirm}
              icon={busy ? <Spinner size="tiny" /> : undefined}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await onConfirm();
                  onClose();
                } catch (e) {
                  setError(lockedMessage(e) ?? errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function lockedMessage(e: unknown): string | null {
  if (!isApiError(e) || e.code !== "timesheet_locked") return null;
  const d = e.details as { payroll_locked?: boolean; billing_locked?: boolean; in_draft_invoice?: boolean };
  const why = [d.payroll_locked && "payroll is posted", d.billing_locked && "it is invoiced", d.in_draft_invoice && "it is on a draft invoice"].filter(Boolean);
  return `This timesheet is locked${why.length ? ` because ${why.join(" and ")}` : ""}. Create an adjustment instead.`;
}

function ReopenDialog({ ts, locked, onClose, reopen }: { ts: TimesheetDetailOut; locked: boolean; onClose: () => void; reopen: (reason: string) => Promise<unknown> }) {
  const [reason, setReason] = useState("");
  return (
    <ActionDialog title={`Reopen ${ts.human_id}`} confirmLabel="Reopen" canConfirm={reason.trim().length > 0} onConfirm={() => reopen(reason.trim())} onClose={onClose}>
      {locked && (
        <MessageBar intent="warning">
          <MessageBarBody>Payroll or billing holds these hours; reopening will likely be refused. Consider an adjustment.</MessageBarBody>
        </MessageBar>
      )}
      <Field label="Reason" required>
        <Textarea value={reason} maxLength={2000} onChange={(_, d) => setReason(d.value)} />
      </Field>
    </ActionDialog>
  );
}

type AdjRow = { date: string; category: TimeCategory; delta: string; note: string };
const SIGNED_RE = /^[+-]?\d{1,2}(\.\d{1,2})?$/;

function AdjustmentDialog({ ts, onClose, adjust }: { ts: TimesheetDetailOut; onClose: () => void; adjust: (b: { reason: string; entries: AdjustmentEntryIn[] }) => Promise<TimesheetDetailOut> }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<AdjRow[]>([{ date: ts.period_start, category: "regular", delta: "", note: "" }]);
  const valid = rows.every((r) => r.date >= ts.period_start && r.date <= ts.period_end && SIGNED_RE.test(r.delta.trim()) && (toHundredths(r.delta) ?? 0) !== 0);
  const set = (i: number, patch: Partial<AdjRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <ActionDialog
      title={`Adjust ${ts.human_id}`}
      confirmLabel="Create adjustment"
      canConfirm={valid && reason.trim().length > 0 && rows.length > 0}
      onConfirm={async () => {
        const out = await adjust({
          reason: reason.trim(),
          entries: rows.map((r) => ({ date: r.date, category: r.category, delta_hours: r.delta.trim(), note: r.note.trim() || null })),
        });
        toast.success(`Adjustment ${out.human_id} created as a draft. Submit it to start approval.`);
        router.push(`/timesheets/${out.id}`);
      }}
      onClose={onClose}
    >
      <Text>Enter signed hour deltas (e.g. -1.00 or +2.50). The adjustment is created as a draft for approval.</Text>
      {rows.map((r, i) => (
        <div key={i} className={styles.adjRow}>
          <Field label="Date">
            <Input type="date" min={ts.period_start} max={ts.period_end} value={r.date} onChange={(_, d) => set(i, { date: d.value })} />
          </Field>
          <Field label="Category">
            <Dropdown value={categoryLabel(r.category)} selectedOptions={[r.category]} onOptionSelect={(_, d) => set(i, { category: d.optionValue as TimeCategory })}>
              {ENTERABLE.map((c) => (
                <Option key={c} value={c}>
                  {categoryLabel(c)}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Delta" validationMessage={r.delta && !SIGNED_RE.test(r.delta.trim()) ? "±hh.mm" : undefined}>
            <Input value={r.delta} inputMode="decimal" onChange={(_, d) => set(i, { delta: d.value })} />
          </Field>
          <Field label="Note">
            <Input value={r.note} onChange={(_, d) => set(i, { note: d.value })} />
          </Field>
          <Button aria-label="Remove row" icon={<Delete20Regular />} disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div>
        <Button icon={<Add20Regular />} onClick={() => setRows((rs) => [...rs, { date: ts.period_start, category: "regular", delta: "", note: "" }])}>
          Add row
        </Button>
      </div>
      <Field label="Reason" required>
        <Textarea value={reason} maxLength={2000} onChange={(_, d) => setReason(d.value)} />
      </Field>
    </ActionDialog>
  );
}

function ClientApprovalDialog({ onClose, record }: { onClose: () => void; record: (v: { file: File; clientUserId?: string; comment?: string }) => Promise<unknown> }) {
  const [file, setFile] = useState<File | null>(null);
  const [clientUserId, setClientUserId] = useState("");
  const [comment, setComment] = useState("");
  return (
    <ActionDialog
      title="Record client approval"
      confirmLabel="Record approval"
      canConfirm={!!file}
      onConfirm={() => record({ file: file as File, clientUserId: clientUserId.trim() || undefined, comment: comment.trim() || undefined })}
      onClose={onClose}
    >
      <Text>Attach the client&apos;s approval (email print-out or signed sheet) as PDF, PNG or JPEG.</Text>
      <Field label="Evidence" required>
        <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      <Field label="Client user id" hint="Optional: the client user who approved">
        <Input value={clientUserId} onChange={(_, d) => setClientUserId(d.value)} />
      </Field>
      <Field label="Comment">
        <Textarea value={comment} onChange={(_, d) => setComment(d.value)} />
      </Field>
    </ActionDialog>
  );
}

function ProxyEntryDialog({
  ts,
  onClose,
  save,
}: {
  ts: TimesheetDetailOut;
  onClose: () => void;
  save: (b: { reason: string; days: { date: string; category: TimeCategory; hours: string; note: string | null }[] }) => Promise<unknown>;
}) {
  const [date, setDate] = useState(ts.period_start);
  const [category, setCategory] = useState<TimeCategory>("regular");
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const cats = ts.enabled_categories.filter((c) => c !== "ot" && c !== "double_time") as TimeCategory[];
  const ok = isValidHoursInput(hours) && hours.trim() !== "" && reason.trim() !== "" && date >= ts.period_start && date <= ts.period_end;
  return (
    <ActionDialog
      title="Proxy entry"
      confirmLabel="Save entry"
      canConfirm={ok}
      onConfirm={() => save({ reason: reason.trim(), days: [{ date, category, hours: hours.trim(), note: note.trim() || null }] })}
      onClose={onClose}
    >
      <Text>Enter hours on the worker&apos;s behalf. Use 0 to remove a cell.</Text>
      <Field label="Date">
        <Input type="date" min={ts.period_start} max={ts.period_end} value={date} onChange={(_, d) => setDate(d.value)} />
      </Field>
      <Field label="Category">
        <Dropdown value={categoryLabel(category)} selectedOptions={[category]} onOptionSelect={(_, d) => setCategory(d.optionValue as TimeCategory)}>
          {cats.map((c) => (
            <Option key={c} value={c}>
              {categoryLabel(c)}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Field label="Hours" validationMessage={hours && !isValidHoursInput(hours) ? "Up to 24 with 2 decimals" : undefined}>
        <Input value={hours} inputMode="decimal" onChange={(_, d) => setHours(d.value)} />
      </Field>
      <Field label="Note">
        <Input value={note} onChange={(_, d) => setNote(d.value)} />
      </Field>
      <Field label="Reason" required>
        <Textarea value={reason} maxLength={2000} onChange={(_, d) => setReason(d.value)} />
      </Field>
    </ActionDialog>
  );
}

function ProxySubmitDialog({ onClose, submit }: { onClose: () => void; submit: (b: { reason: string; confirm_zero: boolean }) => Promise<unknown> }) {
  const [reason, setReason] = useState("");
  const [confirmZero, setConfirmZero] = useState(false);
  return (
    <ActionDialog
      title="Submit on behalf of the worker"
      confirmLabel="Submit"
      canConfirm={reason.trim() !== ""}
      onConfirm={() => submit({ reason: reason.trim(), confirm_zero: confirmZero })}
      onClose={onClose}
    >
      <Field label="Reason" required>
        <Textarea value={reason} maxLength={2000} onChange={(_, d) => setReason(d.value)} />
      </Field>
      <Checkbox checked={confirmZero} onChange={(_, d) => setConfirmZero(!!d.checked)} label="Confirm a zero-hour submission" />
    </ActionDialog>
  );
}
