"use client";

import {
  Avatar,
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
  Menu,
  type MenuButtonProps,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  SearchBox,
  SplitButton,
  TableCellLayout,
  type TableColumnDefinition,
  Text,
  ToggleButton,
} from "@fluentui/react-components";
import { Add20Regular, DocumentArrowUp20Regular, Edit20Regular, PersonAvailable20Regular, Sparkle20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { PersonPicker } from "@/features/activity/person-picker";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { ErrorBar, GridSkeleton, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { clientsApi } from "@/features/clients/api";
import { ExportMenu } from "@/features/exports/export-menu";
import { errorMessage } from "@/lib/api/errors";
import type { DemandOut, DemandPriority, DemandStatus } from "@/lib/api/types";
import { DemandStatusBadge, PriorityBadge, ProgressBadge, SlaBadge } from "./badges";
import { ClientPicker } from "./client-picker";
import { DemandDrawer } from "./demand-drawer";
import { formatDate } from "./format";
import { IntakeDialog } from "./intake-dialog";
// Epic 55: "Draft with Demand Agent" (shown when the agent is on).
import { DraftWithAgentDialog } from "@/features/agents/demand/draft-with-agent-dialog";
import { demandAgentOn } from "@/features/agents/demand/logic";
import { useAiFeatures } from "@/features/ai-admin/use-ai-features";
import {
  type DemandListFilters,
  type DemandSort,
  demandFiltersToSearch,
  EMPTY_DEMAND_FILTERS,
  demandExportFilters,
  hasDemandFilters,
  parseDemandFilters,
} from "./query";
import { DEMAND_STATUSES, PRIORITIES, PRIORITY_LABELS, STATUS_LABELS } from "./status";
import { useDemands } from "./use-demands";
import { usePredictionColumn } from "@/features/predictions/prediction-badge";

const SORT_COLUMNS: Record<string, [DemandSort, DemandSort]> = {
  created_at: ["created_at", "-created_at"],
  target: ["target_closure_date", "-target_closure_date"],
  priority: ["priority", "-priority"],
};

function sortState(sort: DemandSort): { sortColumn: string; sortDirection: "ascending" | "descending" } {
  for (const [col, [asc, desc]] of Object.entries(SORT_COLUMNS)) {
    if (sort === asc) return { sortColumn: col, sortDirection: "ascending" };
    if (sort === desc) return { sortColumn: col, sortDirection: "descending" };
  }
  return { sortColumn: "created_at", sortDirection: "descending" };
}


/** `/demands`: filterable demand list (filters live in the URL) with "New demand" (manual / from document). */
export function DemandList({ initialSearch }: { initialSearch: string }) {
  const styles = useAdminStyles();
  const router = useRouter();
  const canRead = usePermission("demand:read");
  const canCreate = usePermission("demand:create");
  const [filters, setFiltersState] = useState<DemandListFilters>(() => parseDemandFilters(new URLSearchParams(initialSearch)));
  const [assigneeLabel, setAssigneeLabel] = useState("");
  const [creating, setCreating] = useState<{ client: { id: string; name: string } | null } | null>(null);
  const [intake, setIntake] = useState(false);
  const [agentDraft, setAgentDraft] = useState(false);
  const aiFeatures = useAiFeatures();
  const deferred = useDeferredValue(filters);
  const list = useDemands(deferred, DEFAULT_PAGE_SIZE);

  const clientName = useQuery({
    queryKey: ["clients", "detail", filters.clientId, "name"],
    queryFn: ({ signal }) => clientsApi.get(filters.clientId!, signal),
    enabled: !!filters.clientId,
    staleTime: 5 * 60_000,
  });
  // Epic 48: optional time-to-fill column (batch predictions; none without `prediction:read`).
  const predictionColumns = usePredictionColumn("demand", list.data?.items, (d: DemandOut) => d.id);

  if (!canRead) return <NoAccess what="demands" />;

  const setFilters = (patch: Partial<DemandListFilters>, keepPage = false) => {
    const next = { ...filters, ...patch, page: keepPage ? (patch.page ?? filters.page) : 1 };
    setFiltersState(next);
    const qs = demandFiltersToSearch(next);
    router.replace(qs ? `/demands?${qs}` : "/demands", { scroll: false });
  };

  const columns: TableColumnDefinition<DemandOut>[] = [
    createTableColumn({
      columnId: "req_id",
      renderHeaderCell: () => "REQ ID",
      renderCell: (d) => (
        <TableCellLayout>
          <AppLink href={`/demands/${d.id}`}>{d.req_id}</AppLink>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "title",
      renderHeaderCell: () => "Title",
      renderCell: (d) => (
        <TableCellLayout truncate>
          <AppLink href={`/demands/${d.id}`} className={styles.truncate}>
            {d.title}
          </AppLink>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "client",
      renderHeaderCell: () => "Client",
      renderCell: (d) => <TableCellLayout truncate>{d.client_name ?? "—"}</TableCellLayout>,
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (d) => <DemandStatusBadge demand={d} />,
    }),
    createTableColumn({
      columnId: "progress",
      renderHeaderCell: () => "Progress",
      renderCell: (d) => <ProgressBadge progress={d.progress} />,
    }),
    createTableColumn({
      columnId: "priority",
      compare: () => 0,
      renderHeaderCell: () => "Priority",
      renderCell: (d) => <PriorityBadge priority={d.priority} />,
    }),
    createTableColumn({
      columnId: "recruiter",
      renderHeaderCell: () => "Primary recruiter",
      renderCell: (d) =>
        d.primary_recruiter ? (
          <TableCellLayout truncate media={<Avatar name={d.primary_recruiter.name ?? undefined} size={24} color="colorful" aria-hidden />}>
            {d.primary_recruiter.name ?? "—"}
          </TableCellLayout>
        ) : (
          <Text className={styles.muted}>Unassigned</Text>
        ),
    }),
    createTableColumn({
      columnId: "sla",
      renderHeaderCell: () => "SLA",
      renderCell: (d) => <SlaBadge status={d.sla_status} />,
    }),
    createTableColumn({
      columnId: "target",
      compare: () => 0,
      renderHeaderCell: () => "Target date",
      renderCell: (d) => formatDate(d.target_closure_date),
    }),
    createTableColumn({
      columnId: "created_at",
      compare: () => 0,
      renderHeaderCell: () => "Created",
      renderCell: (d) => formatDate(d.created_at.slice(0, 10)),
    }),
    ...predictionColumns,
  ];

  const items = list.data?.items;
  const filtered = hasDemandFilters(filters);
  const multiText = <T extends string>(values: T[], labels: Record<T, string>) =>
    values.length === 0 ? "Any" : values.map((v) => labels[v]).join(", ");

  return (
    <>
      <PageHeader title="Demands" subtitle="Hiring needs from your clients, from intake and approval to publishing and recruiting." />
      <div className={styles.toolbar}>
        {canCreate && (
          <Menu positioning="below-start">
            <MenuTrigger disableButtonEnhancement>
              {(triggerProps: MenuButtonProps) => (
                <SplitButton
                  appearance="primary"
                  icon={<Add20Regular />}
                  menuButton={triggerProps}
                  primaryActionButton={{ onClick: () => setCreating({ client: null }) }}
                >
                  New demand
                </SplitButton>
              )}
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem icon={<Edit20Regular />} onClick={() => setCreating({ client: null })}>
                  Manual
                </MenuItem>
                <MenuItem icon={<DocumentArrowUp20Regular />} onClick={() => setIntake(true)}>
                  From document
                </MenuItem>
                {demandAgentOn(aiFeatures.data) && (
                  <MenuItem icon={<Sparkle20Regular />} onClick={() => setAgentDraft(true)}>
                    Draft with Demand Agent
                  </MenuItem>
                )}
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
        <SearchBox
          className={styles.search}
          placeholder="Search by title or REQ ID"
          aria-label="Search demands"
          value={filters.q}
          maxLength={200}
          onChange={(_, d) => setFilters({ q: d.value })}
        />
        <Field label="Status" className={styles.filter}>
          <Dropdown
            multiselect
            value={multiText(filters.status, STATUS_LABELS)}
            selectedOptions={filters.status}
            onOptionSelect={(_, d) => setFilters({ status: d.selectedOptions as DemandStatus[] })}
          >
            {DEMAND_STATUSES.map((s) => (
              <Option key={s} value={s}>
                {STATUS_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Priority" className={styles.filter}>
          <Dropdown
            multiselect
            value={multiText(filters.priority, PRIORITY_LABELS)}
            selectedOptions={filters.priority}
            onOptionSelect={(_, d) => setFilters({ priority: d.selectedOptions as DemandPriority[] })}
          >
            {PRIORITIES.map((p) => (
              <Option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <ClientPicker
          className={styles.filter}
          value={filters.clientId}
          valueLabel={filters.clientId ? (clientName.data?.name ?? "") : ""}
          clearLabel="Any client"
          onChange={(c) => setFilters({ clientId: c?.id ?? null })}
        />
        <PersonPicker
          className={styles.filter}
          label="Assignee"
          value={filters.assignedTo && filters.assignedTo !== "me" ? filters.assignedTo : null}
          valueLabel={filters.assignedTo === "me" ? "Me" : filters.assignedTo ? assigneeLabel || "Selected person" : ""}
          placeholder="Anyone"
          clearLabel="Anyone"
          unavailableHint=""
          onChange={(p) => {
            setAssigneeLabel(p?.name ?? "");
            setFilters({ assignedTo: p?.id ?? null });
          }}
        />
        <ToggleButton
          icon={<PersonAvailable20Regular />}
          checked={filters.assignedTo === "me"}
          onClick={() => setFilters({ assignedTo: filters.assignedTo === "me" ? null : "me" })}
        >
          Assigned to me
        </ToggleButton>
        {filtered && (
          <Button appearance="subtle" onClick={() => setFilters({ ...EMPTY_DEMAND_FILTERS, sort: filters.sort })}>
            Clear filters
          </Button>
        )}
        <ExportMenu kind="demands" filters={demandExportFilters(filters)} disabled={list.data?.total === 0} />
      </div>

      {list.error && !items ? (
        <ErrorBar title="Could not load demands." message={errorMessage(list.error)} />
      ) : (
        <div className={styles.surface}>
          {list.isPending && !items ? (
            <GridSkeleton />
          ) : (
            <>
              <DataGrid
                items={items ?? []}
                columns={columns}
                getRowId={(d) => d.id}
                aria-label="Demands"
                className={styles.grid}
                style={{ minWidth: 1100 }}
                sortable
                sortState={sortState(filters.sort)}
                onSortChange={(_, s) => {
                  const pair = SORT_COLUMNS[String(s.sortColumn)];
                  if (pair) setFilters({ sort: s.sortDirection === "ascending" ? pair[0] : pair[1] });
                }}
                resizableColumns
                columnSizingOptions={{
                  req_id: { minWidth: 90, idealWidth: 100 },
                  title: { minWidth: 180, idealWidth: 240 },
                  client: { minWidth: 120, idealWidth: 160 },
                  status: { minWidth: 110, idealWidth: 130 },
                  progress: { minWidth: 100, idealWidth: 120 },
                  priority: { minWidth: 80, idealWidth: 90 },
                  recruiter: { minWidth: 140, idealWidth: 170 },
                  sla: { minWidth: 90, idealWidth: 110 },
                  target: { minWidth: 110, idealWidth: 120 },
                  created_at: { minWidth: 110, idealWidth: 120 },
                }}
                focusMode="composite"
              >
                <DataGridHeader>
                  <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
                </DataGridHeader>
                <DataGridBody<DemandOut>>
                  {({ item, rowId }) => (
                    <DataGridRow<DemandOut> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
                  )}
                </DataGridBody>
              </DataGrid>
              {items && items.length === 0 && (
                <div className={styles.empty}>
                  {filtered ? "No demands match these filters." : "No demands yet. Create the first one with New demand."}
                </div>
              )}
            </>
          )}
          {list.data && (
            <PagingBar
              page={filters.page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={list.data.total}
              onPageChange={(page) => setFilters({ page }, true)}
              busy={list.isFetching}
            />
          )}
        </div>
      )}

      {creating && (
        <DemandDrawer
          initialClient={creating.client}
          onClose={() => setCreating(null)}
          onSaved={(d) => router.push(`/demands/${d.id}`)}
        />
      )}
      <DraftWithAgentDialog open={agentDraft} onClose={() => setAgentDraft(false)} />
      {intake && (
        <IntakeDialog
          onClose={() => setIntake(false)}
          onCreated={(d) => {
            setIntake(false);
            router.push(`/demands/${d.id}`);
          }}
          onManual={(client) => {
            setIntake(false);
            setCreating({ client });
          }}
        />
      )}
    </>
  );
}
