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
  Option,
  SearchBox,
  type TableColumnDefinition,
  TableCellLayout,
  Text,
  ToggleButton,
  Toolbar,
} from "@fluentui/react-components";
import { Add20Regular, ArrowUpload20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { PersonPicker } from "@/features/activity/person-picker";
import { ErrorBar, GridSkeleton, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { EMPTY_LEAD_FILTERS, type LeadFilters } from "../api";
import { formatDate, formatMoney, LEAD_STATUS_LABELS, LEAD_STATUSES, startOfWeek } from "../format";
import type { LeadOut, LeadStatus } from "../types";
import { LeadStatusBadge } from "../ui";
import { LEAD_PAGE_SIZE, useLeadSources, useLeads } from "../use-leads";
import { ImportLeadsDialog } from "./import-dialog";
import { LeadDrawer } from "./lead-drawer";

const ALL = "__all__";

/** `/leads`: lead list with filters, quick filters, new-lead drawer and CSV import. */
export function LeadsView({ initialFilters }: { initialFilters?: LeadFilters }) {
  const styles = useAdminStyles();
  const router = useRouter();
  const { data: me } = useMe();
  const canRead = usePermission("lead:read");
  const canWrite = usePermission("lead:write");
  const sources = useLeadSources();
  const [filters, setFilters] = useState<LeadFilters>(initialFilters ?? EMPTY_LEAD_FILTERS);
  const [ownerLabel, setOwnerLabel] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const deferred = useDeferredValue(filters);
  const list = useLeads(deferred, page);

  const sourceLabel = useMemo(() => {
    const m = new Map((sources.data ?? []).map((s) => [s.code, s.label]));
    return (code: string | null) => (code ? (m.get(code) ?? code) : "—");
  }, [sources.data]);

  const columns: TableColumnDefinition<LeadOut>[] = useMemo(
    () => [
      createTableColumn<LeadOut>({
        columnId: "id",
        renderHeaderCell: () => "Lead",
        renderCell: (l) => <AppLink href={`/leads/${l.id}`}>{l.human_id}</AppLink>,
      }),
      createTableColumn<LeadOut>({
        columnId: "company",
        renderHeaderCell: () => "Company",
        renderCell: (l) => (
          <TableCellLayout truncate>
            <Text weight="semibold">{l.company_name}</Text>
          </TableCellLayout>
        ),
      }),
      createTableColumn<LeadOut>({
        columnId: "contact",
        renderHeaderCell: () => "Contact",
        renderCell: (l) => <TableCellLayout truncate>{l.contact_name ?? "—"}</TableCellLayout>,
      }),
      createTableColumn<LeadOut>({
        columnId: "source",
        renderHeaderCell: () => "Source",
        renderCell: (l) => sourceLabel(l.source_code),
      }),
      createTableColumn<LeadOut>({
        columnId: "owner",
        renderHeaderCell: () => "Owner",
        renderCell: (l) => <TableCellLayout truncate>{l.owner?.name ?? "—"}</TableCellLayout>,
      }),
      createTableColumn<LeadOut>({
        columnId: "status",
        renderHeaderCell: () => "Status",
        renderCell: (l) => <LeadStatusBadge status={l.status} />,
      }),
      createTableColumn<LeadOut>({
        columnId: "revenue",
        renderHeaderCell: () => "Est. revenue",
        renderCell: (l) => formatMoney(l.expected_annual_revenue, l.currency),
      }),
      createTableColumn<LeadOut>({
        columnId: "created",
        renderHeaderCell: () => "Created",
        renderCell: (l) => formatDate(l.created_at),
      }),
    ],
    [sourceLabel],
  );

  if (!canRead) return <NoAccess what="leads" />;

  const update = (patch: Partial<LeadFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const mine = !!me && filters.ownerId === me.user.id;
  const weekStart = startOfWeek();
  const thisWeek = filters.createdFrom === weekStart && !filters.createdTo;
  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY_LEAD_FILTERS);
  const items = list.data?.items;

  return (
    <>
      <PageHeader title="Leads" subtitle="Prospective clients you are working to qualify and convert." />
      <Toolbar aria-label="Lead filters" className={styles.toolbar}>
        {canWrite && (
          <>
            <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
              New lead
            </Button>
            <Button icon={<ArrowUpload20Regular />} onClick={() => setImporting(true)}>
              Import
            </Button>
          </>
        )}
        <SearchBox
          className={styles.search}
          placeholder="Search company or contact"
          aria-label="Search leads"
          value={filters.q}
          maxLength={200}
          onChange={(_, d) => update({ q: d.value })}
        />
        <Field label="Status" className={styles.filter}>
          <Dropdown
            value={filters.status ? LEAD_STATUS_LABELS[filters.status] : "All"}
            selectedOptions={[filters.status ?? ALL]}
            onOptionSelect={(_, d) => update({ status: d.optionValue === ALL ? null : (d.optionValue as LeadStatus) })}
          >
            <Option value={ALL}>All</Option>
            {LEAD_STATUSES.map((s) => (
              <Option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Source" className={styles.filter}>
          <Dropdown
            value={filters.source ? sourceLabel(filters.source) : "All"}
            selectedOptions={[filters.source ?? ALL]}
            onOptionSelect={(_, d) => update({ source: d.optionValue === ALL ? null : (d.optionValue ?? null) })}
          >
            <Option value={ALL}>All</Option>
            {(sources.data ?? []).map((s) => (
              <Option key={s.id} value={s.code}>
                {s.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <PersonPicker
          className={styles.filter}
          label="Owner"
          value={filters.ownerId}
          valueLabel={filters.ownerId ? ownerLabel : ""}
          placeholder="Anyone"
          clearLabel="Anyone"
          unavailableHint=""
          onChange={(p) => {
            setOwnerLabel(p?.name ?? "");
            update({ ownerId: p?.id ?? null });
          }}
        />
        <Field label="Created from" className={styles.filter}>
          <Input type="date" value={filters.createdFrom ?? ""} onChange={(_, d) => update({ createdFrom: d.value || null })} />
        </Field>
        <Field label="Created to" className={styles.filter}>
          <Input type="date" value={filters.createdTo ?? ""} onChange={(_, d) => update({ createdTo: d.value || null })} />
        </Field>
        {me && (
          <ToggleButton
            checked={mine}
            onClick={() => {
              setOwnerLabel(mine ? "" : me.user.name || me.user.email);
              update({ ownerId: mine ? null : me.user.id });
            }}
          >
            My leads
          </ToggleButton>
        )}
        <ToggleButton
          checked={thisWeek}
          onClick={() => update(thisWeek ? { createdFrom: null } : { createdFrom: weekStart, createdTo: null })}
        >
          New this week
        </ToggleButton>
        {filtered && (
          <Button
            appearance="subtle"
            onClick={() => {
              setOwnerLabel("");
              update(EMPTY_LEAD_FILTERS);
            }}
          >
            Clear filters
          </Button>
        )}
      </Toolbar>

      {list.error && !items ? (
        <ErrorBar title="Could not load leads." message={errorMessage(list.error)} />
      ) : (
        <div className={styles.surface}>
          {list.isPending && !items ? (
            <GridSkeleton />
          ) : (
            <>
              <DataGrid
                items={items ?? []}
                columns={columns}
                getRowId={(l) => l.id}
                aria-label="Leads"
                className={styles.grid}
                focusMode="composite"
                resizableColumns
              >
                <DataGridHeader>
                  <DataGridRow>
                    {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
                  </DataGridRow>
                </DataGridHeader>
                <DataGridBody<LeadOut>>
                  {({ item, rowId }) => (
                    <DataGridRow<LeadOut> key={rowId}>
                      {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                    </DataGridRow>
                  )}
                </DataGridBody>
              </DataGrid>
              {items && items.length === 0 && (
                <div className={styles.empty}>{filtered ? "No leads match these filters." : "No leads yet."}</div>
              )}
            </>
          )}
          {list.data && (
            <PagingBar
              page={page}
              pageSize={LEAD_PAGE_SIZE}
              total={list.data.total}
              onPageChange={setPage}
              busy={list.isFetching}
            />
          )}
        </div>
      )}
      {creating && <LeadDrawer onClose={() => setCreating(false)} onSaved={(l) => router.push(`/leads/${l.id}`)} />}
      <ImportLeadsDialog open={importing} onClose={() => setImporting(false)} />
    </>
  );
}
