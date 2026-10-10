"use client";

import {
  Button,
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
  Link,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  ProgressBar,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import {
  Add20Regular,
  Delete20Regular,
  DocumentCheckmark20Regular,
} from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { PrepareRunPanel } from "@/features/agents/finance/prepare-run-panel";
import {
  ErrorBar,
  GridSkeleton,
  NoAccess,
  useAdminStyles,
} from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import {
  legalEntitiesApi,
  legalEntityKeys,
} from "@/features/legal-entities/api";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { Money, StatusBadge, useBillingStyles } from "./components";
import { billingErrorMessage, newIdempotencyKey } from "./logic";
import { formatMoney, sumAmounts } from "./money";
import type {
  DocSummaryOut,
  IssueBatchOut,
  RunExceptionOut,
  RunOut,
} from "./types";
import { useInvoiceRun, useInvoiceRuns } from "./use-invoice-run";

const EXCEPTION_LABELS: Record<string, string> = {
  timesheet_not_approved: "Timesheets not approved",
  po_missing: "Purchase order missing",
  po_exhausted: "Purchase order exhausted",
  po_expired: "Purchase order expired",
  contract_expired: "Contract expired",
  rate_card_exception_unapproved: "Rate not approved",
  billing_profile_missing: "Billing profile missing",
  gstin_missing: "GSTIN missing",
  billing_rule_missing: "Billing rule missing",
  stale_unbilled: "Old unbilled items",
  mixed_currency: "Mixed currencies",
  place_of_supply_unresolved: "Place of supply unresolved",
  tax_rate_missing: "Tax rate missing",
  fx_rate_missing: "Exchange rate missing",
  lut_missing: "LUT missing",
  item_already_reserved: "Item already on another draft",
};

/** Where to fix an exception (deep link). */
function fixLink(e: RunExceptionOut): string | null {
  if (
    [
      "billing_profile_missing",
      "gstin_missing",
      "place_of_supply_unresolved",
      "po_missing",
    ].includes(e.kind) &&
    e.client_id
  )
    return `/clients/${e.client_id}`;
  if (["po_exhausted", "po_expired"].includes(e.kind))
    return "/purchase-orders";
  if (e.kind === "timesheet_not_approved") return "/timesheets";
  if (e.placement_id) return `/placements/${e.placement_id}`;
  return null;
}

/** `/billing/runs`: start a run (wizard), watch it build, review drafts / exceptions and issue in one go. */
export function InvoiceRunsView() {
  const admin = useAdminStyles();
  const perms = usePermissions();
  const canRead = hasAnyPermission(perms, ["billing:read", "billing:write"]);
  const canWrite = hasAnyPermission(perms, ["billing:write"]);
  const { query } = useInvoiceRuns();
  const [selected, setSelected] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  if (!canRead) return <NoAccess what="invoice runs" />;
  const columns: TableColumnDefinition<RunOut>[] = [
    createTableColumn({
      columnId: "run",
      renderHeaderCell: () => "Run",
      renderCell: (r) => r.human_id,
    }),
    createTableColumn({
      columnId: "period",
      renderHeaderCell: () => "Period",
      renderCell: (r) => `${r.period_start} – ${r.period_end}`,
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => r.status,
    }),
    createTableColumn({
      columnId: "drafts",
      renderHeaderCell: () => "Drafts",
      renderCell: (r) => String(r.draft_count),
    }),
    createTableColumn({
      columnId: "totals",
      renderHeaderCell: () => "Totals",
      renderCell: (r) =>
        Object.entries(r.totals)
          .map(([ccy, amt]) => formatMoney({ amount: amt, currency: ccy }))
          .join(" · ") || "—",
    }),
  ];
  return (
    <>
      <PageHeader
        title="Invoice runs"
        subtitle="Turn approved time, expenses and fees into GST invoice drafts"
      />
      <div className={admin.toolbar}>
        <span className={admin.grow} />
        {/* Epic 63: the Billing Agent prepares the run for a Finance User to approve. */}
        <PrepareRunPanel />
        {canWrite && (
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            onClick={() => setWizard(true)}
          >
            New invoice run
          </Button>
        )}
      </div>
      {query.error && !query.data ? (
        <ErrorBar
          title="Could not load invoice runs."
          message={errorMessage(query.error)}
        />
      ) : (
        <div className={admin.surface}>
          {!query.data ? (
            <GridSkeleton />
          ) : query.data.length === 0 ? (
            <div className={admin.empty}>No invoice runs yet.</div>
          ) : (
            <DataGrid
              items={query.data}
              columns={columns}
              getRowId={(r) => r.id}
              aria-label="Invoice runs"
              className={admin.grid}
              focusMode="composite"
            >
              <DataGridHeader>
                <DataGridRow>
                  {({ renderHeaderCell }) => (
                    <DataGridHeaderCell>
                      {renderHeaderCell()}
                    </DataGridHeaderCell>
                  )}
                </DataGridRow>
              </DataGridHeader>
              <DataGridBody<RunOut>>
                {({ item, rowId }) => (
                  <DataGridRow<RunOut>
                    key={rowId}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelected(item.id)}
                    onKeyDown={(e: React.KeyboardEvent) =>
                      e.key === "Enter" && setSelected(item.id)
                    }
                  >
                    {({ renderCell }) => (
                      <DataGridCell>{renderCell(item)}</DataGridCell>
                    )}
                  </DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
          )}
        </div>
      )}
      {selected && (
        <RunPanel
          id={selected}
          canWrite={canWrite}
          canIssue={hasAnyPermission(perms, ["invoice:issue"])}
        />
      )}
      {wizard && (
        <RunWizard
          onClose={() => setWizard(false)}
          onStarted={(id) => setSelected(id)}
        />
      )}
    </>
  );
}

function RunWizard({
  onClose,
  onStarted,
}: {
  onClose: () => void;
  onStarted: (id: string) => void;
}) {
  const s = useBillingStyles();
  const { start } = useInvoiceRuns();
  const entities = useQuery({
    queryKey: legalEntityKeys.list,
    queryFn: ({ signal }) => legalEntitiesApi.list(signal),
  });
  const [entity, setEntity] = useState("");
  const registrations = useQuery({
    queryKey: legalEntityKeys.registrations(entity),
    queryFn: ({ signal }) => legalEntitiesApi.registrations(entity, signal),
    enabled: Boolean(entity),
  });
  const [registration, setRegistration] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [key] = useState(newIdempotencyKey);
  const [error, setError] = useState<string | null>(null);
  const valid = entity && from && to && from <= to;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>New invoice run</DialogTitle>
          <DialogContent className={s.stack}>
            {error && (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            <Field label="Legal entity" required>
              <Dropdown
                placeholder="Select a legal entity"
                value={entities.data?.find((e) => e.id === entity)?.name ?? ""}
                selectedOptions={entity ? [entity] : []}
                onOptionSelect={(_, d) => {
                  setEntity(d.optionValue ?? "");
                  setRegistration("");
                }}
              >
                {(entities.data ?? []).map((e) => (
                  <Option key={e.id} value={e.id}>
                    {e.name}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field
              label="GST registration"
              hint="Defaults to the principal registration"
            >
              <Dropdown
                placeholder="Principal registration"
                value={
                  registrations.data?.find((r) => r.id === registration)
                    ?.gstin ?? ""
                }
                selectedOptions={registration ? [registration] : []}
                onOptionSelect={(_, d) => setRegistration(d.optionValue ?? "")}
                disabled={!entity}
              >
                {(registrations.data ?? []).map((r) => (
                  <Option key={r.id} value={r.id}>
                    {`${r.gstin} (${r.state_code})`}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <div className={s.row}>
              <Field label="Period start" required>
                <Input
                  type="date"
                  value={from}
                  onChange={(_, d) => setFrom(d.value)}
                />
              </Field>
              <Field label="Period end" required>
                <Input
                  type="date"
                  value={to}
                  onChange={(_, d) => setTo(d.value)}
                />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={!valid || start.isPending}
              onClick={async () => {
                setError(null);
                try {
                  const run = await start.mutateAsync({
                    body: {
                      legal_entity_id: entity,
                      gst_registration_id: registration || null,
                      period_start: from,
                      period_end: to,
                    },
                    key,
                  });
                  onStarted(run.id);
                  onClose();
                } catch (e) {
                  setError(
                    billingErrorMessage(
                      isApiError(e) ? e.code : undefined,
                      errorMessage(e),
                    ),
                  );
                }
              }}
            >
              Start run
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function RunPanel({
  id,
  canWrite,
  canIssue,
}: {
  id: string;
  canWrite: boolean;
  canIssue: boolean;
}) {
  const admin = useAdminStyles();
  const s = useBillingStyles();
  const { query, discard, issueBatch } = useInvoiceRun(id);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<IssueBatchOut | null>(null);
  const run = query.data;
  const issuable = useMemo(
    () =>
      (run?.drafts ?? []).filter(
        (d) =>
          d.status === "draft" ||
          (d.status === "pending_approval" && d.approved),
      ),
    [run],
  );
  const byKind = useMemo(() => {
    const groups: Record<string, RunExceptionOut[]> = {};
    for (const e of run?.exceptions ?? []) (groups[e.kind] ??= []).push(e);
    return groups;
  }, [run]);
  if (!run)
    return query.error ? (
      <ErrorBar message={errorMessage(query.error)} />
    ) : (
      <GridSkeleton rows={3} />
    );
  const currencies = [...new Set(issuable.map((d) => d.currency))];
  const totalText = currencies
    .map((c) =>
      formatMoney({
        amount: sumAmounts(
          issuable.filter((d) => d.currency === c).map((d) => d.document_total),
        ),
        currency: c,
      }),
    )
    .join(" + ");
  const columns: TableColumnDefinition<DocSummaryOut>[] = [
    createTableColumn({
      columnId: "client",
      renderHeaderCell: () => "Client",
      renderCell: (d) => d.client_name ?? d.client_id.slice(0, 8),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (d) => <StatusBadge status={d.status} />,
    }),
    createTableColumn({
      columnId: "number",
      renderHeaderCell: () => "Number",
      renderCell: (d) => d.number ?? "—",
    }),
    createTableColumn({
      columnId: "supply",
      renderHeaderCell: () => "Supply",
      renderCell: (d) => d.supply_type ?? "—",
    }),
    createTableColumn({
      columnId: "taxable",
      renderHeaderCell: () => "Taxable",
      renderCell: (d) => (
        <Money amount={d.taxable_total} currency={d.currency} />
      ),
    }),
    createTableColumn({
      columnId: "total",
      renderHeaderCell: () => "Total",
      renderCell: (d) => (
        <Money amount={d.document_total} currency={d.currency} strong />
      ),
    }),
    createTableColumn({
      columnId: "result",
      renderHeaderCell: () => "Result",
      renderCell: (d) => {
        const r = result?.results.find((x) => x.id === d.id);
        return r
          ? r.ok
            ? `Issued ${r.number}`
            : billingErrorMessage(r.code ?? undefined, r.message ?? "Failed")
          : "";
      },
    }),
    createTableColumn({
      columnId: "open",
      renderHeaderCell: () => "",
      renderCell: (d) => (
        <Link as="a" href={`/billing/invoices/${d.id}`}>
          Open
        </Link>
      ),
    }),
  ];
  return (
    <div className={mergeClasses(s.stack, s.card)} style={{ marginTop: 24 }}>
      <div className={s.row}>
        <strong>{run.human_id}</strong>
        <span className={admin.muted}>
          {run.period_start} – {run.period_end} · {run.status}
        </span>
        <span className={admin.grow} />
        {canWrite && run.status === "built" && (
          <Button
            icon={<Delete20Regular />}
            onClick={() => discard.mutate()}
            disabled={discard.isPending}
          >
            Discard drafts
          </Button>
        )}
        {canIssue && run.status === "built" && issuable.length > 0 && (
          <Button
            appearance="primary"
            icon={<DocumentCheckmark20Regular />}
            onClick={() => setConfirm(true)}
          >
            {`Issue ${issuable.length} invoice${issuable.length === 1 ? "" : "s"} totalling ${totalText}`}
          </Button>
        )}
      </div>
      {(run.status === "queued" || run.status === "building") && (
        <ProgressBar value={run.progress_pct / 100} thickness="large" />
      )}
      {run.status === "failed" && (
        <ErrorBar title="The run failed." message={run.error} />
      )}
      {Object.keys(byKind).length > 0 && (
        <MessageBar
          intent={
            run.exceptions.some((e) => e.severity === "error")
              ? "warning"
              : "info"
          }
          layout="multiline"
        >
          <MessageBarBody>
            <MessageBarTitle>Exceptions</MessageBarTitle>
            <ul>
              {Object.entries(byKind).map(([kind, list]) => (
                <li key={kind}>
                  {`${EXCEPTION_LABELS[kind] ?? kind}: ${list.length}`}{" "}
                  {list.slice(0, 3).map((e) => {
                    const href = fixLink(e);
                    return href ? (
                      <Link
                        key={e.id}
                        as="a"
                        href={href}
                        style={{ marginInlineStart: 8 }}
                      >
                        Fix
                      </Link>
                    ) : null;
                  })}
                </li>
              ))}
            </ul>
          </MessageBarBody>
        </MessageBar>
      )}
      <div className={admin.surface}>
        {run.drafts.length === 0 ? (
          <div className={admin.empty}>No drafts in this run.</div>
        ) : (
          <DataGrid
            items={run.drafts}
            columns={columns}
            getRowId={(d) => d.id}
            aria-label="Draft invoices"
            className={admin.grid}
            focusMode="composite"
          >
            <DataGridHeader>
              <DataGridRow>
                {({ renderHeaderCell }) => (
                  <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                )}
              </DataGridRow>
            </DataGridHeader>
            <DataGridBody<DocSummaryOut>>
              {({ item, rowId }) => (
                <DataGridRow<DocSummaryOut> key={rowId}>
                  {({ renderCell }) => (
                    <DataGridCell>{renderCell(item)}</DataGridCell>
                  )}
                </DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        )}
      </div>
      <IssueConfirmDialog
        open={confirm}
        count={issuable.length}
        totalText={totalText}
        onClose={() => setConfirm(false)}
        onConfirm={async (key) =>
          setResult(
            await issueBatch.mutateAsync({
              ids: issuable.map((d) => d.id),
              key,
            }),
          )
        }
      />
      <NextLink href="/billing/invoices">All invoices</NextLink>
    </div>
  );
}

/** Deliberate confirmation before numbering N invoices (numbers are final and gap-free). */
export function IssueConfirmDialog({
  open,
  count,
  totalText,
  onConfirm,
  onClose,
}: {
  open: boolean;
  count: number;
  totalText: string;
  onConfirm: (key: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [key] = useState(newIdempotencyKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      modalType="alert"
      onOpenChange={(_, d) => !d.open && !busy && onClose()}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{`Issue ${count} invoice${count === 1 ? "" : "s"}?`}</DialogTitle>
          <DialogContent>
            {error && (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            <p>{`You are about to issue ${count} invoice${count === 1 ? "" : "s"} totalling ${totalText}.`}</p>
            <p>
              Issued invoices get their final number and can no longer be
              edited; corrections need a credit or debit note.
            </p>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await onConfirm(key);
                  onClose();
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Issue
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
