"use client";

import {
  Avatar,
  Badge,
  Button,
  createTableColumn,
  Link,
  SearchBox,
  TableCellLayout,
  type TableColumnDefinition,
  Text, mergeClasses } from "@fluentui/react-components";
import { ArrowUndo20Regular, Edit20Regular, PersonAdd20Regular, PersonProhibited20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { usePermission } from "@/features/auth/use-permission";
import { useMe } from "@/features/auth/use-me";
import type { AdminUserOut } from "@/lib/api/types";
import { adminApi, adminKeys } from "./api";
import { AdminGrid, RowActions } from "./admin-grid";
import { adminErrorMessage } from "./errors";
import { InviteUserDialog } from "./invite-user-dialog";
import { DEFAULT_PAGE_SIZE, EMPTY_USER_FILTERS, hasActiveFilters, type UserListFilters } from "./query";
import { ConfirmDialog, formatDateTime, IdSelect, NoAccess, PagingBar, useAdminStyles } from "./ui";
import { useAdminMutation, useBusinessUnitLookup, useRoles, useTeamLookup } from "./use-admin-data";
import { UserDrawer } from "./user-drawer";
import { authKeys } from "@/features/auth/api";

const STATUS_OPTIONS = [
  { id: "active", label: "Active" },
  { id: "inactive", label: "Deactivated" },
];

export function UsersView() {
  const styles = useAdminStyles();
  const toast = useAppToast();
  const { data: me } = useMe();
  const canRead = usePermission("user:read");
  const canManage = usePermission("user:manage");
  const canReadRoles = usePermission("role:read");
  const canReadTeams = usePermission("team:read");
  const canReadBUs = usePermission("business_unit:read");

  const [filters, setFilters] = useState<UserListFilters>(EMPTY_USER_FILTERS);
  const [page, setPage] = useState(1);
  const [inviting, setInviting] = useState(false);
  const [selected, setSelected] = useState<AdminUserOut | null>(null);
  const [toggling, setToggling] = useState<AdminUserOut | null>(null);
  // Typing in the search box re-renders immediately; the query follows the deferred value.
  const deferredFilters = useDeferredValue(filters);

  const list = useQuery({
    queryKey: adminKeys.userList(deferredFilters, page, DEFAULT_PAGE_SIZE),
    queryFn: ({ signal }) => adminApi.listUsers(deferredFilters, page, DEFAULT_PAGE_SIZE, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
  const roles = useRoles(canRead && canReadRoles);
  const teams = useTeamLookup(canRead && canReadTeams);
  const units = useBusinessUnitLookup(canRead && canReadBUs);

  const setStatus = useAdminMutation({
    mutationFn: (user: AdminUserOut) =>
      user.is_active ? adminApi.deactivateUser(user.id) : adminApi.reactivateUser(user.id),
    invalidate: [adminKeys.users, adminKeys.roles, adminKeys.teams, authKeys.me],
    success: (user) => (user.is_active ? `${user.name || user.email} reactivated` : `${user.name || user.email} deactivated`),
  });

  if (!canRead) return <NoAccess what="users" />;

  const updateFilters = (patch: Partial<UserListFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const columns: TableColumnDefinition<AdminUserOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Display name",
      renderCell: (u) => (
        <TableCellLayout media={<Avatar name={u.name || u.email} size={32} color="colorful" aria-hidden />}>
          <div className={styles.cellStack}>
            <Link as="button" onClick={() => setSelected(u)} className={styles.truncate}>
              {u.name || u.email}
            </Link>
            <Text size={200} className={mergeClasses(styles.muted, styles.truncate)}>
              {u.email}
            </Text>
          </div>
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "roles",
      renderHeaderCell: () => "Roles",
      renderCell: (u) => (
        <div className={styles.badges}>
          {u.roles.map((r) => (
            <Badge key={r.id} appearance="tint" color="informative">
              {r.name}
            </Badge>
          ))}
        </div>
      ),
    }),
    createTableColumn({
      columnId: "teams",
      renderHeaderCell: () => "Teams",
      renderCell: (u) => (
        <TableCellLayout truncate>
          {u.teams.length ? u.teams.map((t) => (t.is_lead ? `${t.name} (lead)` : t.name)).join(", ") : "—"}
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "bu",
      renderHeaderCell: () => "Business unit",
      renderCell: (u) => <TableCellLayout truncate>{u.business_unit?.name ?? "—"}</TableCellLayout>,
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (u) =>
        u.is_active ? (
          <Badge appearance="tint" color="success">
            Active
          </Badge>
        ) : (
          <Badge appearance="tint" color="subtle">
            Deactivated
          </Badge>
        ),
    }),
    createTableColumn({
      columnId: "last_login",
      renderHeaderCell: () => "Last sign-in",
      renderCell: (u) => formatDateTime(u.last_login_at),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (u) => {
        const self = u.id === me?.user.id;
        return (
          <RowActions
            label={u.name || u.email}
            actions={[
              { label: canManage ? "Edit" : "View details", icon: <Edit20Regular />, onClick: () => setSelected(u) },
              ...(canManage && !self
                ? [
                    u.is_active
                      ? { label: "Deactivate", icon: <PersonProhibited20Regular />, onClick: () => setToggling(u) }
                      : { label: "Reactivate", icon: <ArrowUndo20Regular />, onClick: () => setToggling(u) },
                  ]
                : []),
            ]}
          />
        );
      },
    }),
  ];

  const roleOptions = (roles.data ?? []).map((r) => ({ id: r.id, label: r.name }));
  const teamOptions = (teams.data?.items ?? []).map((t) => ({ id: t.id, label: t.name }));
  const unitOptions = (units.data?.items ?? []).map((b) => ({ id: b.id, label: b.name }));

  return (
    <>
      <PageHeader title="Active users" subtitle="People who can sign in to this workspace." />
      <div className={styles.toolbar}>
        {canManage && (
          <Button appearance="primary" icon={<PersonAdd20Regular />} onClick={() => setInviting(true)}>
            Add a user
          </Button>
        )}
        <SearchBox
          className={styles.search}
          placeholder="Search by name or email"
          aria-label="Search users"
          value={filters.q}
          maxLength={200}
          onChange={(_, d) => updateFilters({ q: d.value })}
        />
        <IdSelect
          className={styles.filter}
          label="Status"
          noneLabel="All"
          options={STATUS_OPTIONS}
          value={filters.status === "all" ? null : filters.status}
          onChange={(v) => updateFilters({ status: v === "active" || v === "inactive" ? v : "all" })}
        />
        {canReadRoles && (
          <IdSelect
            className={styles.filter}
            label="Role"
            noneLabel="All roles"
            options={roleOptions}
            value={filters.roleId}
            onChange={(v) => updateFilters({ roleId: v })}
          />
        )}
        {canReadTeams && (
          <IdSelect
            className={styles.filter}
            label="Team"
            noneLabel="All teams"
            options={teamOptions}
            value={filters.teamId}
            onChange={(v) => updateFilters({ teamId: v })}
          />
        )}
        {canReadBUs && (
          <IdSelect
            className={styles.filter}
            label="Business unit"
            noneLabel="All business units"
            options={unitOptions}
            value={filters.businessUnitId}
            onChange={(v) => updateFilters({ businessUnitId: v })}
          />
        )}
        {hasActiveFilters(filters) && (
          <Button appearance="subtle" onClick={() => updateFilters(EMPTY_USER_FILTERS)}>
            Clear filters
          </Button>
        )}
      </div>
      <AdminGrid
        label="Users"
        items={list.data?.items}
        columns={columns}
        getRowId={(u) => u.id}
        loading={list.isPending}
        error={list.error}
        emptyText={hasActiveFilters(filters) ? "No users match these filters." : "No users yet."}
        columnSizing={{
          name: { minWidth: 220, idealWidth: 280 },
          roles: { minWidth: 140, idealWidth: 200 },
          actions: { minWidth: 56, idealWidth: 56 },
        }}
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

      {inviting && <InviteUserDialog onClose={() => setInviting(false)} />}
      {selected && (
        <UserDrawer
          key={selected.id}
          user={selected}
          isSelf={selected.id === me?.user.id}
          onSaved={setSelected}
          onClose={() => setSelected(null)}
        />
      )}
      <ConfirmDialog
        open={!!toggling}
        title={toggling?.is_active ? "Deactivate user?" : "Reactivate user?"}
        confirmLabel={toggling?.is_active ? "Deactivate" : "Reactivate"}
        onClose={() => setToggling(null)}
        onConfirm={() =>
          setStatus.mutateAsync(toggling!).catch((e) => {
            toast.error(adminErrorMessage(e));
            throw e;
          })
        }
      >
        {toggling &&
          (toggling.is_active
            ? `${toggling.name || toggling.email} will be signed out everywhere and will no longer be able to sign in. Their data is kept.`
            : `${toggling.name || toggling.email} will be able to sign in again and will use a seat.`)}
      </ConfirmDialog>
    </>
  );
}
