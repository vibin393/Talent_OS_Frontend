"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  createTableColumn,
  Field,
  Input,
  Radio,
  RadioGroup,
  Subtitle2,
  Switch,
  type TableColumnDefinition,
  Textarea,
} from "@fluentui/react-components";
import { Add20Regular, Copy20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { DetailsDrawer, ErrorBar, IdMultiSelect, IdSelect, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { useRoles } from "@/features/admin/use-admin-data";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { ssoApi, ssoKeys } from "./api";
import type { BreakGlassAdminOut, EnforceMode, IdentityProviderOut, IdpKind } from "./types";

const STATUS_COLOR = { draft: "informative", active: "success", disabled: "subtle" } as const;

/** `/settings/sso`: identity providers, enforcement, break-glass admins, JIT and group mapping (FR-77). */
export function SsoSettingsView() {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canManage = usePermission("sso:manage");
  const [wizard, setWizard] = useState(false);
  const [selected, setSelected] = useState<IdentityProviderOut | null>(null);
  const providers = useQuery({ queryKey: ssoKeys.providers, queryFn: ({ signal }) => ssoApi.providers(signal), enabled: canManage });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ssoKeys.all });
  const action = useMutation({
    mutationFn: async (v: { idp: IdentityProviderOut; kind: "activate" | "disable" | "delete" }): Promise<unknown> =>
      v.kind === "delete" ? ssoApi.remove(v.idp.id) : ssoApi.update(v.idp.id, { status: v.kind === "activate" ? "active" : "disabled" }),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!canManage) return <NoAccess what="single sign-on settings" />;

  const columns: TableColumnDefinition<IdentityProviderOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Identity provider",
      renderCell: (i) => (
        <span className={admin.cellStack}>
          <span className={admin.badges}>
            {i.name}
            <Badge appearance="outline">{i.kind.toUpperCase()}</Badge>
          </span>
          <span className={admin.muted}>{i.email_domains.join(", ") || "No email domains"}</span>
        </span>
      ),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (i) => (
        <span className={admin.badges}>
          <Badge appearance="tint" color={STATUS_COLOR[i.status]}>
            {i.status}
          </Badge>
          {i.enforce_for !== "none" && (
            <Badge appearance="tint" color="warning">
              Required {i.enforce_for === "all" ? "for everyone" : "for some roles"}
            </Badge>
          )}
        </span>
      ),
    }),
    createTableColumn({ columnId: "linked", renderHeaderCell: () => "Linked users", renderCell: (i) => i.linked_users }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (i) => (
        <RowActions
          label={i.name}
          actions={[
            { label: "Settings", onClick: () => setSelected(i) },
            ...(i.status !== "active" ? [{ label: "Activate", onClick: () => action.mutate({ idp: i, kind: "activate" }) }] : []),
            ...(i.status === "active" ? [{ label: "Disable", onClick: () => action.mutate({ idp: i, kind: "disable" }) }] : []),
            { label: i.linked_users ? "Disable (users linked)" : "Delete", icon: <Delete20Regular />, onClick: () => action.mutate({ idp: i, kind: "delete" }) },
          ]}
        />
      ),
    }),
  ];

  return (
    <>
      <PageHeader title="Single sign-on" subtitle="Let users sign in with your corporate identity provider (OIDC or SAML)" />
      <div className={admin.toolbar}>
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setWizard(true)}>
          Add identity provider
        </Button>
      </div>
      <AdminGrid
        items={providers.data}
        columns={columns}
        getRowId={(i) => i.id}
        loading={providers.isPending}
        error={providers.error}
        emptyText="No identity providers yet. Users sign in with their password."
        label="Identity providers"
        onRowClick={setSelected}
      />
      <BreakGlassPanel />
      {wizard && <CreateWizard onClose={() => setWizard(false)} onCreated={(idp) => setSelected(idp)} />}
      {selected && (
        <ProviderDrawer
          idp={providers.data?.find((p) => p.id === selected.id) ?? selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function CopyField({ label, value }: { label: string; value: string | null }) {
  const toast = useAppToast();
  if (!value) return null;
  return (
    <Field label={label}>
      <Input
        readOnly
        value={value}
        contentAfter={
          <Button
            appearance="transparent"
            size="small"
            icon={<Copy20Regular />}
            aria-label={`Copy ${label}`}
            onClick={() => {
              void navigator.clipboard?.writeText(value);
              toast.info("Copied");
            }}
          />
        }
      />
    </Field>
  );
}

function CreateWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (idp: IdentityProviderOut) => void }) {
  const admin = useAdminStyles();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [kind, setKind] = useState<IdpKind>("oidc");
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("");
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [entityId, setEntityId] = useState("");
  const [ssoUrl, setSsoUrl] = useState("");
  const [cert, setCert] = useState("");
  const create = useMutation({
    mutationFn: () =>
      ssoApi.create({
        name: name.trim(),
        kind,
        email_domains: domains.split(/[\s,]+/).map((d) => d.trim().toLowerCase()).filter(Boolean),
        ...(kind === "oidc"
          ? { oidc: { issuer: issuer.trim(), client_id: clientId.trim() }, client_secret: secret || undefined }
          : { saml: { idp_entity_id: entityId.trim(), sso_url: ssoUrl.trim(), x509_certs: [cert.trim()] } }),
      }),
    onSuccess: async (idp) => {
      await queryClient.invalidateQueries({ queryKey: ssoKeys.all });
      onClose();
      onCreated(idp);
    },
  });
  const configOk = kind === "oidc" ? issuer && clientId : entityId && ssoUrl && cert.length > 20;
  return (
    <DetailsDrawer
      open
      size="medium"
      title="Add identity provider"
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          {step === 2 && <Button onClick={() => setStep(1)}>Back</Button>}
          {step === 1 ? (
            <Button appearance="primary" disabled={!name.trim()} onClick={() => setStep(2)}>
              Next
            </Button>
          ) : (
            <Button appearance="primary" disabled={!configOk || create.isPending} onClick={() => create.mutate()}>
              Save as draft
            </Button>
          )}
        </div>
      }
    >
      <div className={admin.form}>
        {create.error ? <ErrorBar message={errorMessage(create.error)} /> : null}
        {step === 1 ? (
          <>
            <Field label="Name" required>
              <Input value={name} onChange={(_, d) => setName(d.value)} placeholder="Okta" />
            </Field>
            <Field label="Protocol">
              <RadioGroup value={kind} onChange={(_, d) => setKind(d.value as IdpKind)}>
                <Radio value="oidc" label="OpenID Connect (Okta, Entra ID, Google Workspace)" />
                <Radio value="saml" label="SAML 2.0" />
              </RadioGroup>
            </Field>
            <Field label="Email domains" hint="Users with these email domains are offered this provider">
              <Input value={domains} onChange={(_, d) => setDomains(d.value)} placeholder="acme.com, acme.in" />
            </Field>
          </>
        ) : kind === "oidc" ? (
          <>
            <Field label="Issuer URL" required>
              <Input value={issuer} onChange={(_, d) => setIssuer(d.value)} placeholder="https://acme.okta.com" />
            </Field>
            <Field label="Client ID" required>
              <Input value={clientId} onChange={(_, d) => setClientId(d.value)} />
            </Field>
            <Field label="Client secret" hint="Stored encrypted; never shown again">
              <Input type="password" value={secret} onChange={(_, d) => setSecret(d.value)} />
            </Field>
          </>
        ) : (
          <>
            <Field label="IdP entity ID" required>
              <Input value={entityId} onChange={(_, d) => setEntityId(d.value)} />
            </Field>
            <Field label="Single sign-on URL" required>
              <Input value={ssoUrl} onChange={(_, d) => setSsoUrl(d.value)} />
            </Field>
            <Field label="Signing certificate (PEM)" required>
              <Textarea value={cert} onChange={(_, d) => setCert(d.value)} resize="vertical" rows={6} />
            </Field>
          </>
        )}
        <Body1 className={admin.muted}>After saving, copy the redirect / ACS values into your IdP, run a test sign-in and activate.</Body1>
      </div>
    </DetailsDrawer>
  );
}

function ProviderDrawer({ idp, onClose }: { idp: IdentityProviderOut; onClose: () => void }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const roles = useRoles();
  const roleOptions = (roles.data ?? []).map((r) => ({ id: r.id, label: r.name }));
  const [enforce, setEnforce] = useState<EnforceMode>(idp.enforce_for);
  const [enforcedRoles, setEnforcedRoles] = useState<string[]>(idp.enforced_role_ids);
  const [jit, setJit] = useState(idp.jit_enabled);
  const [jitRole, setJitRole] = useState<string | null>(idp.jit_default_role_id);
  const [groupClaim, setGroupClaim] = useState(idp.group_claim ?? "");
  const [mfaTrusted, setMfaTrusted] = useState(idp.mfa_trusted);
  const [mappings, setMappings] = useState(idp.group_roles);
  const [group, setGroup] = useState("");
  const [groupRole, setGroupRole] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ssoKeys.all });
  const save = useMutation({
    mutationFn: async () => {
      await ssoApi.update(idp.id, {
        enforce_for: enforce,
        enforced_role_ids: enforcedRoles,
        jit_enabled: jit,
        jit_default_role_id: jitRole,
        group_claim: groupClaim.trim() || null,
        mfa_trusted: mfaTrusted,
      });
      return ssoApi.setGroupRoles(idp.id, mappings);
    },
    onSuccess: async () => {
      toast.success("Single sign-on settings saved");
      await refresh();
    },
  });
  const test = useMutation({
    mutationFn: () => ssoApi.testUrl(idp.id),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const roleName = (id: string) => roleOptions.find((r) => r.id === id)?.label ?? id;
  return (
    <DetailsDrawer
      open
      size="large"
      title={idp.name}
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button onClick={() => test.mutate()} disabled={test.isPending}>
            Test sign-in
          </Button>
          <Button appearance="primary" onClick={() => save.mutate()} disabled={save.isPending}>
            Save
          </Button>
        </div>
      }
    >
      <div className={admin.form}>
        {save.error ? <ErrorBar message={errorMessage(save.error)} /> : null}
        <Subtitle2>Values for your identity provider</Subtitle2>
        <CopyField label="Redirect URI" value={idp.redirect_uri} />
        <CopyField label="SP entity ID / metadata URL" value={idp.sp_entity_id} />
        <CopyField label="ACS URL" value={idp.acs_url} />
        <Subtitle2 className={admin.sectionTitle}>Enforcement</Subtitle2>
        <RadioGroup value={enforce} onChange={(_, d) => setEnforce(d.value as EnforceMode)}>
          <Radio value="none" label="Optional: users may still sign in with a password" />
          <Radio value="all" label="Required for everyone (break-glass admins excepted)" />
          <Radio value="roles" label="Required for selected roles" />
        </RadioGroup>
        {enforce === "roles" && (
          <IdMultiSelect label="Roles that must use SSO" options={roleOptions} value={enforcedRoles} onChange={setEnforcedRoles} />
        )}
        <Switch label="The IdP enforces MFA (skip the Talent OS code after SSO)" checked={mfaTrusted} onChange={(_, d) => setMfaTrusted(d.checked)} />
        <Subtitle2 className={admin.sectionTitle}>Just-in-time provisioning</Subtitle2>
        <Switch label="Create a user on first SSO sign-in" checked={jit} onChange={(_, d) => setJit(d.checked)} />
        {jit && (
          <>
            <IdSelect label="Default role" options={roleOptions} value={jitRole} onChange={setJitRole} noneLabel="No role" />
            <Field label="Group claim / attribute" hint="Optional: map IdP groups to roles at creation">
              <Input value={groupClaim} onChange={(_, d) => setGroupClaim(d.value)} placeholder="groups" />
            </Field>
            {mappings.map((m) => (
              <Body1 key={`${m.group_value}:${m.role_id}`}>
                {m.group_value} → {roleName(m.role_id)}{" "}
                <Button size="small" appearance="subtle" onClick={() => setMappings((all) => all.filter((x) => x !== m))}>
                  Remove
                </Button>
              </Body1>
            ))}
            <div className={admin.toolbar}>
              <Field label="Group">
                <Input value={group} onChange={(_, d) => setGroup(d.value)} />
              </Field>
              <IdSelect label="Role" options={roleOptions} value={groupRole} onChange={setGroupRole} noneLabel="Choose" />
              <Button
                disabled={!group.trim() || !groupRole}
                onClick={() => {
                  if (groupRole) setMappings((all) => [...all, { group_value: group.trim(), role_id: groupRole }]);
                  setGroup("");
                  setGroupRole(null);
                }}
              >
                Add mapping
              </Button>
            </div>
          </>
        )}
      </div>
    </DetailsDrawer>
  );
}

function BreakGlassPanel() {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ssoKeys.breakGlass, queryFn: ({ signal }) => ssoApi.breakGlass(signal) });
  const set = useMutation({
    mutationFn: (v: { a: BreakGlassAdminOut; on: boolean }) => ssoApi.setBreakGlass(v.a.user_id, v.on),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ssoKeys.breakGlass }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const columns: TableColumnDefinition<BreakGlassAdminOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Tenant Admin",
      renderCell: (a) => (
        <span className={admin.cellStack}>
          <span>{a.name}</span>
          <span className={admin.muted}>{a.email}</span>
        </span>
      ),
    }),
    createTableColumn({
      columnId: "mfa",
      renderHeaderCell: () => "MFA",
      renderCell: (a) => (
        <Badge appearance="tint" color={a.mfa_enabled ? "success" : "danger"}>
          {a.mfa_enabled ? "Enrolled" : "Not enrolled"}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "bg",
      renderHeaderCell: () => "Break-glass",
      renderCell: (a) => (
        <Switch
          checked={a.break_glass}
          disabled={!a.is_active || set.isPending}
          onChange={(_, d) => set.mutate({ a, on: d.checked })}
          aria-label={`Break-glass for ${a.name}`}
        />
      ),
    }),
  ];
  return (
    <Card style={{ marginTop: 24 }}>
      <CardHeader
        header={<Subtitle2 as="h2">Break-glass admins</Subtitle2>}
        description={<Body1>Tenant Admins who may still sign in with a password and MFA while SSO is required. Keep at least one.</Body1>}
      />
      <AdminGrid items={list.data} columns={columns} getRowId={(a) => a.user_id} loading={list.isPending} error={list.error} emptyText="No Tenant Admins." label="Break-glass admins" />
    </Card>
  );
}
