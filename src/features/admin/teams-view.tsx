"use client";

import {
  Button,
  createTableColumn,
  Link,
  TableCellLayout,
  type TableColumnDefinition,
  Text, mergeClasses } from "@fluentui/react-components";
import { Add20Regular, Delete20Regular, Edit20Regular, Eye20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { usePermission } from "@/features/auth/use-permission";
import type { TeamOut } from "@/lib/api/types";
import { adminApi, adminKeys } from "./api";
import { AdminGrid, RowActions } from "./admin-grid";
import { adminErrorMessage } from "./errors";
import { DEFAULT_PAGE_SIZE } from "./query";
import { TeamDrawer } from "./team-drawer";
import { ConfirmDialog, formatDateTime, NoAccess, PagingBar, useAdminStyles } from "./ui";
import { useAdminMutation, useBusinessUnitLookup } from "./use-admin-data";

export function TeamsView() {
  const styles = useAdminStyles();
  const toast = useAppToast();
  const canRead = usePermission("team:read");
  const canManage = usePermission("team:manage");
  const canReadBUs = usePermission("business_unit:read");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<TeamOut | "new" | null>(null);
  const [deleting, setDeleting] = useState<TeamOut | null>(null);

  const list = useQuery({
    queryKey: adminKeys.teamList(page, DEFAULT_PAGE_SIZE),
    queryFn: ({ signal }) => adminApi.listTeams(page, DEFAULT_PAGE_SIZE, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
  const units = useBusinessUnitLookup(canRead && canReadBUs);
  const unitNames = new Map((units.data?.items ?? []).map((b) => [b.id, b.name]));

  const remove = useAdminMutation({
    mutationFn: (team: TeamOut) => adminApi.deleteTeam(team.id),
    invalidate: [adminKeys.teams, adminKeys.users],
    success: (_, team) => `Deleted ${team.name}`,
  });

  if (!canRead) return <NoAccess what="teams" />;

  const columns: TableColumnDefinition<TeamOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Team",
      renderCell: (t) => (
        <TableCellLayout>
          <div className={styles.cellStack}>
            <Link as="button" onClick={() => setEditing(t)}>
              {t.name}
            </Link>
            {t.description && (
              <Text size={200} className={mergeClasses(styles.muted, styles.truncate)}>
                {t.description}
              </Text>
            )}
          </div>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "bu",
      renderHeaderCell: () => "Business unit",
      renderCell: (t) => (t.business_unit_id ? (unitNames.get(t.business_unit_id) ?? "—") : "—"),
    }),
    createTableColumn({
      columnId: "members",
      renderHeaderCell: () => "Members",
      renderCell: (t) => t.member_count,
    }),
    createTableColumn({
      columnId: "created",
      renderHeaderCell: () => "Created",
      renderCell: (t) => formatDateTime(t.created_at),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (t) => (
        <RowActions
          label={t.name}
          actions={[
            {
              label: canManage ? "Edit" : "View",
              icon: canManage ? <Edit20Regular /> : <Eye20Regular />,
              onClick: () => setEditing(t),
            },
            ...(canManage ? [{ label: "Delete", icon: <Delete20Regular />, onClick: () => setDeleting(t) }] : []),
          ]}
        />
      ),
    }),
  ];

  return (
    <>
      <PageHeader title="Teams" subtitle="Team membership drives team-scoped permissions." />
      <div className={styles.toolbar}>
        {canManage && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
            Add a team
          </Button>
        )}
      </div>
      <AdminGrid
        label="Teams"
        items={list.data?.items}
        columns={columns}
        getRowId={(t) => t.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No teams yet."
        footer={
          list.data && (
            <PagingBar
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={list.data.total}
              onPageChange={setPage}
              busy={list.isFetching}
            />
          )
        }
      />
      {editing && (
        <TeamDrawer
          key={editing === "new" ? "new" : editing.id}
          teamId={editing === "new" ? null : editing.id}
          canManage={canManage}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete team?"
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          remove.mutateAsync(deleting!).catch((e) => {
            toast.error(adminErrorMessage(e));
            throw e;
          })
        }
      >
        {deleting && `"${deleting.name}" will be deleted and its ${deleting.member_count} member(s) removed from it.`}
      </ConfirmDialog>
    </>
  );
}
