"use client";

import { Badge, Button, Checkbox, createTableColumn, Field, Input, Switch, type TableColumnDefinition } from "@fluentui/react-components";
import { PersonAdd20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { DetailsDrawer, ErrorBar, formatDateTime, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { VendorUserOut } from "@/lib/api/types";

const enc = encodeURIComponent;
const base = (vendorId: string) => `/api/v1/vendors/${enc(vendorId)}/portal-users`;
const STATUS_COLOR = { invited: "informative", active: "success", suspended: "warning", deactivated: "subtle" } as const;

/** Vendor Portal areas a Vendor User may be given (`vendor_users.portal_permissions`, Epic 17). */
export const VENDOR_PORTAL_PERMISSIONS: { key: string; label: string }[] = [
  { key: "releases:view", label: "View requirements (releases)" },
  { key: "submissions:create", label: "Submit candidates" },
  { key: "placements:view", label: "View placements" },
  { key: "documents:manage", label: "Manage documents" },
  { key: "statements:view", label: "View statements" },
  { key: "portal_copilot:use", label: "Use the portal Copilot" }, // Epic 77 (default off)
];
const ALL_PERMISSION_KEYS = VENDOR_PORTAL_PERMISSIONS.map((p) => p.key);
const DEFAULT_PERMISSION_KEYS = ALL_PERMISSION_KEYS.filter((k) => k !== "portal_copilot:use"); // Epic 77

/** Toggle one permission key, keeping catalogue order. */
export function togglePermission(selected: readonly string[], key: string, on: boolean): string[] {
  const next = new Set(selected);
  if (on) next.add(key);
  else next.delete(key);
  return ALL_PERMISSION_KEYS.filter((k) => next.has(k));
}

type VendorUserInvite = { email: string; display_name: string; is_vendor_admin: boolean; portal_permissions: string[] };
type VendorUserPatch = { is_vendor_admin?: boolean; display_name?: string; portal_permissions?: string[] };

export const vendorUsersAdminApi = {
  list: (vendorId: string, signal?: AbortSignal) => api.get<VendorUserOut[]>(base(vendorId), { signal }),
  invite: (vendorId: string, body: VendorUserInvite) => api.post<VendorUserOut>(base(vendorId), body),
  update: (vendorId: string, id: string, body: VendorUserPatch) =>
    api.patch<VendorUserOut>(`${base(vendorId)}/${enc(id)}`, body),
  action: (vendorId: string, id: string, action: "deactivate" | "reactivate" | "reset-mfa") =>
    api.post<VendorUserOut>(`${base(vendorId)}/${enc(id)}/${action}`),
  resend: (vendorId: string, id: string) => api.post<void>(`${base(vendorId)}/${enc(id)}/resend`),
};

/**
 * Internal Vendor Users panel (Epic 14, FR-79; `vendor_portal:manage`): invite a vendor's portal users,
 * deactivate / reactivate them, reset their authenticator, resend invitations. Epic 17 mounts it on the
 * vendor page (`<VendorUsersAdminPanel vendorId=... />`).
 */
export function VendorUsersAdminPanel({ vendorId, readOnly = false }: { vendorId: string; readOnly?: boolean }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canManage = usePermission("vendor_portal:manage") && !readOnly;
  const key = ["vendor-portal-users", vendorId] as const;
  const users = useQuery({ queryKey: key, queryFn: ({ signal }) => vendorUsersAdminApi.list(vendorId, signal) });
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isAdmin, setIsAdmin] = useState(true);
  const [perms, setPerms] = useState<string[]>(DEFAULT_PERMISSION_KEYS);
  const [editing, setEditing] = useState<VendorUserOut | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const invite = useMutation({
    mutationFn: () =>
      vendorUsersAdminApi.invite(vendorId, {
        email: email.trim(),
        display_name: name.trim(),
        is_vendor_admin: isAdmin,
        portal_permissions: perms,
      }),
    onSuccess: async () => {
      toast.success("Invitation sent");
      setInviting(false);
      setEmail("");
      setName("");
      setPerms(DEFAULT_PERMISSION_KEYS);
      await refresh();
    },
  });
  const saveAccess = useMutation({
    mutationFn: (v: { u: VendorUserOut; permissions: string[] }) =>
      vendorUsersAdminApi.update(vendorId, v.u.id, { portal_permissions: v.permissions }),
    onSuccess: async () => {
      toast.success("Portal access updated");
      setEditing(null);
      await refresh();
    },
  });
  const openAccess = (u: VendorUserOut) => {
    setEditPerms(ALL_PERMISSION_KEYS.filter((k) => u.portal_permissions.includes(k)));
    setEditing(u);
  };
  const act = useMutation({
    mutationFn: async (v: { u: VendorUserOut; action: "deactivate" | "reactivate" | "reset-mfa" | "resend" | "admin" | "member" }): Promise<unknown> => {
      if (v.action === "resend") return vendorUsersAdminApi.resend(vendorId, v.u.id);
      if (v.action === "admin" || v.action === "member") {
        return vendorUsersAdminApi.update(vendorId, v.u.id, { is_vendor_admin: v.action === "admin" });
      }
      return vendorUsersAdminApi.action(vendorId, v.u.id, v.action);
    },
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const columns: TableColumnDefinition<VendorUserOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "User",
      renderCell: (u) => (
        <span className={admin.cellStack}>
          <span className={admin.badges}>
            {u.display_name}
            {u.is_vendor_admin && <Badge appearance="tint" color="brand">Vendor admin</Badge>}
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
    createTableColumn({
      columnId: "access",
      renderHeaderCell: () => "Portal access",
      renderCell: (u) =>
        u.portal_permissions.length === 0 ? (
          <Badge appearance="tint" color="warning">No access</Badge>
        ) : (
          `${u.portal_permissions.length} of ${ALL_PERMISSION_KEYS.length} areas`
        ),
    }),
    createTableColumn({ columnId: "mfa", renderHeaderCell: () => "Authenticator", renderCell: (u) => (u.mfa_enabled ? "Set up" : "Pending") }),
    createTableColumn({ columnId: "last", renderHeaderCell: () => "Last sign-in", renderCell: (u) => formatDateTime(u.last_sign_in_at) }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (u) =>
        canManage ? (
          <RowActions
            label={u.display_name}
            actions={[
              { label: "Edit portal access", onClick: () => openAccess(u) },
              ...(u.status === "invited" ? [{ label: "Resend invitation", onClick: () => act.mutate({ u, action: "resend" }) }] : []),
              u.is_vendor_admin
                ? { label: "Remove vendor admin", onClick: () => act.mutate({ u, action: "member" }) }
                : { label: "Make vendor admin", onClick: () => act.mutate({ u, action: "admin" }) },
              ...(u.mfa_enabled ? [{ label: "Reset authenticator", onClick: () => act.mutate({ u, action: "reset-mfa" }) }] : []),
              u.status === "deactivated"
                ? { label: "Reactivate", onClick: () => act.mutate({ u, action: "reactivate" }) }
                : { label: "Deactivate", onClick: () => act.mutate({ u, action: "deactivate" }) },
            ]}
          />
        ) : null,
    }),
  ];
  return (
    <>
      {canManage && (
        <div className={admin.toolbar}>
          <Button icon={<PersonAdd20Regular />} onClick={() => setInviting(true)}>
            Invite portal user
          </Button>
        </div>
      )}
      <AdminGrid items={users.data} columns={columns} getRowId={(u) => u.id} loading={users.isPending} error={users.error} emptyText="No vendor portal users yet." label="Vendor portal users" />
      <DetailsDrawer
        open={inviting}
        title="Invite vendor portal user"
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
          <Switch label="Vendor admin (manages the vendor's own users)" checked={isAdmin} onChange={(_, d) => setIsAdmin(d.checked)} />
          <Field label="Portal access" hint="Areas of the Vendor Portal this user can open.">
            {VENDOR_PORTAL_PERMISSIONS.map((p) => (
              <Checkbox
                key={p.key}
                label={p.label}
                checked={perms.includes(p.key)}
                onChange={(_, d) => setPerms((cur) => togglePermission(cur, p.key, d.checked === true))}
              />
            ))}
          </Field>
        </div>
      </DetailsDrawer>
      <DetailsDrawer
        open={editing !== null}
        title={editing ? `Portal access — ${editing.display_name}` : "Portal access"}
        onClose={() => setEditing(null)}
        footer={
          <div className={admin.footer}>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={editing === null || saveAccess.isPending}
              onClick={() => editing && saveAccess.mutate({ u: editing, permissions: editPerms })}
            >
              Save access
            </Button>
          </div>
        }
      >
        <div className={admin.form}>
          {saveAccess.error ? <ErrorBar message={errorMessage(saveAccess.error)} /> : null}
          <Field label="Portal access" hint="Areas of the Vendor Portal this user can open.">
            {VENDOR_PORTAL_PERMISSIONS.map((p) => (
              <Checkbox
                key={p.key}
                label={p.label}
                checked={editPerms.includes(p.key)}
                onChange={(_, d) => setEditPerms((cur) => togglePermission(cur, p.key, d.checked === true))}
              />
            ))}
          </Field>
        </div>
      </DetailsDrawer>
    </>
  );
}
