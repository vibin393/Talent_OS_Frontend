"use client";

import {
  Badge,
  Button,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Spinner,
  type TableColumnDefinition,
  Textarea, mergeClasses } from "@fluentui/react-components";
import { Add20Regular, Delete20Regular, Edit20Regular, Share20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { ConfirmDialog, ErrorBar, formatDateTime, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { isApiError } from "@/lib/api/errors";
import type { CandidateListOut } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { candidateErrorMessage } from "./errors";
import { ShareListDialog } from "./list-share-dialog";
import { useCandidateMutation } from "./use-candidates";

/** Saved candidate lists: create, rename, share, delete. */
export function ListsView() {
  const styles = useAdminStyles();
  const canRead = usePermission("candidate:read");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<CandidateListOut | "new" | null>(null);
  const [sharing, setSharing] = useState<CandidateListOut | null>(null);
  const [deleting, setDeleting] = useState<CandidateListOut | null>(null);
  const lists = useQuery({
    queryKey: candidateKeys.savedListPage(page, DEFAULT_PAGE_SIZE),
    queryFn: ({ signal }) => candidatesApi.listLists(page, DEFAULT_PAGE_SIZE, false, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
  const remove = useCandidateMutation({
    mutationFn: (l: CandidateListOut) => candidatesApi.deleteList(l.id),
    invalidate: [candidateKeys.savedLists],
    success: (l) => `Deleted ${l.name}`,
    toastErrors: true,
  });

  if (!canRead) return <NoAccess what="saved lists" />;

  const columns: TableColumnDefinition<CandidateListOut>[] = [
    createTableColumn<CandidateListOut>({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (l) => (
        <div className={styles.cellStack}>
          <AppLink href={`/candidates/lists/${l.id}`} className={styles.truncate}>
            {l.name}
          </AppLink>
          {l.description && <span className={mergeClasses(styles.muted, styles.truncate)}>{l.description}</span>}
        </div>
      ),
    }),
    createTableColumn<CandidateListOut>({
      columnId: "members",
      renderHeaderCell: () => "Candidates",
      renderCell: (l) => l.member_count,
    }),
    createTableColumn<CandidateListOut>({
      columnId: "access",
      renderHeaderCell: () => "Access",
      renderCell: (l) => (
        <div className={styles.badges}>
          <Badge appearance="tint" color={l.is_owner ? "brand" : "informative"}>
            {l.is_owner ? "Owner" : "Shared with you"}
          </Badge>
          {l.is_owner && l.shared_user_ids.length + l.shared_team_ids.length > 0 && (
            <Badge appearance="outline">
              Shared with {l.shared_user_ids.length} people, {l.shared_team_ids.length} teams
            </Badge>
          )}
        </div>
      ),
    }),
    createTableColumn<CandidateListOut>({
      columnId: "updated",
      renderHeaderCell: () => "Updated",
      renderCell: (l) => formatDateTime(l.updated_at),
    }),
    createTableColumn<CandidateListOut>({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (l) => (
        <RowActions
          label={l.name}
          actions={
            l.is_owner
              ? [
                  { label: "Rename", icon: <Edit20Regular />, onClick: () => setEditing(l) },
                  { label: "Share", icon: <Share20Regular />, onClick: () => setSharing(l) },
                  { label: "Delete", icon: <Delete20Regular />, onClick: () => setDeleting(l) },
                ]
              : []
          }
        />
      ),
    }),
  ];

  return (
    <>
      <PageHeader
        title="Saved lists"
        subtitle={
          <>
            Group candidates into lists and share them with colleagues or teams. <AppLink href="/candidates">Back to candidates</AppLink>
          </>
        }
      />
      <div className={styles.toolbar}>
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
          New list
        </Button>
      </div>
      <AdminGrid
        label="Saved lists"
        items={lists.data?.items}
        columns={columns}
        getRowId={(l) => l.id}
        loading={lists.isPending}
        error={lists.error}
        emptyText="No saved lists yet."
        columnSizing={{ name: { minWidth: 220, idealWidth: 300 }, access: { minWidth: 200 }, actions: { minWidth: 56, idealWidth: 56 } }}
        footer={
          lists.data && (
            <PagingBar page={page} pageSize={DEFAULT_PAGE_SIZE} total={lists.data.total} onPageChange={setPage} busy={lists.isFetching} />
          )
        }
      />
      {editing && <ListDialog list={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {sharing && <ShareListDialog list={sharing} onClose={() => setSharing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Delete list?"
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutateAsync(deleting!)}
      >
        {deleting && `${deleting.name} will be removed for everyone it is shared with. The candidates themselves are not affected.`}
      </ConfirmDialog>
    </>
  );
}

/** Create or rename a saved list. */
export function ListDialog({ list, onClose }: { list: CandidateListOut | null; onClose: () => void }) {
  const [name, setName] = useState(list?.name ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const save = useCandidateMutation({
    mutationFn: () => {
      const body = { name: name.trim(), description: description.trim() || null };
      return list ? candidatesApi.updateList(list.id, body) : candidatesApi.createList(body);
    },
    invalidate: [candidateKeys.savedLists],
    success: (l) => (list ? `Saved ${l.name}` : `Created ${l.name}`),
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !save.isPending && onClose()}>
      <DialogSurface>
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) {
              setNameError("Enter a name.");
              return;
            }
            setNameError(null);
            setError(null);
            try {
              await save.mutateAsync(undefined);
              onClose();
            } catch (err) {
              const field = isApiError(err) && Array.isArray(err.details.fields) ? (err.details.fields[0] as { message?: string }) : null;
              if (field?.message) setNameError(field.message);
              else setError(candidateErrorMessage(err));
            }
          }}
        >
          <DialogBody>
            <DialogTitle>{list ? "Rename list" : "New list"}</DialogTitle>
            <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ErrorBar message={error} />
              <Field label="Name" required validationState={nameError ? "error" : "none"} validationMessage={nameError}>
                <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
              </Field>
              <Field label="Description">
                <Textarea value={description} maxLength={2000} onChange={(_, d) => setDescription(d.value)} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose} disabled={save.isPending}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                type="submit"
                disabled={save.isPending}
                icon={save.isPending ? <Spinner size="tiny" /> : undefined}
              >
                {list ? "Save" : "Create"}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
