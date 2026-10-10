"use client";

import {
  Badge,
  Button,
  Checkbox,
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
  Field,
  Input,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  ProgressBar,
  type TableColumnDefinition,
  Text,
  Textarea,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { ArrowDownload20Regular } from "@fluentui/react-icons";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { DetailsDrawer, ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { downloadApiFile } from "@/lib/api/download";
import { errorMessage } from "@/lib/api/errors";
import { payrollApi } from "./api";
import {
  canFinalize,
  canGeneratePreview,
  canMarkProcessed,
  displayHours,
  displayMoney,
  EXCEPTION_LABELS,
  EXCEPTION_LINKS,
  FINALIZE_WORD,
  finalizeConfirmed,
  formatDate,
  isStale,
  newIdempotencyKey,
  payrollErrorMessage,
  periodStatusLabel,
  STATUTORY_COLUMNS,
  STATUTORY_TOOLTIP,
  statutoryCell,
  totalsLines,
  VERSION_STATUS_LABELS,
  versionKindLabel,
  versionStatusColor,
} from "./format";
import type { ExceptionKind, FileFormat, RowOut, VersionOut } from "./types";
import { usePayPeriod } from "./use-pay-periods";
import { usePayrollExceptions } from "./use-payroll-exceptions";
import { usePayrollMappings } from "./use-payroll-mappings";
import { usePayrollItems, usePayrollRows, usePayrollVersions } from "./use-payroll-versions";

const useStyles = makeStyles({
  section: { marginTop: tokens.spacingVerticalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  stickyGrid: { "& [role='row']:first-child": { position: "sticky", top: 0, zIndex: 1, backgroundColor: tokens.colorNeutralBackground1 } },
  placeholder: { color: tokens.colorNeutralForeground4, backgroundColor: tokens.colorNeutralBackground3 },
  num: { fontVariantNumeric: "tabular-nums", textAlign: "end" },
  selected: { outline: `2px solid ${tokens.colorBrandStroke1}` },
});

const HOUR_COLS: [keyof RowOut, string][] = [
  ["hours_regular", "Regular h"],
  ["hours_ot", "OT h"],
  ["hours_double_time", "DT h"],
  ["hours_holiday", "Holiday h"],
  ["hours_leave_paid", "Paid leave h"],
  ["hours_leave_unpaid", "Unpaid leave h"],
];
const MONEY_COLS: [keyof RowOut, string][] = [
  ["earnings_regular", "Regular"],
  ["earnings_ot", "OT"],
  ["earnings_base", "Monthly base"],
  ["reimbursements_total", "Reimbursements"],
  ["adjustments_total", "Adjustments"],
  ["rate_adjustments_total", "Rate adj."],
  ["gross_earnings_inputs", "Gross inputs"],
];

/** `/payroll/periods/[id]`: exceptions, previews, finalize (typed confirmation), files, processed, reopen. */
export function PayrollPeriodView({ periodId }: { periodId: string }) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const canRead = usePermission("payroll:read");
  const canGenerate = usePermission("payroll:generate");
  const canFinalizePerm = usePermission("payroll:finalize");
  const canReopen = usePermission("period:reopen_pay");
  const { query: period, reopen } = usePayPeriod(periodId);
  const exceptions = usePayrollExceptions(periodId, canRead);
  const { query: versions, preview, finalize, markProcessed } = usePayrollVersions(periodId);
  const { query: mappings } = usePayrollMappings(canRead);
  const [proceed, setProceed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [processedOpen, setProcessedOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [drawerRow, setDrawerRow] = useState<RowOut | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const list = useMemo(() => versions.data ?? [], [versions.data]);
  const current = list.find((v) => v.id === selectedId) ?? list.find((v) => v.status === "generated") ?? list[0];
  const rows = usePayrollRows(current?.id ?? null);
  if (!canRead) return <NoAccess what="payroll" />;
  const p = period.data;

  const download = async (v: VersionOut, format: FileFormat, mappingId: string | null) => {
    setActionError(null);
    try {
      await downloadApiFile(payrollApi.filePath(v.id, format, mappingId), `${v.human_id}.${format}`);
    } catch (e) {
      setActionError(e);
    }
  };

  const generate = () => {
    setActionError(null);
    preview.mutate(proceed, { onSuccess: (v) => setSelectedId(v.id), onError: setActionError });
  };

  const versionColumns: TableColumnDefinition<VersionOut>[] = [
    createTableColumn({ columnId: "id", renderHeaderCell: () => "Version", renderCell: (v) => `${v.human_id} · #${v.seq}` }),
    createTableColumn({ columnId: "kind", renderHeaderCell: () => "Kind", renderCell: (v) => versionKindLabel(v.kind, v.supplementary) }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (v) => (
        <Badge appearance="tint" color={versionStatusColor(v.status)}>
          {VERSION_STATUS_LABELS[v.status]}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "workers", renderHeaderCell: () => "Workers", renderCell: (v) => String(v.row_count) }),
    createTableColumn({ columnId: "items", renderHeaderCell: () => "Items", renderCell: (v) => String(v.item_count) }),
    createTableColumn({
      columnId: "totals",
      renderHeaderCell: () => "Totals",
      renderCell: (v) => (
        <span className={admin.cellStack}>
          {totalsLines(v).map((t) => (
            <span key={t}>{t}</span>
          ))}
        </span>
      ),
    }),
  ];

  const rowColumns: TableColumnDefinition<RowOut>[] = [
    createTableColumn({
      columnId: "worker",
      renderHeaderCell: () => "Worker",
      renderCell: (r) => (
        <span className={admin.cellStack}>
          <span>{r.worker_name ?? "—"}</span>
          <span className={admin.muted}>{`${r.worker_human_id ?? ""} · ${r.currency}`}</span>
        </span>
      ),
    }),
    ...HOUR_COLS.map(([key, label]) =>
      createTableColumn<RowOut>({
        columnId: key,
        renderHeaderCell: () => label,
        renderCell: (r) => <span className={styles.num}>{displayHours(r[key] as string)}</span>,
      }),
    ),
    ...MONEY_COLS.map(([key, label]) =>
      createTableColumn<RowOut>({
        columnId: key,
        renderHeaderCell: () => label,
        renderCell: (r) => <span className={styles.num}>{displayMoney(r[key] as string, r.currency)}</span>,
      }),
    ),
    ...STATUTORY_COLUMNS.map((c) =>
      createTableColumn<RowOut>({
        columnId: c.key,
        renderHeaderCell: () => (
          <Tooltip content={STATUTORY_TOOLTIP} relationship="description">
            <span className={styles.placeholder}>{c.label}</span>
          </Tooltip>
        ),
        renderCell: () => <span className={styles.placeholder} aria-label={STATUTORY_TOOLTIP}>{statutoryCell()}</span>,
      }),
    ),
  ];

  const exc = exceptions.data;
  const kinds: ExceptionKind[] = ["unapproved_timesheets", "missing_pay_rate", "missing_bank_details", "currency_mismatch"];

  return (
    <>
      <PageHeader
        title={p ? `Pay period ${formatDate(p.period_start)} – ${formatDate(p.period_end)}` : "Pay period"}
        subtitle={
          p ? (
            <span className={styles.actions}>
              <Badge appearance="tint" color={p.status === "locked" ? "brand" : "informative"}>
                {periodStatusLabel(p.status)}
              </Badge>
              <span>{p.human_id}</span>
              {p.reopened_count > 0 && <span>{`Reopened ${p.reopened_count}× — ${p.last_reopen_reason ?? ""}`}</span>}
            </span>
          ) : undefined
        }
      />
      {period.error && <ErrorBar title="Could not load the pay period." message={errorMessage(period.error)} />}
      {actionError != null && (
        <MessageBar intent="error">
          <MessageBarBody>
            {payrollErrorMessage(actionError)}
            {isStale(actionError) && canGenerate && (
              <Button appearance="transparent" onClick={generate}>
                Regenerate preview
              </Button>
            )}
          </MessageBarBody>
        </MessageBar>
      )}

      <section className={styles.section} aria-label="Exceptions">
        <Text weight="semibold">Exceptions</Text>
        {!exc ? (
          <GridSkeleton rows={2} />
        ) : kinds.every((k) => !exc.counts[k]) ? (
          <MessageBar intent="success">
            <MessageBarBody>No exceptions for this period.</MessageBarBody>
          </MessageBar>
        ) : (
          kinds
            .filter((k) => exc.counts[k])
            .map((k) => (
              <MessageBar key={k} intent={k === "unapproved_timesheets" ? "warning" : "error"}>
                <MessageBarBody>
                  <MessageBarTitle>{`${EXCEPTION_LABELS[k]}: ${exc.counts[k]}`}</MessageBarTitle>
                  <Link href={EXCEPTION_LINKS[k]}>Review</Link>
                </MessageBarBody>
              </MessageBar>
            ))
        )}
        {canGenerate && (
          <div className={styles.actions}>
            {exc?.blocking && (
              <Checkbox
                label="Proceed excluding exceptions (excluded items stay unposted for a later supplementary)"
                checked={proceed}
                onChange={(_, d) => setProceed(!!d.checked)}
              />
            )}
            <Button appearance="primary" disabled={!canGeneratePreview(exc, proceed) || preview.isPending} onClick={generate}>
              {p?.final_count ? "Generate supplementary preview" : "Generate preview"}
            </Button>
            {canReopen && p?.status === "locked" && <Button onClick={() => setReopenOpen(true)}>Reopen period</Button>}
          </div>
        )}
        {preview.isPending && <ProgressBar aria-label="Generating preview" />}
      </section>

      <section className={styles.section} aria-label="Versions">
        <Text weight="semibold">Versions</Text>
        <div className={admin.surface}>
          {!versions.data ? (
            <GridSkeleton rows={2} />
          ) : list.length === 0 ? (
            <div className={admin.empty}>No previews yet.</div>
          ) : (
            <DataGrid items={list} columns={versionColumns} getRowId={(v) => v.id} aria-label="Export versions" className={admin.grid} focusMode="composite">
              <DataGridHeader>
                <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
              </DataGridHeader>
              <DataGridBody<VersionOut>>
                {({ item, rowId }) => (
                  <DataGridRow<VersionOut>
                    key={rowId}
                    className={mergeClasses(item.id === current?.id && styles.selected)}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedId(item.id)}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter") setSelectedId(item.id);
                    }}
                  >
                    {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                  </DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
          )}
        </div>
        {current && (
          <div className={styles.actions}>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button icon={<ArrowDownload20Regular />}>Download</Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {(mappings.data ?? []).flatMap((m) =>
                    (["csv", "xlsx"] as FileFormat[]).map((f) => (
                      <MenuItem key={`${m.id}-${f}`} onClick={() => void download(current, f, m.id)}>
                        {`${m.name} (${f.toUpperCase()})`}
                      </MenuItem>
                    )),
                  )}
                </MenuList>
              </MenuPopover>
            </Menu>
            {canFinalizePerm && canFinalize(current) && (
              <Button appearance="primary" onClick={() => setFinalizeOpen(true)}>
                Finalize…
              </Button>
            )}
            {canFinalizePerm && canMarkProcessed(current) && <Button onClick={() => setProcessedOpen(true)}>Mark processed</Button>}
          </div>
        )}
      </section>

      {current && (
        <section className={styles.section} aria-label="Rows">
          <Text weight="semibold">{`${versionKindLabel(current.kind, current.supplementary)} ${current.human_id}`}</Text>
          <div className={admin.surface}>
            {rows.error ? (
              <ErrorBar message={errorMessage(rows.error)} />
            ) : !rows.data ? (
              <GridSkeleton />
            ) : rows.data.length === 0 ? (
              <div className={admin.empty}>No workers in this version.</div>
            ) : (
              <DataGrid
                items={rows.data}
                columns={rowColumns}
                getRowId={(r) => r.id}
                aria-label="Payroll rows"
                className={mergeClasses(admin.grid, styles.stickyGrid)}
                focusMode="composite"
              >
                <DataGridHeader>
                  <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
                </DataGridHeader>
                <DataGridBody<RowOut>>
                  {({ item, rowId }) => (
                    <DataGridRow<RowOut>
                      key={rowId}
                      style={{ cursor: "pointer" }}
                      onClick={() => setDrawerRow(item)}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === "Enter") setDrawerRow(item);
                      }}
                    >
                      {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                    </DataGridRow>
                  )}
                </DataGridBody>
              </DataGrid>
            )}
          </div>
        </section>
      )}

      {drawerRow && current && <RowItemsDrawer versionId={current.id} row={drawerRow} onClose={() => setDrawerRow(null)} />}
      {finalizeOpen && current && (
        <FinalizeDialog
          version={current}
          pending={finalize.isPending}
          onClose={() => setFinalizeOpen(false)}
          onConfirm={(key) =>
            finalize.mutate(
              { versionId: current.id, key },
              {
                onSuccess: (v) => {
                  setSelectedId(v.id);
                  setFinalizeOpen(false);
                },
                onError: (e) => {
                  setActionError(e);
                  setFinalizeOpen(false);
                },
              },
            )
          }
        />
      )}
      {processedOpen && current && (
        <ProcessedDialog
          pending={markProcessed.isPending}
          onClose={() => setProcessedOpen(false)}
          onConfirm={(ref) =>
            markProcessed.mutate(
              { versionId: current.id, reference: ref || null },
              { onSettled: () => setProcessedOpen(false), onError: setActionError },
            )
          }
        />
      )}
      {reopenOpen && (
        <ReopenDialog
          pending={reopen.isPending}
          onClose={() => setReopenOpen(false)}
          onConfirm={(reason) => reopen.mutate(reason, { onSettled: () => setReopenOpen(false), onError: setActionError })}
        />
      )}
    </>
  );
}

function RowItemsDrawer({ versionId, row, onClose }: { versionId: string; row: RowOut; onClose: () => void }) {
  const admin = useAdminStyles();
  const items = usePayrollItems(versionId, row.id);
  return (
    <DetailsDrawer open title={row.worker_name ?? row.worker_human_id ?? "Worker"} onClose={onClose} size="medium">
      {!items.data ? (
        <GridSkeleton rows={3} />
      ) : (
        <dl className={admin.detailList}>
          {items.data.map((i) => (
            <div key={i.id} style={{ display: "contents" }}>
              <dt>{`${formatDate(i.item_date)} · ${i.category ?? i.bucket}`}</dt>
              <dd>{`${i.quantity} × ${i.rate ?? "—"} × ${i.multiplier ?? "—"} = ${displayMoney(i.amount, i.currency)}`}</dd>
            </div>
          ))}
        </dl>
      )}
    </DetailsDrawer>
  );
}

function FinalizeDialog({
  version,
  pending,
  onClose,
  onConfirm,
}: {
  version: VersionOut;
  pending: boolean;
  onClose: () => void;
  onConfirm: (key: string) => void;
}) {
  const admin = useAdminStyles();
  const [typed, setTyped] = useState("");
  const [key] = useState(newIdempotencyKey);
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{`Finalize ${version.supplementary ? "supplementary " : ""}payroll`}</DialogTitle>
          <DialogContent className={admin.form}>
            <Text>{`${version.row_count} worker${version.row_count === 1 ? "" : "s"}, ${version.item_count} items. Every item is posted once and the period is locked. This cannot be undone.`}</Text>
            {totalsLines(version).map((t) => (
              <Text key={t} weight="semibold">
                {t}
              </Text>
            ))}
            <Field label={`Type ${FINALIZE_WORD} to confirm`} required>
              <Input value={typed} onChange={(_, d) => setTyped(d.value)} aria-label="Confirmation" />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={!finalizeConfirmed(typed) || pending} onClick={() => onConfirm(key)}>
              Finalize
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function ProcessedDialog({ pending, onClose, onConfirm }: { pending: boolean; onClose: () => void; onConfirm: (ref: string) => void }) {
  const admin = useAdminStyles();
  const [ref, setRef] = useState("");
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Mark processed</DialogTitle>
          <DialogContent className={admin.form}>
            <Text>Confirms your payroll system has run this file. Reimbursed expense claims are closed.</Text>
            <Field label="Payroll reference (optional)">
              <Input value={ref} maxLength={200} onChange={(_, d) => setRef(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={pending} onClick={() => onConfirm(ref.trim())}>
              Mark processed
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function ReopenDialog({ pending, onClose, onConfirm }: { pending: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const admin = useAdminStyles();
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Reopen pay period</DialogTitle>
          <DialogContent className={admin.form}>
            <Text>Finalized versions never change. The next finalize in this period is a supplementary.</Text>
            <Field label="Reason" required>
              <Textarea value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={reason.trim().length < 3 || pending} onClick={() => onConfirm(reason.trim())}>
              Reopen
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
