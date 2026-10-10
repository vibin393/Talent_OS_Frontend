"use client";

import { Badge, Button, createTableColumn, Field, Input, Switch, type TableColumnDefinition } from "@fluentui/react-components";
import { PersonAdd20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { accessDeniedFrom } from "@/features/access-denied/access";
import { AccessDenied } from "@/features/access-denied/access-denied";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { DetailsDrawer, ErrorBar, formatDateTime, useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import type { VendorPortalUserOut } from "@/lib/api/types";
import { vendorPortalAuthApi, vendorPortalAuthKeys } from "@/lib/api/vendor-portal-client";

const STATUS_COLOR = { invited: "informative", active: "success", suspended: "warning", deactivated: "subtle" } as const;

/** Vendor Portal `/vendor/users`: vendor admins invite and deactivate their colleagues (FR-79). */
export function VendorPortalUsersPanel() {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const users = useQuery({ queryKey: vendorPortalAuthKeys.users, queryFn: ({ signal }) => vendorPortalAuthApi.users(signal), retry: false });
  const refresh = () => queryClient.invalidateQueries({ queryKey: vendorPortalAuthKeys.users });
  const invite = useMutation({
    mutationFn: () => vendorPortalAuthApi.inviteUser({ email: email.trim(), display_name: name.trim(), is_vendor_admin: isAdmin }),
    onSuccess: async () => {
      toast.success("Invitation sent");
      setInviting(false);
      setEmail("");
      setName("");
      setIsAdmin(false);
      await refresh();
    },
  });
  const change = useMutation({
    mutationFn: (v: { u: VendorPortalUserOut; kind: "deactivate" | "reactivate" | "admin" | "member" }) =>
      v.kind === "admin" || v.kind === "member"
        ? vendorPortalAuthApi.updateUser(v.u.id, { is_vendor_admin: v.kind === "admin" })
        : vendorPortalAuthApi.setUserActive(v.u.id, v.kind === "reactivate"),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  const denied = accessDeniedFrom(users.error, "account_manager");
  if (denied) return <AccessDenied action={denied.action ?? "Manage vendor portal users"} ask={denied.ask} />;

  const columns: TableColumnDefinition<VendorPortalUserOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "User",
      renderCell: (u) => (
        <span className={admin.cellStack}>
          <span className={admin.badges}>
            {u.display_name}
            {u.is_vendor_admin && <Badge appearance="tint" color="brand">Admin</Badge>}
          </span>
          <span className={admin.muted}>{u.email}</span>
        </span>
      ),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (u) => (
        <Badge appearance="tint" color={STATUS_COLOR[u.status]}>
          {u.status}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "mfa", renderHeaderCell: () => "Authenticator", renderCell: (u) => (u.mfa_enabled ? "Set up" : "Pending") }),
    createTableColumn({ columnId: "last", renderHeaderCell: () => "Last sign-in", renderCell: (u) => formatDateTime(u.last_sign_in_at) }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (u) => (
        <RowActions
          label={u.display_name}
          actions={[
            u.is_vendor_admin
              ? { label: "Remove admin", onClick: () => change.mutate({ u, kind: "member" }) }
              : { label: "Make admin", onClick: () => change.mutate({ u, kind: "admin" }) },
            u.status === "deactivated"
              ? { label: "Reactivate", onClick: () => change.mutate({ u, kind: "reactivate" }) }
              : { label: "Deactivate", onClick: () => change.mutate({ u, kind: "deactivate" }) },
          ]}
        />
      ),
    }),
  ];

  return (
    <>
      <div className={admin.toolbar}>
        <Button appearance="primary" icon={<PersonAdd20Regular />} onClick={() => setInviting(true)}>
          Invite user
        </Button>
      </div>
      <AdminGrid items={users.data} columns={columns} getRowId={(u) => u.id} loading={users.isPending} error={users.error} emptyText="No users." label="Vendor users" />
      <DetailsDrawer
        open={inviting}
        title="Invite a colleague"
        onClose={() => setInviting(false)}
        footer={
          <div className={admin.footer}>
            <Button onClick={() => setInviting(false)}>Cancel</Button>
            <Button appearance="primary" disabled={!email.includes("@") || !name.trim() || invite.isPending} onClick={() => invite.mutate()}>
              Send invitation
            </Button>
          </div>
        }
      >
        <div className={admin.form}>
          {invite.error ? <ErrorBar message={errorMessage(invite.error)} /> : null}
          <Field label="Name" required>
            <Input value={name} onChange={(_, d) => setName(d.value)} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(_, d) => setEmail(d.value)} />
          </Field>
          <Switch label="Vendor admin (can manage users)" checked={isAdmin} onChange={(_, d) => setIsAdmin(d.checked)} />
        </div>
      </DetailsDrawer>
    </>
  );
}
