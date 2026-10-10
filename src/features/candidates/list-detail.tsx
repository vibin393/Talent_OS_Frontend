"use client";

import {
  Avatar,
  Button,
  Caption1,
  createTableColumn,
  TableCellLayout,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { Dismiss20Regular, Edit20Regular, Share20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { CandidateOut } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { candidateErrorMessage } from "./errors";
import { formatLocation, formatRole } from "./format";
import { ListDialog } from "./lists-view";
import { ShareListDialog } from "./list-share-dialog";
import { EMPTY_CANDIDATE_FILTERS } from "./query";
import { useCandidateMutation } from "./use-candidates";

/** One saved list: members grid (via `GET /candidates?list_id=`) with remove; owner can rename and share. */
export function ListDetail({ id }: { id: string }) {
  const styles = useAdminStyles();
  const canRead = usePermission("candidate:read");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [removing, setRemoving] = useState<CandidateOut | null>(null);

  const list = useQuery({
    queryKey: candidateKeys.savedList(id),
    queryFn: ({ signal }) => candidatesApi.getList(id, signal),
    enabled: canRead,
  });
  const filters = { ...EMPTY_CANDIDATE_FILTERS, listId: id, sort: "name" as const };
  const members = useQuery({
    queryKey: candidateKeys.list(filters, page, DEFAULT_PAGE_SIZE),
    queryFn: ({ signal }) => candidatesApi.list(filters, page, DEFAULT_PAGE_SIZE, signal),
    enabled: canRead && list.isSuccess,
    placeholderData: (prev) => prev,
  });
  const remove = useCandidateMutation({
    mutationFn: (c: CandidateOut) => candidatesApi.removeListMember(id, c.id),
    invalidate: [candidateKeys.savedLists, candidateKeys.lists],
    success: (_, c) => `Removed ${c.full_name} from the list`,
    toastErrors: true,
  });

  if (!canRead) return <NoAccess what="saved lists" />;
  if (list.isPending) return <GridSkeleton />;
  if (list.isError) return <ErrorBar title="Could not load the list." message={candidateErrorMessage(list.error)} />;
  const l = list.data;

  const columns: TableColumnDefinition<CandidateOut>[] = [
    createTableColumn<CandidateOut>({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (c) => (
        <TableCellLayout media={<Avatar name={c.full_name} size={32} color="colorful" aria-hidden />}>
          <div className={styles.cellStack}>
            <AppLink href={`/candidates/${c.id}`}>{c.full_name}</AppLink>
            <Caption1 className={styles.muted}>{c.human_id}</Caption1>
          </div>
        </TableCellLayout>
      ),
    }),
    createTableColumn<CandidateOut>({
      columnId: "role",
      renderHeaderCell: () => "Current role",
      renderCell: (c) => <TableCellLayout truncate>{formatRole(c.current_title, c.current_employer)}</TableCellLayout>,
    }),
    createTableColumn<CandidateOut>({
      columnId: "location",
      renderHeaderCell: () => "Location",
      renderCell: (c) => formatLocation(c.location),
    }),
    createTableColumn<CandidateOut>({
      columnId: "owner",
      renderHeaderCell: () => "Owner",
      renderCell: (c) => c.owner_name ?? "—",
    }),
    createTableColumn<CandidateOut>({
      columnId: "remove",
      renderHeaderCell: () => "Remove",
      renderCell: (c) => (
        <Button
          appearance="subtle"
          icon={<Dismiss20Regular />}
          aria-label={`Remove ${c.full_name} from the list`}
          onClick={() => setRemoving(c)}
        />
      ),
    }),
  ];

  return (
    <>
      <PageHeader
        title={l.name}
        subtitle={
          <>
            {l.description ? `${l.description} · ` : ""}
            {l.member_count} candidate{l.member_count === 1 ? "" : "s"} · updated {formatDateTime(l.updated_at)} ·{" "}
            <AppLink href="/candidates/lists">All lists</AppLink>
          </>
        }
      />
      {l.is_owner && (
        <div className={styles.toolbar}>
          <Button icon={<Edit20Regular />} onClick={() => setEditing(true)}>
            Rename
          </Button>
          <Button icon={<Share20Regular />} onClick={() => setSharing(true)}>
            Share
          </Button>
        </div>
      )}
      <AdminGrid
        label={`Candidates in ${l.name}`}
        items={members.data?.items}
        columns={columns}
        getRowId={(c) => c.id}
        loading={members.isPending}
        error={members.error}
        emptyText="This list is empty. Add candidates from the candidates list (select rows, then Add to list)."
        columnSizing={{ name: { minWidth: 220, idealWidth: 280 }, remove: { minWidth: 64, idealWidth: 64 } }}
        footer={
          members.data && (
            <PagingBar page={page} pageSize={DEFAULT_PAGE_SIZE} total={members.data.total} onPageChange={setPage} busy={members.isFetching} />
          )
        }
      />
      {editing && <ListDialog list={l} onClose={() => setEditing(false)} />}
      {sharing && <ShareListDialog list={l} onClose={() => setSharing(false)} />}
      <ConfirmDialog
        open={!!removing}
        title="Remove from list?"
        confirmLabel="Remove"
        onClose={() => setRemoving(null)}
        onConfirm={() => remove.mutateAsync(removing!)}
      >
        {removing && `${removing.full_name} will be removed from ${l.name}. The candidate profile is not affected.`}
      </ConfirmDialog>
    </>
  );
}
