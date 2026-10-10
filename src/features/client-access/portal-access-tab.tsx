"use client";

import {
  Badge,
  Button,
  Checkbox,
  createTableColumn,
  Field,
  Switch,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { PersonAdd20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { DetailsDrawer, ErrorBar, formatDateTime, IdSelect, useAdminStyles } from "@/features/admin/ui";
import { clientsApi } from "@/features/clients/api";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { ClientUserGrantIn, ClientUserOut, ClientUserUpdate } from "@/lib/api/types";

export const CLIENT_PORTAL_PERMISSIONS = [
  { key: "submissions:review", label: "Review submitted candidates" },
  { key: "demands:approve", label: "Approve demands" },
  { key: "time:approve", label: "Approve timesheets" },
  { key: "placements:view", label: "View placements" },
  { key: "invoices:view", label: "View invoices" },
  { key: "projects:view", label: "View projects" }, // Epic 45
  { key: "deliverables:accept", label: "Accept deliverables" }, // Epic 45
  { key: "forecasts:submit", label: "Submit hiring forecasts" }, // Epic 44
  { key: "portal_copilot:use", label: "Use the portal Copilot" }, // Epic 77 (default off)
] as const;

const STATUS_COLOR = { invited: "informative", active: "success", suspended: "warning", revoked: "subtle" } as const;
const enc = encodeURIComponent;
const base = (clientId: string) => `/api/v1/clients/${enc(clientId)}/portal-users`;

const portalUsersApi = {
  list: (clientId: string, signal?: AbortSignal) => api.get<ClientUserOut[]>(base(clientId), { signal }),
  grant: (clientId: string, body: ClientUserGrantIn) => api.post<ClientUserOut>(base(clientId), body),
  update: (clientId: string, id: string, body: ClientUserUpdate) =>
    api.patch<ClientUserOut>(`${base(clientId)}/${enc(id)}`, body),
  action: (clientId: string, id: string, action: "suspend" | "reactivate" | "revoke" | "reset-mfa") =>
    api.post<ClientUserOut>(`${base(clientId)}/${enc(id)}/${action}`),
  resend: (clientId: string, id: string) => api.post<void>(`${base(clientId)}/${enc(id)}/resend`),
};

/** Client 360 "Portal access": grant contacts access to the Client Portal, scope it, suspend or revoke (FR-78). */
export function PortalAccessTab({ clientId, readOnly }: { clientId: string; readOnly: boolean }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const key = ["client-portal-users", clientId] as const;
  const users = useQuery({ queryKey: key, queryFn: ({ signal }) => portalUsersApi.list(clientId, signal) });
  const contacts = useQuery({
    queryKey: ["clients", clientId, "contacts", "portal-grant"],
    queryFn: ({ signal }) => clientsApi.listContacts(clientId, false, 1, 100, signal),
  });
  const [granting, setGranting] = useState(false);
  const [editing, setEditing] = useState<ClientUserOut | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>(["submissions:review"]);
  const [mfa, setMfa] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const grant = useMutation({
    mutationFn: () =>
      editing
        ? portalUsersApi.update(clientId, editing.id, { portal_permissions: permissions, mfa_enforced: mfa })
        : portalUsersApi.grant(clientId, { contact_id: contactId ?? "", portal_permissions: permissions, mfa_enforced: mfa }),
    onSuccess: async () => {
      toast.success(editing ? "Portal access updated" : "Invitation sent");
      setGranting(false);
      setEditing(null);
      await refresh();
    },
  });
  const act = useMutation({
    mutationFn: async (v: { u: ClientUserOut; action: "suspend" | "reactivate" | "revoke" | "reset-mfa" | "resend" }): Promise<unknown> =>
      v.action === "resend" ? portalUsersApi.resend(clientId, v.u.id) : portalUsersApi.action(clientId, v.u.id, v.action),
    onSuccess: async (_, v) => {
      if (v.action === "resend") toast.success("Sign-in link sent");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const granted = new Set((users.data ?? []).map((u) => u.contact_id));
  const contactOptions = (contacts.data?.items ?? [])
    .filter((c) => c.email && !granted.has(c.id))
    .map((c) => ({ id: c.id, label: `${c.name} <${c.email}>` }));
  const open = (u: ClientUserOut | null) => {
    setEditing(u);
    setPermissions(u ? u.portal_permissions : ["submissions:review"]);
    setMfa(u ? u.mfa_enforced : false);
    setContactId(null);
    setGranting(true);
  };

  const columns: TableColumnDefinition<ClientUserOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Contact",
      renderCell: (u) => (
        <span className={admin.cellStack}>
          <span>{u.display_name}</span>
          <span className={admin.muted}>{u.email}</span>
        </span>
      ),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (u) => (
        <span className={admin.badges}>
          <Badge appearance="tint" color={STATUS_COLOR[u.status]}>
            {u.status}
          </Badge>
          {u.mfa_enforced && <Badge appearance="outline">MFA required</Badge>}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "perms",
      renderHeaderCell: () => "Can",
      renderCell: (u) => u.portal_permissions.map((p) => CLIENT_PORTAL_PERMISSIONS.find((x) => x.key === p)?.label ?? p).join(", ") || "—",
    }),
    createTableColumn({ columnId: "last", renderHeaderCell: () => "Last sign-in", renderCell: (u) => formatDateTime(u.last_sign_in_at) }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (u) =>
        readOnly || u.status === "revoked" ? null : (
          <RowActions
            label={u.display_name}
            actions={[
              { label: "Edit access", onClick: () => open(u) },
              { label: "Resend sign-in link", onClick: () => act.mutate({ u, action: "resend" }) },
              u.status === "suspended"
                ? { label: "Reactivate", onClick: () => act.mutate({ u, action: "reactivate" }) }
                : { label: "Suspend", onClick: () => act.mutate({ u, action: "suspend" }) },
              ...(u.mfa_enabled ? [{ label: "Reset authenticator", onClick: () => act.mutate({ u, action: "reset-mfa" as const }) }] : []),
              { label: "Revoke access", onClick: () => act.mutate({ u, action: "revoke" }) },
            ]}
          />
        ),
    }),
  ];

  return (
    <>
      <div className={admin.toolbar}>
        {!readOnly && (
          <Button icon={<PersonAdd20Regular />} onClick={() => open(null)}>
            Grant portal access
          </Button>
        )}
      </div>
      <AdminGrid items={users.data} columns={columns} getRowId={(u) => u.id} loading={users.isPending} error={users.error} emptyText="No client contacts have portal access." label="Portal users" />
      <DetailsDrawer
        open={granting}
        title={editing ? `Portal access — ${editing.display_name}` : "Grant portal access"}
        onClose={() => setGranting(false)}
        footer={
          <div className={admin.footer}>
            <Button onClick={() => setGranting(false)}>Cancel</Button>
            <Button appearance="primary" disabled={(!editing && !contactId) || grant.isPending} onClick={() => grant.mutate()}>
              {editing ? "Save" : "Grant and send invitation"}
            </Button>
          </div>
        }
      >
        <div className={admin.form}>
          {grant.error ? <ErrorBar message={errorMessage(grant.error)} /> : null}
          {!editing && (
            <IdSelect
              label="Contact"
              options={contactOptions}
              value={contactId}
              onChange={setContactId}
              noneLabel="Choose a contact with an email"
            />
          )}
          <Field label="Permissions">
            {CLIENT_PORTAL_PERMISSIONS.map((p) => (
              <Checkbox
                key={p.key}
                label={p.label}
                checked={permissions.includes(p.key)}
                onChange={(_, d) =>
                  setPermissions((all) => (d.checked ? [...all, p.key] : all.filter((x) => x !== p.key)))
                }
              />
            ))}
          </Field>
          <Switch label="Require an authenticator app (TOTP)" checked={mfa} onChange={(_, d) => setMfa(d.checked)} />
        </div>
      </DetailsDrawer>
    </>
  );
}
