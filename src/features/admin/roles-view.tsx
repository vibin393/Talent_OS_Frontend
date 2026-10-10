"use client";

import {
  Badge,
  Button,
  createTableColumn,
  Link,
  TableCellLayout,
  type TableColumnDefinition,
  Text,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular, Edit20Regular, Eye20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { authKeys } from "@/features/auth/api";
import { usePermission } from "@/features/auth/use-permission";
import type { RoleOut } from "@/lib/api/types";
import { adminApi, adminKeys } from "./api";
import { AdminGrid, RowActions } from "./admin-grid";
import { adminErrorMessage } from "./errors";
import { RoleDrawer } from "./role-drawer";
import { ConfirmDialog, NoAccess, useAdminStyles } from "./ui";
import { useAdminMutation, useRoles } from "./use-admin-data";

function RoleTypeBadge({ role }: { role: RoleOut }) {
  if (role.is_immutable) {
    return (
      <Badge appearance="filled" color="brand">
        System · read-only
      </Badge>
    );
  }
  if (role.is_system) {
    return (
      <Badge appearance="tint" color="brand">
        System
      </Badge>
    );
  }
  return (
    <Badge appearance="outline" color="informative">
      Custom
    </Badge>
  );
}

export function RolesView() {
  const styles = useAdminStyles();
  const toast = useAppToast();
  const canRead = usePermission("role:read");
  const canManage = usePermission("role:manage");
  const roles = useRoles(canRead);
  const [editing, setEditing] = useState<RoleOut | "new" | null>(null);
  const [deleting, setDeleting] = useState<RoleOut | null>(null);

  const remove = useAdminMutation({
    mutationFn: (role: RoleOut) => adminApi.deleteRole(role.id),
    invalidate: [adminKeys.roles, adminKeys.users, authKeys.me],
    success: (_, role) => `Deleted ${role.name}`,
  });

  if (!canRead) return <NoAccess what="roles" />;

  const columns: TableColumnDefinition<RoleOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Role",
      renderCell: (r) => (
        <TableCellLayout>
          <div className={styles.cellStack}>
            <Link as="button" onClick={() => setEditing(r)}>
              {r.name}
            </Link>
            <Text size={200} className={styles.muted}>
              {r.key}
            </Text>
          </div>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "type",
      renderHeaderCell: () => "Type",
      renderCell: (r) => <RoleTypeBadge role={r} />,
    }),
    createTableColumn({
      columnId: "description",
      renderHeaderCell: () => "Description",
      renderCell: (r) => (
        <TableCellLayout truncate className={styles.muted}>
          {r.description || "—"}
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "permissions",
      renderHeaderCell: () => "Permissions",
      renderCell: (r) => Object.keys(r.permissions).length,
    }),
    createTableColumn({
      columnId: "users",
      renderHeaderCell: () => "Users",
      renderCell: (r) => r.user_count,
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (r) => {
        const editable = canManage && !r.is_immutable;
        return (
          <RowActions
            label={r.name}
            actions={[
              {
                label: editable ? "Edit" : "View",
                icon: editable ? <Edit20Regular /> : <Eye20Regular />,
                onClick: () => setEditing(r),
              },
              ...(canManage && !r.is_system
                ? [{ label: "Delete", icon: <Delete20Regular />, onClick: () => setDeleting(r) }]
                : []),
            ]}
          />
        );
      },
    }),
  ];

  return (
    <>
      <PageHeader
        title="Roles"
        subtitle="A role grants permissions, each at a scope: own records, team, business unit or the whole organization."
      />
      <div className={styles.toolbar}>
        {canManage && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
            Create custom role
          </Button>
        )}
      </div>
      <AdminGrid
        label="Roles"
        items={roles.data}
        columns={columns}
        getRowId={(r) => r.id}
        loading={roles.isPending}
        error={roles.error}
        emptyText="No roles."
      />
      {editing && (
        <RoleDrawer
          key={editing === "new" ? "new" : editing.id}
          role={editing === "new" ? null : editing}
          canManage={canManage}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete role?"
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          remove.mutateAsync(deleting!).catch((e) => {
            toast.error(adminErrorMessage(e));
            throw e;
          })
        }
      >
        {deleting &&
          (deleting.user_count > 0
            ? `"${deleting.name}" is assigned to ${deleting.user_count} user(s). Remove it from them before deleting it.`
            : `"${deleting.name}" will be deleted permanently.`)}
      </ConfirmDialog>
    </>
  );
}
