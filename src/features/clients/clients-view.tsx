"use client";

import {
  Avatar,
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
  Option,
  SearchBox,
  Switch,
  TableCellLayout,
  type TableColumnDefinition,
  Text, mergeClasses } from "@fluentui/react-components";
import { Add20Regular, Archive20Regular, ArchiveArrowBack20Regular, Edit20Regular, Open20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { PersonPicker } from "@/features/activity/person-picker";
import { RowActions } from "@/features/admin/admin-grid";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { usePermission, usePermissions } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import type { ClientOut, ClientStatus } from "@/lib/api/types";
import { canActOnOwned } from "./access";
import { clientKeys, clientsApi } from "./api";
import { ClientDrawer } from "./client-drawer";
import { useArchiveClient } from "./use-archive-client";
import { CLIENT_STATUS_COLORS, CLIENT_STATUS_LABELS, CLIENT_STATUSES, formatLocations } from "./format";
import {
  type ClientListFilters,
  type ClientSort,
  DEFAULT_CLIENT_SORT,
  EMPTY_CLIENT_FILTERS,
  hasClientFilters,
  isClientSortField,
} from "./query";

const ALL = "__all__";

/**
 * Rows arrive sorted by the API; this no-op comparator only marks a column as sortable (Fluent checks the
 * comparator's arity, so it must declare two parameters).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const serverSorted = (_a: ClientOut, _b: ClientOut) => 0;

export function ClientStatusBadge({ client }: { client: Pick<ClientOut, "status" | "archived_at"> }) {
  if (client.archived_at) {
    return (
      <Badge appearance="tint" color="subtle" icon={<Archive20Regular />}>
        Archived
      </Badge>
    );
  }
  return (
    <Badge appearance="tint" color={CLIENT_STATUS_COLORS[client.status]}>
      {CLIENT_STATUS_LABELS[client.status]}
    </Badge>
  );
}

/** `/clients`: searchable, filterable, sortable client list with "New client" drawer and row actions. */
export function ClientsView() {
  const styles = useAdminStyles();
  const router = useRouter();
  const toast = useAppToast();
  const { data: me } = useMe();
  const permissions = usePermissions();
  const canRead = usePermission("client:read");
  const canCreate = usePermission("client:create");

  const [filters, setFilters] = useState<ClientListFilters>(EMPTY_CLIENT_FILTERS);
  const [ownerLabel, setOwnerLabel] = useState("");
  const [sort, setSort] = useState<ClientSort>(DEFAULT_CLIENT_SORT);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ClientOut | null>(null);
  const [archiving, setArchiving] = useState<ClientOut | null>(null);
  const deferredFilters = useDeferredValue(filters);

  const list = useQuery({
    queryKey: clientKeys.list(deferredFilters, sort, page, DEFAULT_PAGE_SIZE),
    queryFn: ({ signal }) => clientsApi.list(deferredFilters, sort, page, DEFAULT_PAGE_SIZE, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
  const archive = useArchiveClient();

  if (!canRead) return <NoAccess what="clients" />;

  const updateFilters = (patch: Partial<ClientListFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const columns: TableColumnDefinition<ClientOut>[] = [
    createTableColumn({
      columnId: "name",
      compare: serverSorted,
      renderHeaderCell: () => "Name",
      renderCell: (c) => (
        <TableCellLayout>
          <div className={styles.cellStack}>
            <AppLink href={`/clients/${c.id}`} className={styles.truncate}>
              {c.name}
            </AppLink>
            {c.industry && (
              <Text size={200} className={mergeClasses(styles.muted, styles.truncate)}>
                {c.industry}
              </Text>
            )}
          </div>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "status",
      compare: serverSorted,
      renderHeaderCell: () => "Status",
      renderCell: (c) => <ClientStatusBadge client={c} />,
    }),
    createTableColumn({
      columnId: "owner",
      renderHeaderCell: () => "Owner",
      renderCell: (c) =>
        c.owner ? (
          <TableCellLayout truncate media={<Avatar name={c.owner.name} size={24} color="colorful" aria-hidden />}>
            {c.owner.name}
          </TableCellLayout>
        ) : (
          "—"
        ),
    }),
    createTableColumn({
      columnId: "locations",
      renderHeaderCell: () => "Locations",
      renderCell: (c) => <TableCellLayout truncate>{formatLocations(c.locations, 2)}</TableCellLayout>,
    }),
    createTableColumn({
      columnId: "updated_at",
      compare: serverSorted,
      renderHeaderCell: () => "Last updated",
      renderCell: (c) => formatDateTime(c.updated_at),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (c) => (
        <RowActions
          label={c.name}
          actions={[
            { label: "Open", icon: <Open20Regular />, onClick: () => router.push(`/clients/${c.id}`) },
            ...(canActOnOwned(permissions, "client:update", c.owner_id, me?.user.id) && !c.archived_at
              ? [{ label: "Edit", icon: <Edit20Regular />, onClick: () => setEditing(c) }]
              : []),
            ...(canActOnOwned(permissions, "client:delete", c.owner_id, me?.user.id)
              ? [
                  c.archived_at
                    ? {
                        label: "Restore",
                        icon: <ArchiveArrowBack20Regular />,
                        onClick: () => archive.mutateAsync(c).catch((e) => toast.error(archive.message(e))),
                      }
                    : { label: "Archive", icon: <Archive20Regular />, onClick: () => setArchiving(c) },
                ]
              : []),
          ]}
        />
      ),
    }),
  ];

  const items = list.data?.items;
  const filtered = hasClientFilters(filters);

  return (
    <>
      <PageHeader title="Clients" subtitle="Accounts you work with, their contacts and the history of every interaction." />
      <div className={styles.toolbar}>
        {canCreate && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New client
          </Button>
        )}
        <SearchBox
          className={styles.search}
          placeholder="Search by name or industry"
          aria-label="Search clients"
          value={filters.q}
          maxLength={200}
          onChange={(_, d) => updateFilters({ q: d.value })}
        />
        <Field label="Status" className={styles.filter}>
          <Dropdown
            value={filters.status ? CLIENT_STATUS_LABELS[filters.status] : "All"}
            selectedOptions={[filters.status ?? ALL]}
            onOptionSelect={(_, d) =>
              updateFilters({ status: d.optionValue === ALL || !d.optionValue ? null : (d.optionValue as ClientStatus) })
            }
          >
            <Option value={ALL}>All</Option>
            {CLIENT_STATUSES.map((s) => (
              <Option key={s} value={s}>
                {CLIENT_STATUS_LABELS[s]}
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
            updateFilters({ ownerId: p?.id ?? null });
          }}
        />
        {me && (
          <Button
            appearance={filters.ownerId === me.user.id ? "primary" : "secondary"}
            onClick={() => {
              const mine = filters.ownerId !== me.user.id;
              setOwnerLabel(mine ? me.user.name || me.user.email : "");
              updateFilters({ ownerId: mine ? me.user.id : null });
            }}
            aria-pressed={filters.ownerId === me.user.id}
          >
            My clients
          </Button>
        )}
        <Switch
          label="Show archived"
          checked={filters.includeArchived}
          onChange={(_, d) => updateFilters({ includeArchived: d.checked })}
        />
        {filtered && (
          <Button
            appearance="subtle"
            onClick={() => {
              setOwnerLabel("");
              updateFilters(EMPTY_CLIENT_FILTERS);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {list.error && !items ? (
        <ErrorBar title="Could not load clients." message={errorMessage(list.error)} />
      ) : (
        <div className={styles.surface}>
          {list.isPending && !items ? (
            <GridSkeleton />
          ) : (
            <>
              <DataGrid
                items={items ?? []}
                columns={columns}
                getRowId={(c) => c.id}
                aria-label="Clients"
                className={styles.grid}
                sortable
                sortState={{ sortColumn: sort.field, sortDirection: sort.direction }}
                onSortChange={(_, s) => {
                  if (isClientSortField(s.sortColumn)) {
                    setSort({ field: s.sortColumn, direction: s.sortDirection });
                    setPage(1);
                  }
                }}
                resizableColumns
                columnSizingOptions={{
                  name: { minWidth: 200, idealWidth: 260 },
                  status: { minWidth: 100, idealWidth: 110 },
                  owner: { minWidth: 140, idealWidth: 180 },
                  locations: { minWidth: 160, idealWidth: 220 },
                  updated_at: { minWidth: 150, idealWidth: 170 },
                  actions: { minWidth: 56, idealWidth: 64 },
                }}
                focusMode="composite"
              >
                <DataGridHeader>
                  <DataGridRow>
                    {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
                  </DataGridRow>
                </DataGridHeader>
                <DataGridBody<ClientOut>>
                  {({ item, rowId }) => (
                    <DataGridRow<ClientOut> key={rowId}>
                      {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                    </DataGridRow>
                  )}
                </DataGridBody>
              </DataGrid>
              {items && items.length === 0 && (
                <div className={styles.empty}>
                  {filtered ? "No clients match these filters." : "No clients yet. Create the first one with New client."}
                </div>
              )}
            </>
          )}
          {list.data && (
            <PagingBar
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={list.data.total}
              onPageChange={setPage}
              busy={list.isFetching}
            />
          )}
        </div>
      )}

      {creating && <ClientDrawer onClose={() => setCreating(false)} onSaved={(c) => router.push(`/clients/${c.id}`)} />}
      {editing && <ClientDrawer key={editing.id} client={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!archiving}
        title="Archive client?"
        confirmLabel="Archive"
        onClose={() => setArchiving(null)}
        onConfirm={() =>
          archive.mutateAsync(archiving!).catch((e) => {
            toast.error(archive.message(e));
            throw e;
          })
        }
      >
        {archiving && `${archiving.name} will be hidden from the client list and cannot receive new demands. You can restore it later.`}
      </ConfirmDialog>
    </>
  );
}
