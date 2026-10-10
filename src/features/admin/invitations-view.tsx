"use client";

import { Badge, createTableColumn, TableCellLayout, type TableColumnDefinition, Text } from "@fluentui/react-components";
import { ArrowClockwise20Regular, Dismiss20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { usePermission } from "@/features/auth/use-permission";
import type { InvitationAdminOut } from "@/lib/api/types";
import { adminApi, adminKeys } from "./api";
import { AdminGrid, RowActions } from "./admin-grid";
import { adminErrorMessage } from "./errors";
import { DEFAULT_PAGE_SIZE } from "./query";
import { ConfirmDialog, formatDateTime, NoAccess, PagingBar, useAdminStyles } from "./ui";
import { useAdminMutation, useRoles } from "./use-admin-data";

export function InvitationsView() {
  const styles = useAdminStyles();
  const toast = useAppToast();
  const canRead = usePermission("user:read");
  const canManage = usePermission("user:manage");
  const canReadRoles = usePermission("role:read");
  const [page, setPage] = useState(1);
  const [revoking, setRevoking] = useState<InvitationAdminOut | null>(null);

  const list = useQuery({
    queryKey: adminKeys.invitationList(page, DEFAULT_PAGE_SIZE),
    queryFn: ({ signal }) => adminApi.listInvitations(page, DEFAULT_PAGE_SIZE, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
  const roles = useRoles(canRead && canReadRoles);
  const roleNames = new Map((roles.data ?? []).map((r) => [r.id, r.name]));

  const resend = useAdminMutation({
    mutationFn: (inv: InvitationAdminOut) => adminApi.resendInvitation(inv.id),
    invalidate: [adminKeys.invitations],
    success: (_, inv) => `Invitation resent to ${inv.email}`,
    toastErrors: true,
  });
  const revoke = useAdminMutation({
    mutationFn: (inv: InvitationAdminOut) => adminApi.revokeInvitation(inv.id),
    invalidate: [adminKeys.invitations],
    success: (_, inv) => `Invitation for ${inv.email} revoked`,
  });

  if (!canRead) return <NoAccess what="invitations" />;

  const columns: TableColumnDefinition<InvitationAdminOut>[] = [
    createTableColumn({
      columnId: "email",
      renderHeaderCell: () => "Invitee",
      renderCell: (inv) => (
        <TableCellLayout>
          <div className={styles.cellStack}>
            <Text className={styles.truncate}>{inv.name || inv.email}</Text>
            {inv.name && (
              <Text size={200} className={styles.muted}>
                {inv.email}
              </Text>
            )}
          </div>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "roles",
      renderHeaderCell: () => "Roles",
      renderCell: (inv) => (
        <div className={styles.badges}>
          {inv.role_ids.map((id) => (
            <Badge key={id} appearance="tint" color="informative">
              {roleNames.get(id) ?? "Role"}
            </Badge>
          ))}
        </div>
      ),
    }),
    createTableColumn({
      columnId: "sent",
      renderHeaderCell: () => "Sent",
      renderCell: (inv) => formatDateTime(inv.created_at),
    }),
    createTableColumn({
      columnId: "expires",
      renderHeaderCell: () => "Expires",
      renderCell: (inv) =>
        inv.expired ? (
          <Badge appearance="tint" color="warning">
            Expired
          </Badge>
        ) : (
          formatDateTime(inv.expires_at)
        ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (inv) => (
        <RowActions
          label={inv.email}
          actions={
            canManage
              ? [
                  {
                    label: "Resend",
                    icon: <ArrowClockwise20Regular />,
                    disabled: resend.isPending,
                    onClick: () => resend.mutate(inv),
                  },
                  { label: "Revoke", icon: <Dismiss20Regular />, onClick: () => setRevoking(inv) },
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
        title="Pending invitations"
        subtitle="Invitations that have not been accepted yet. Resending issues a new link and invalidates the old one."
      />
      <AdminGrid
        label="Pending invitations"
        items={list.data?.items}
        columns={columns}
        getRowId={(inv) => inv.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No pending invitations."
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
      <ConfirmDialog
        open={!!revoking}
        title="Revoke invitation?"
        confirmLabel="Revoke"
        onClose={() => setRevoking(null)}
        onConfirm={() =>
          revoke.mutateAsync(revoking!).catch((e) => {
            toast.error(adminErrorMessage(e));
            throw e;
          })
        }
      >
        {revoking && `The invitation link sent to ${revoking.email} will stop working.`}
      </ConfirmDialog>
    </>
  );
}
