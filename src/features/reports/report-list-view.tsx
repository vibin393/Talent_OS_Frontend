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
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Option,
  TableCellLayout,
  type TableColumnDefinition,
  ToggleButton,
  Tooltip,
} from "@fluentui/react-components";
import { LockClosed16Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { ErrorBar, GridSkeleton, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { hasPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { ExportMenu } from "@/features/exports/export-menu";
import { errorMessage } from "@/lib/api/errors";
import type { ReportColumnOut } from "@/lib/api/types";
import { candidateHref, formatReportCell, reportRowHref, visibleColumns } from "./format";
import {
  financeVisibleColumns,
  FILTER_SPECS,
  type FilterSpec,
  hasReportFilters,
  hiddenFilterLabels,
  REPORT_LABELS,
  REPORT_READ_PERMISSION,
  reportExportFilters,
  type ReportKind,
  type ReportParams,
  parseReportParams,
  reportParamsToSearch,
  sortState,
  toSort,
  withFilter,
} from "./query";
import { useReportList } from "./use-report-list";

type Row = Record<string, unknown> & { id: string };

const SUBTITLES: Record<ReportKind, string> = {
  applications: "Candidates in demand pipelines, by stage, source and owner.",
  submissions: "Candidates sent to clients, with client feedback.",
  interviews: "Scheduled and past interviews.",
  offers: "Offers and their status.",
  leads: "Sales leads.",
  opportunities: "Sales opportunities and their stage.",
  vendors: "Staffing vendors.",
  vendor_submissions: "Candidates submitted by vendors.",
  placements: "Placements, their dates and rates.",
  timesheets: "Timesheets by period and status.",
  expense_claims: "Worker expense claims.",
  invoices: "Issued invoices with e-invoice and payment status.",
  payments: "Client payments received.",
  bgv_cases: "Background verification cases.",
};

function FilterControl({ spec, params, onChange }: { spec: FilterSpec; params: ReportParams; onChange: (p: ReportParams) => void }) {
  const styles = useAdminStyles();
  const current = params.filters[spec.key]?.[0] ?? "";
  const set = (value: string | null) => onChange(withFilter(params, spec.key, value));
  switch (spec.type) {
    case "date":
      return (
        <Field label={spec.label} className={styles.filter}>
          <Input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(current) ? current : ""} onChange={(_, d) => set(d.value || null)} />
        </Field>
      );
    case "number":
      return (
        <Field label={spec.label} className={styles.filter}>
          <Input
            type="number"
            min={spec.min}
            max={spec.max}
            value={current}
            onChange={(_, d) => set(d.value.replace(/[^0-9]/g, "") || null)}
          />
        </Field>
      );
    case "toggle": {
      const on = current === spec.on;
      return (
        <ToggleButton checked={on} aria-pressed={on} onClick={() => set(on ? null : spec.on)}>
          {spec.label}
        </ToggleButton>
      );
    }
    case "select": {
      const selected = current ? current.split(",").filter(Boolean) : [];
      const text = selected.map((v) => spec.options.find((o) => o.value === v)?.label ?? v).join(", ");
      return (
        <Field label={spec.label} className={styles.filter}>
          <Dropdown
            multiselect={spec.multi}
            placeholder="Any"
            value={text}
            selectedOptions={selected}
            onOptionSelect={(_, d) => {
              if (spec.multi) set(d.selectedOptions.join(",") || null);
              else set(d.optionValue && d.optionValue !== current ? d.optionValue : null);
            }}
          >
            {spec.options.map((o) => (
              <Option key={o.value} value={o.value}>
                {o.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
      );
    }
  }
}

function MaskedCell() {
  return (
    <Tooltip content="You don't have permission to view compensation" relationship="description">
      <TableCellLayout media={<LockClosed16Regular aria-hidden />}>Hidden</TableCellLayout>
    </Tooltip>
  );
}

/** `/reports/[kind]`: generic sortable, filterable, paged list of a report kind (a dashboard drill-down target). */
export function ReportListView({ kind, initialSearch }: { kind: ReportKind; initialSearch: string }) {
  const styles = useAdminStyles();
  const router = useRouter();
  const permissions = usePermissions();
  const [params, setParamsState] = useState<ReportParams>(() => parseReportParams(kind, new URLSearchParams(initialSearch)));
  const list = useReportList(kind, params, DEFAULT_PAGE_SIZE);

  if (!hasPermission(permissions, "report:read") && Object.keys(permissions).length > 0) {
    return <NoAccess what="reports" />;
  }

  const setParams = (next: ReportParams) => {
    setParamsState(next);
    const qs = reportParamsToSearch(next);
    router.replace(qs ? `/reports/${kind}?${qs}` : `/reports/${kind}`, { scroll: false });
  };
  const clearFilters = () => setParams({ filters: {}, sort: params.sort, page: 1, fromDashboard: false });

  const apiColumns = list.data?.columns ?? [];
  const shown = financeVisibleColumns(kind, visibleColumns(apiColumns), hasPermission(permissions, "report:finance_export"));
  const columns: TableColumnDefinition<Row>[] = shown.map((c: ReportColumnOut, i) =>
    createTableColumn<Row>({
      columnId: c.key,
      compare: c.sortable ? () => 0 : undefined,
      renderHeaderCell: () => c.label,
      renderCell: (row) => {
        if (c.masked) return <MaskedCell />;
        const text = formatReportCell(row[c.key], c);
        const href = c.key === "candidate" ? candidateHref(row) : i === 0 ? reportRowHref(kind, row) : null;
        return <TableCellLayout truncate>{href ? <AppLink href={href}>{text}</AppLink> : text}</TableCellLayout>;
      },
    }),
  );
  const items = list.data?.items as Row[] | undefined;
  const filtered = hasReportFilters(params);
  const hidden = hiddenFilterLabels(kind, params);
  const canExportRead = hasPermission(permissions, REPORT_READ_PERMISSION[kind]);

  return (
    <>
      <PageHeader title={REPORT_LABELS[kind]} subtitle={SUBTITLES[kind]} />
      {(params.fromDashboard || hidden.length > 0) && filtered && (
        <MessageBar intent="info" style={{ marginBottom: 12 }}>
          <MessageBarBody>
            {params.fromDashboard ? "Filtered from dashboard" : "Filtered"}
            {hidden.length > 0 ? ` (also by ${hidden.join(", ")})` : ""}.
          </MessageBarBody>
          <MessageBarActions>
            <Button size="small" onClick={clearFilters}>
              Clear filters
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}
      <div className={styles.toolbar} role="toolbar" aria-label={`${REPORT_LABELS[kind]} filters`}>
        {FILTER_SPECS[kind].map((spec) => (
          <FilterControl key={spec.key} spec={spec} params={params} onChange={setParams} />
        ))}
        {filtered && !params.fromDashboard && hidden.length === 0 && (
          <Button appearance="subtle" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
        <div className={styles.grow} />
        {canExportRead && (
          <ExportMenu
            kind={kind}
            filters={reportExportFilters(params)}
            columns={shown.map((c) => c.key)}
            disabled={!list.data || list.data.total === 0}
          />
        )}
      </div>

      {list.error && !items ? (
        <ErrorBar title={`Could not load ${REPORT_LABELS[kind].toLowerCase()}.`} message={errorMessage(list.error)} />
      ) : (
        <div className={styles.surface}>
          {list.isPending && !items ? (
            <GridSkeleton />
          ) : (
            <DataGrid
              items={items ?? []}
              columns={columns}
              getRowId={(r) => r.id}
              aria-label={REPORT_LABELS[kind]}
              className={styles.grid}
              sortable
              sortState={sortState(params.sort)}
              onSortChange={(_, s) => {
                const col = shown.find((c) => c.key === String(s.sortColumn));
                if (col?.sortable) setParams({ ...params, sort: toSort(col.key, s.sortDirection), page: 1 });
              }}
              resizableColumns
              focusMode="composite"
            >
              <DataGridHeader>
                <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
              </DataGridHeader>
              <DataGridBody<Row>>
                {({ item, rowId }) => <DataGridRow<Row> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>}
              </DataGridBody>
            </DataGrid>
          )}
          {items && items.length === 0 && (
            <div className={styles.empty}>{filtered ? `No ${REPORT_LABELS[kind].toLowerCase()} match these filters.` : `No ${REPORT_LABELS[kind].toLowerCase()} yet.`}</div>
          )}
          {list.data && (
            <PagingBar
              page={params.page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={list.data.total}
              onPageChange={(page) => setParams({ ...params, page })}
              busy={list.isFetching}
            />
          )}
        </div>
      )}
    </>
  );
}

