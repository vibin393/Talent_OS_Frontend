"use client";

import {
  Avatar,
  Badge,
  Button,
  Caption1,
  CounterBadge,
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
  Link,
  SearchBox,
  Spinner,
  Switch,
  TableCellLayout,
  type TableColumnDefinition,
  type DataGridProps,
  type TableRowId,
  Text,
  Toolbar,
  ToolbarButton,
  ToolbarDivider, mergeClasses } from "@fluentui/react-components";
import {
  Add20Regular,
  DocumentArrowUp20Regular,
  FolderZip20Regular,
  ListBar20Regular,
  MailArrowUp20Regular,
  PeopleSwap20Regular,
  PersonSearch20Regular,
  Tag20Regular,
} from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { ErrorBar, formatDateTime, GridSkeleton, IdSelect, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { UserPicker } from "@/features/admin/user-picker";
import { usePermission } from "@/features/auth/use-permission";
import { ExportMenu } from "@/features/exports/export-menu";
import { useCanExport } from "@/features/exports/use-export";
import { AiConsentBadge, SendConsentRequestDialog } from "@/features/privacy/consent-request";
import { useDebounced } from "@/lib/use-debounced";
import type { CandidateOut, TagOut } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { CandidateFormDrawer } from "./candidate-form-drawer";
import { candidateErrorMessage } from "./errors";
import { formatLocation, SOURCE_LABELS, SOURCES } from "./format";
import {
  candidateExportFilters,
  type CandidateListFilters,
  EMPTY_CANDIDATE_FILTERS,
  fromApiSort,
  hasActiveCandidateFilters,
  isSortableColumn,
  toApiSort,
} from "./query";
import { TagFilter, TagNamesPicker } from "./tags-picker";
import { useCandidateMutation, useOpenDuplicateCount, useSavedListLookup } from "./use-candidates";

type SortState = NonNullable<DataGridProps["sortState"]>;

/** Server-sorted columns: keep the API order on the client. */
function serverOrder(a: unknown, b: unknown): number {
  void a;
  void b;
  return 0;
}
const text = (v: string | null | undefined) => (v ?? "").toLocaleLowerCase();

export function CandidatesView() {
  const styles = useAdminStyles();
  const router = useRouter();
  const canRead = usePermission("candidate:read");
  const canCreate = usePermission("candidate:create");
  const canUpdate = usePermission("candidate:update");
  const canSendConsent = usePermission("consent:write");
  const canReadUsers = usePermission("user:read");

  const [filters, setFilters] = useState<CandidateListFilters>(EMPTY_CANDIDATE_FILTERS);
  const [search, setSearch] = useState("");
  const q = useDebounced(search, 300);
  const [ownerLabel, setOwnerLabel] = useState("");
  const [tag, setTag] = useState<TagOut | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<TableRowId>>(new Set());
  const [sortState, setSortState] = useState<SortState>(() => fromApiSort(EMPTY_CANDIDATE_FILTERS.sort));
  const [creating, setCreating] = useState(false);
  const [bulk, setBulk] = useState<"tags" | "list" | "consent" | null>(null);

  const effective = { ...filters, q };
  const canExport = useCanExport("candidates");
  const list = useQuery({
    queryKey: candidateKeys.list(effective, page, DEFAULT_PAGE_SIZE),
    queryFn: ({ signal }) => candidatesApi.list(effective, page, DEFAULT_PAGE_SIZE, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
  const lists = useSavedListLookup(canRead);
  const dupes = useOpenDuplicateCount(canRead);

  if (!canRead) return <NoAccess what="candidates" />;

  const update = (patch: Partial<CandidateListFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
    setSelected(new Set());
  };

  const columns: TableColumnDefinition<CandidateOut>[] = [
    createTableColumn<CandidateOut>({
      columnId: "name",
      compare: serverOrder,
      renderHeaderCell: () => "Name",
      renderCell: (c) => (
        <TableCellLayout media={<Avatar name={c.full_name} size={32} color="colorful" aria-hidden />}>
          <div className={styles.cellStack}>
            <AppLink href={`/candidates/${c.id}`} className={styles.truncate}>
              {c.full_name}
            </AppLink>
            <Caption1 className={mergeClasses(styles.muted, styles.truncate)}>
              {c.human_id}
              {c.primary_email ? ` · ${c.primary_email}` : ""}
            </Caption1>
          </div>
          {c.archived_at && (
            <Badge appearance="tint" color="subtle" size="small">
              Archived
            </Badge>
          )}
          <AiConsentBadge state={c.ai_consent_state} />
        </TableCellLayout>
      ),
    }),
    createTableColumn<CandidateOut>({
      columnId: "title",
      compare: (a, b) => text(a.current_title).localeCompare(text(b.current_title)),
      renderHeaderCell: () => "Title",
      renderCell: (c) => <TableCellLayout truncate>{c.current_title ?? "—"}</TableCellLayout>,
    }),
    createTableColumn<CandidateOut>({
      columnId: "employer",
      compare: (a, b) => text(a.current_employer).localeCompare(text(b.current_employer)),
      renderHeaderCell: () => "Employer",
      renderCell: (c) => <TableCellLayout truncate>{c.current_employer ?? "—"}</TableCellLayout>,
    }),
    createTableColumn<CandidateOut>({
      columnId: "location",
      compare: (a, b) => text(formatLocation(a.location)).localeCompare(text(formatLocation(b.location))),
      renderHeaderCell: () => "Location",
      renderCell: (c) => <TableCellLayout truncate>{formatLocation(c.location)}</TableCellLayout>,
    }),
    createTableColumn<CandidateOut>({
      columnId: "owner",
      compare: (a, b) => text(a.owner_name).localeCompare(text(b.owner_name)),
      renderHeaderCell: () => "Owner",
      renderCell: (c) => (
        <TableCellLayout truncate media={<Avatar name={c.owner_name ?? undefined} size={20} aria-hidden />}>
          {c.owner_name ?? "—"}
        </TableCellLayout>
      ),
    }),
    createTableColumn<CandidateOut>({
      columnId: "updated",
      compare: serverOrder,
      renderHeaderCell: () => "Updated",
      renderCell: (c) => formatDateTime(c.updated_at),
    }),
  ];

  const selectedIds = [...selected].map(String);
  const items = list.data?.items;
  const listOptions = (lists.data?.items ?? []).map((l) => ({ id: l.id, label: l.name }));

  return (
    <>
      <PageHeader title="Candidates" subtitle="Search, create and organize candidate profiles." />
      <Toolbar aria-label="Candidate actions" style={{ flexWrap: "wrap", marginBottom: 8, paddingInline: 0 }}>
        {canCreate && (
          <>
            <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
              New candidate
            </Button>
            <ToolbarButton icon={<DocumentArrowUp20Regular />} onClick={() => router.push("/candidates/new?from=resume")}>
              From resume
            </ToolbarButton>
            <ToolbarButton icon={<FolderZip20Regular />} onClick={() => router.push("/candidates/imports")}>
              Import
            </ToolbarButton>
          </>
        )}
        <ToolbarButton icon={<PersonSearch20Regular />} onClick={() => router.push("/candidates/search")}>
          Advanced search
        </ToolbarButton>
        <ToolbarButton icon={<PeopleSwap20Regular />} onClick={() => router.push("/candidates/duplicates")}>
          Duplicates{" "}
          {dupes.data !== undefined && (
            <CounterBadge count={dupes.data} showZero size="small" color={dupes.data ? "danger" : "informative"} style={{ marginLeft: 4 }} />
          )}
        </ToolbarButton>
        <ToolbarButton icon={<ListBar20Regular />} onClick={() => router.push("/candidates/lists")}>
          Saved lists
        </ToolbarButton>
        {selectedIds.length > 0 && (
          <>
            <ToolbarDivider />
            <Text size={200}>{selectedIds.length} selected</Text>
            {canUpdate && (
              <ToolbarButton icon={<Tag20Regular />} onClick={() => setBulk("tags")}>
                Add tags
              </ToolbarButton>
            )}
            <ToolbarButton icon={<ListBar20Regular />} onClick={() => setBulk("list")}>
              Add to list
            </ToolbarButton>
            {canSendConsent && (
              <ToolbarButton icon={<MailArrowUp20Regular />} onClick={() => setBulk("consent")}>
                Send consent request
              </ToolbarButton>
            )}
          </>
        )}
        {canExport && (
          <>
            <ToolbarDivider />
            <ExportMenu kind="candidates" filters={candidateExportFilters(effective)} />
          </>
        )}
      </Toolbar>

      <div className={styles.toolbar}>
        <Field label="Search" className={styles.search}>
          <SearchBox
            placeholder="Name, CAN id, email, title or employer"
            value={search}
            maxLength={200}
            onChange={(_, d) => {
              setSearch(d.value);
              setPage(1);
            }}
          />
        </Field>
        {canReadUsers && (
          <UserPicker
            className={styles.filter}
            label="Owner"
            value={filters.ownerId}
            valueLabel={ownerLabel}
            clearLabel="Anyone"
            placeholder="Anyone"
            onChange={(id, user) => {
              setOwnerLabel(user ? user.name || user.email : "");
              update({ ownerId: id });
            }}
          />
        )}
        <TagFilter
          className={styles.filter}
          value={tag}
          onChange={(t) => {
            setTag(t);
            update({ tagId: t?.id ?? null });
          }}
        />
        <IdSelect
          className={styles.filter}
          label="Source"
          noneLabel="Any source"
          options={SOURCES.map((s) => ({ id: s, label: SOURCE_LABELS[s] }))}
          value={filters.source}
          onChange={(v) => update({ source: (v as CandidateListFilters["source"]) ?? null })}
        />
        <IdSelect
          className={styles.filter}
          label="Saved list"
          noneLabel="Any list"
          options={listOptions}
          value={filters.listId}
          onChange={(v) => update({ listId: v })}
        />
        <Switch
          label="Show archived"
          checked={filters.includeArchived}
          onChange={(_, d) => update({ includeArchived: d.checked })}
        />
        {(hasActiveCandidateFilters(effective) || search) && (
          <Button
            appearance="subtle"
            onClick={() => {
              setSearch("");
              setTag(null);
              setOwnerLabel("");
              update({ ...EMPTY_CANDIDATE_FILTERS, sort: filters.sort });
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {list.error && !items ? (
        <ErrorBar title="Could not load candidates." message={candidateErrorMessage(list.error)} />
      ) : (
        <div className={styles.surface}>
          {list.isPending && !items ? (
            <GridSkeleton />
          ) : (
            <DataGrid
              items={items ?? []}
              columns={columns}
              getRowId={(c) => c.id}
              aria-label="Candidates"
              className={styles.grid}
              sortable
              sortState={sortState}
              onSortChange={(_, state) => {
                setSortState(state);
                const col = String(state.sortColumn ?? "");
                if (isSortableColumn(col)) update({ sort: toApiSort(col, state.sortDirection, filters.sort) });
              }}
              selectionMode="multiselect"
              selectedItems={selected}
              onSelectionChange={(_, d) => setSelected(new Set(d.selectedItems))}
              resizableColumns
              columnSizingOptions={{ name: { minWidth: 220, idealWidth: 280 }, updated: { minWidth: 150 } }}
            >
              <DataGridHeader>
                <DataGridRow selectionCell={{ checkboxIndicator: { "aria-label": "Select all rows" } }}>
                  {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
                </DataGridRow>
              </DataGridHeader>
              <DataGridBody<CandidateOut>>
                {({ item, rowId }) => (
                  <DataGridRow<CandidateOut> key={rowId} selectionCell={{ checkboxIndicator: { "aria-label": `Select ${item.full_name}` } }}>
                    {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                  </DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
          )}
          {items && items.length === 0 && (
            <div className={styles.empty}>
              {hasActiveCandidateFilters(effective) ? "No candidates match these filters." : "No candidates yet."}
            </div>
          )}
          {list.data && (
            <PagingBar
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={list.data.total}
              onPageChange={(p) => {
                setPage(p);
                setSelected(new Set());
              }}
              busy={list.isFetching}
            />
          )}
        </div>
      )}
      <Caption1 className={styles.muted}>
        Name and Updated sort the whole list; Title, Employer, Location and Owner sort the current page.
      </Caption1>

      {creating && <CandidateFormDrawer onClose={() => setCreating(false)} />}
      {bulk === "tags" && (
        <BulkTagsDialog candidateIds={selectedIds} onClose={() => setBulk(null)} onDone={() => setSelected(new Set())} />
      )}
      <SendConsentRequestDialog
        open={bulk === "consent"}
        candidateIds={selectedIds}
        onClose={() => setBulk(null)}
        onDone={() => setSelected(new Set())}
      />
      {bulk === "list" && (
        <AddToListDialog
          candidateIds={selectedIds}
          lists={listOptions}
          onClose={() => setBulk(null)}
          onDone={() => setSelected(new Set())}
        />
      )}
    </>
  );
}

function BulkTagsDialog({
  candidateIds,
  onClose,
  onDone,
}: {
  candidateIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const save = useCandidateMutation({
    mutationFn: () => candidatesApi.bulkTags(candidateIds, names),
    invalidate: [candidateKeys.all, ["tags"]],
    success: (r) => `Tagged ${r.updated} candidate${r.updated === 1 ? "" : "s"}`,
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !save.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Add tags to {candidateIds.length} candidates</DialogTitle>
          <DialogContent>
            <ErrorBar message={error} />
            <TagNamesPicker label="Tags" value={names} onChange={setNames} hint="New tags are created automatically." />
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={names.length === 0 || save.isPending}
              icon={save.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={async () => {
                setError(null);
                try {
                  await save.mutateAsync(undefined);
                  onDone();
                  onClose();
                } catch (e) {
                  setError(candidateErrorMessage(e));
                }
              }}
            >
              Add tags
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export function AddToListDialog({
  candidateIds,
  lists,
  onClose,
  onDone,
}: {
  candidateIds: string[];
  lists: { id: string; label: string }[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useAppToast();
  const [listId, setListId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useCandidateMutation({
    mutationFn: (id: string) => candidatesApi.addListMembers(id, candidateIds),
    invalidate: [candidateKeys.savedLists, candidateKeys.all],
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !save.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            Add {candidateIds.length} candidate{candidateIds.length === 1 ? "" : "s"} to a list
          </DialogTitle>
          <DialogContent>
            <ErrorBar message={error} />
            {lists.length === 0 ? (
              <Text>
                You have no saved lists yet. <Link href="/candidates/lists">Create one</Link> first.
              </Text>
            ) : (
              <IdSelect label="Saved list" options={lists} value={listId} onChange={setListId} />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!listId || save.isPending}
              icon={save.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={async () => {
                if (!listId) return;
                setError(null);
                try {
                  const l = await save.mutateAsync(listId);
                  toast.success(`Added to ${l.name}`);
                  onDone?.();
                  onClose();
                } catch (e) {
                  setError(candidateErrorMessage(e));
                }
              }}
            >
              Add to list
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
