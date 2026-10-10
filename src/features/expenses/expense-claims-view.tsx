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
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Option,
  Switch,
  type TableColumnDefinition,
  Textarea,
} from "@fluentui/react-components";
import { PersonAdd20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { expenseErrorMessage, flagLabel, FLAG_LABELS, formatDate, STATUS_LABELS, statusColor, statusLabel } from "./format";
import { formatMoney } from "./money";
import { CLAIM_STATUSES, EXPENSE_FLAGS, type ClaimFilters, type ClaimSummaryOut } from "./types";
import { useExpenseClaims } from "./use-expense-claims";

export const EXPENSE_READ_PERMISSIONS = ["expense:read", "expense:admin", "expense:approve"] as const;

/** `/expenses`: internal expense claims grid with status / flag / unposted filters and proxy claim creation. */
export function ExpenseClaimsView() {
  const admin = useAdminStyles();
  const router = useRouter();
  const perms = usePermissions();
  const canRead = hasAnyPermission(perms, EXPENSE_READ_PERMISSIONS);
  const canAdmin = hasAnyPermission(perms, ["expense:admin"]);
  const [status, setStatus] = useState("");
  const [flag, setFlag] = useState("");
  const [unposted, setUnposted] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [proxyOpen, setProxyOpen] = useState(false);
  const filters: ClaimFilters = {
    status: status || undefined,
    flag: flag || undefined,
    unposted: unposted ? "true" : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  };
  const { query } = useExpenseClaims(filters, canRead);
  if (!canRead) return <NoAccess what="expenses" />;

  const columns: TableColumnDefinition<ClaimSummaryOut>[] = [
    createTableColumn({
      columnId: "id",
      renderHeaderCell: () => "Claim",
      renderCell: (r) => (
        <span className={admin.cellStack}>
          <span>{r.human_id}</span>
          {r.title && <span className={admin.muted}>{r.title}</span>}
        </span>
      ),
    }),
    createTableColumn({ columnId: "worker", renderHeaderCell: () => "Worker", renderCell: (r) => r.worker_name ?? "—" }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (r) => r.client_name ?? "—" }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <span className={admin.badges}>
          <Badge appearance="tint" color={statusColor(r.status)}>
            {statusLabel(r.status)}
          </Badge>
          {r.is_proxy && <Badge appearance="outline">Proxy</Badge>}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "flags",
      renderHeaderCell: () => "Flags",
      renderCell: (r) =>
        r.flags.length ? (
          <span className={admin.badges}>
            {r.flags.map((f) => (
              <Badge key={f} appearance="tint" color="warning">
                {flagLabel(f)}
              </Badge>
            ))}
          </span>
        ) : (
          "—"
        ),
    }),
    createTableColumn({ columnId: "submitted", renderHeaderCell: () => "Submitted", renderCell: (r) => formatDate(r.submitted_at) }),
    createTableColumn({ columnId: "lines", renderHeaderCell: () => "Lines", renderCell: (r) => String(r.line_count) }),
    createTableColumn({ columnId: "claimed", renderHeaderCell: () => "Claimed", renderCell: (r) => formatMoney(r.total_claimed, r.currency) }),
    createTableColumn({ columnId: "approved", renderHeaderCell: () => "Approved", renderCell: (r) => formatMoney(r.total_approved, r.currency) }),
    createTableColumn({ columnId: "unposted", renderHeaderCell: () => "Unposted", renderCell: (r) => (r.unposted_lines ? String(r.unposted_lines) : "—") }),
  ];

  return (
    <>
      <PageHeader title="Expenses" subtitle="Worker expense claims, approvals and posting status" />
      <div className={admin.toolbar}>
        <Field label="Status" className={admin.filter}>
          <Dropdown
            placeholder="Any"
            selectedOptions={status ? [status] : []}
            value={status ? statusLabel(status) : ""}
            onOptionSelect={(_, d) => setStatus(d.optionValue === "any" ? "" : (d.optionValue ?? ""))}
          >
            <Option value="any">Any</Option>
            {CLAIM_STATUSES.map((s) => (
              <Option key={s} value={s}>
                {STATUS_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Flag" className={admin.filter}>
          <Dropdown
            placeholder="Any"
            selectedOptions={flag ? [flag] : []}
            value={flag ? flagLabel(flag) : ""}
            onOptionSelect={(_, d) => setFlag(d.optionValue === "any" ? "" : (d.optionValue ?? ""))}
          >
            <Option value="any">Any</Option>
            {EXPENSE_FLAGS.map((f) => (
              <Option key={f} value={f}>
                {FLAG_LABELS[f]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="From" className={admin.filter}>
          <Input type="date" value={dateFrom} onChange={(_, d) => setDateFrom(d.value)} />
        </Field>
        <Field label="To" className={admin.filter}>
          <Input type="date" value={dateTo} onChange={(_, d) => setDateTo(d.value)} />
        </Field>
        <Switch label="Unposted only" checked={unposted} onChange={(_, d) => setUnposted(d.checked)} />
        <span className={admin.grow} />
        {canAdmin && (
          <Button icon={<PersonAdd20Regular />} onClick={() => setProxyOpen(true)}>
            Proxy claim
          </Button>
        )}
      </div>
      {query.error && !query.data ? (
        <ErrorBar title="Could not load expense claims." message={errorMessage(query.error)} />
      ) : (
        <div className={admin.surface}>
          {!query.data ? (
            <GridSkeleton />
          ) : query.data.length === 0 ? (
            <div className={admin.empty}>No expense claims match these filters.</div>
          ) : (
            <DataGrid items={query.data} columns={columns} getRowId={(r) => r.id} aria-label="Expense claims" className={admin.grid} focusMode="composite">
              <DataGridHeader>
                <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
              </DataGridHeader>
              <DataGridBody<ClaimSummaryOut>>
                {({ item, rowId }) => (
                  <DataGridRow<ClaimSummaryOut>
                    key={rowId}
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push(`/expenses/${encodeURIComponent(item.id)}`)}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter") router.push(`/expenses/${encodeURIComponent(item.id)}`);
                    }}
                  >
                    {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                  </DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
          )}
        </div>
      )}
      {proxyOpen && <ProxyClaimDialog onClose={() => setProxyOpen(false)} filters={filters} />}
    </>
  );
}

function ProxyClaimDialog({ onClose, filters }: { onClose: () => void; filters: ClaimFilters }) {
  const admin = useAdminStyles();
  const router = useRouter();
  const { createProxy } = useExpenseClaims(filters, false);
  const [placementId, setPlacementId] = useState("");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const valid = placementId.trim() !== "" && reason.trim() !== "";
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !createProxy.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Proxy expense claim</DialogTitle>
          <DialogContent className={admin.form}>
            <Field label="Placement ID" required hint="The placement the worker claims against">
              <Input value={placementId} onChange={(_, d) => setPlacementId(d.value)} />
            </Field>
            <Field label="Title">
              <Input value={title} maxLength={200} onChange={(_, d) => setTitle(d.value)} />
            </Field>
            <Field label="Reason" required hint="Why you are entering this claim for the worker (audited)">
              <Textarea value={reason} maxLength={2000} onChange={(_, d) => setReason(d.value)} />
            </Field>
            <ErrorBar message={createProxy.isError ? expenseErrorMessage(createProxy.error, errorMessage) : null} />
          </DialogContent>
          <DialogActions>
            <Button disabled={createProxy.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!valid || createProxy.isPending}
              onClick={async () => {
                try {
                  const c = await createProxy.mutateAsync({
                    placement_id: placementId.trim(),
                    title: title.trim() || null,
                    proxy_reason: reason.trim(),
                  });
                  router.push(`/expenses/${encodeURIComponent(c.id)}`);
                } catch {
                  // shown inline
                }
              }}
            >
              Create
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
