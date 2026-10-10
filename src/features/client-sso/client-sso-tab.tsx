"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
  Combobox,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Link,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Subtitle2,
  Switch,
  type TableColumnDefinition,
  Textarea,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Add20Regular, Copy20Regular, Open20Regular, ShieldKeyhole20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ConfirmDialog, DetailsDrawer, ErrorBar, formatDateTime, useAdminStyles } from "@/features/admin/ui";
import { CLIENT_PORTAL_PERMISSIONS } from "@/features/client-access/portal-access-tab";
import { clientSpMetadataUrl, clientSsoApi, clientSsoKeys } from "./api";
import {
  clientSsoErrorMessage,
  EMPTY_IDP_FORM,
  enforcementState,
  errorField,
  type IdpForm,
  type IdpFormErrors,
  idpFormFromOut,
  MAX_REASON,
  type SamlSource,
  toCreatePayload,
  toMetadataImport,
  toUpdatePayload,
  validateConnection,
  validateExemptionReason,
  validateSignIn,
  warningMessage,
} from "./form";
import type { ClientIdentityProviderOut, ClientIdpKind, ClientSsoExemptionOut } from "./types";

const PERMISSION_KEYS: readonly string[] = CLIENT_PORTAL_PERMISSIONS.map((p) => p.key);
const STATUS_COLOR = { draft: "informative", active: "success", disabled: "subtle" } as const;
const STEPS = ["Connection", "Sign-in", "Finish"] as const;

const useStyles = makeStyles({
  card: { marginTop: tokens.spacingVerticalXXL },
  cardBody: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalM,
    paddingBottom: tokens.spacingVerticalM,
  },
  switchRow: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  inlineEnd: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center", flexWrap: "wrap" },
  stepCaption: { color: tokens.colorNeutralForeground3 },
  checks: { display: "flex", flexDirection: "column" },
});

/** Client 360 "Single sign-on": the Client's identity providers, enforcement and break-glass users (FR-250..252). */
export function ClientSsoTab({ clientId, readOnly }: { clientId: string; readOnly: boolean }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [wizard, setWizard] = useState<{ idp: ClientIdentityProviderOut | null } | null>(null);
  const [removing, setRemoving] = useState<ClientIdentityProviderOut | null>(null);
  const providers = useQuery({
    queryKey: clientSsoKeys.providers(clientId),
    queryFn: ({ signal }) => clientSsoApi.providers(clientId, signal),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: clientSsoKeys.all(clientId) });
  const setStatus = useMutation({
    mutationFn: (v: { idp: ClientIdentityProviderOut; status: "active" | "disabled" }) =>
      clientSsoApi.update(clientId, v.idp.id, { status: v.status }),
    onSuccess: refresh,
    onError: (e) => toast.error(clientSsoErrorMessage(e)),
  });

  const columns: TableColumnDefinition<ClientIdentityProviderOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Identity provider",
      renderCell: (i) => (
        <span className={admin.cellStack}>
          <span>{i.name}</span>
          {i.warnings.length > 0 && <span className={admin.muted}>{warningMessage(i.warnings[0])}</span>}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "kind",
      renderHeaderCell: () => "Kind",
      renderCell: (i) => <Badge appearance="outline">{i.kind.toUpperCase()}</Badge>,
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (i) => (
        <Badge appearance="tint" color={STATUS_COLOR[i.status]}>
          {i.status}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "domains", renderHeaderCell: () => "Domains", renderCell: (i) => i.email_domains.join(", ") || "—" }),
    createTableColumn({ columnId: "jit", renderHeaderCell: () => "JIT", renderCell: (i) => (i.jit_enabled ? "Yes" : "No") }),
    createTableColumn({ columnId: "last", renderHeaderCell: () => "Last sign-in", renderCell: (i) => formatDateTime(i.last_login_at) }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (i) =>
        readOnly ? null : (
          <RowActions
            label={i.name}
            actions={[
              { label: "Edit", onClick: () => setWizard({ idp: i }) },
              ...(i.status !== "active" ? [{ label: "Activate", onClick: () => setStatus.mutate({ idp: i, status: "active" }) }] : []),
              ...(i.status === "active" ? [{ label: "Disable", onClick: () => setStatus.mutate({ idp: i, status: "disabled" }) }] : []),
              { label: i.linked_users ? "Disable (users linked)" : "Delete", onClick: () => setRemoving(i) },
            ]}
          />
        ),
    }),
  ];

  return (
    <>
      <div className={admin.toolbar}>
        {!readOnly && (
          <Button icon={<Add20Regular />} onClick={() => setWizard({ idp: null })}>
            Add identity provider
          </Button>
        )}
      </div>
      <AdminGrid
        items={providers.data}
        columns={columns}
        getRowId={(i) => i.id}
        loading={providers.isPending}
        error={providers.error}
        emptyText="No identity provider. This client's users sign in with an emailed link."
        label="Client identity providers"
        onRowClick={readOnly ? undefined : (i) => setWizard({ idp: i })}
      />
      <EnforcementCard clientId={clientId} readOnly={readOnly} />
      {wizard && (
        <IdpWizard
          clientId={clientId}
          initial={wizard.idp}
          providers={providers.data ?? []}
          onClose={() => setWizard(null)}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title={removing?.linked_users ? "Disable identity provider" : "Delete identity provider"}
        confirmLabel={removing?.linked_users ? "Disable" : "Delete"}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await clientSsoApi.remove(clientId, removing.id);
            await refresh();
          } catch (e) {
            toast.error(clientSsoErrorMessage(e));
            throw e;
          }
        }}
      >
        {removing?.linked_users
          ? `${removing.linked_users} portal user(s) are linked to ${removing.name}, so it is disabled instead of deleted.`
          : `Delete ${removing?.name ?? "this provider"}? Users of this client can no longer sign in with it.`}
      </ConfirmDialog>
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

function Warnings({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return (
    <MessageBar intent="warning" layout="multiline">
      <MessageBarBody>
        {codes.map((c) => (
          <div key={c}>{warningMessage(c)}</div>
        ))}
      </MessageBarBody>
    </MessageBar>
  );
}

/** Create / edit wizard: connection -> domains + JIT -> values for the IdP, test sign-in, activate. */
function IdpWizard({
  clientId,
  initial,
  providers,
  onClose,
}: {
  clientId: string;
  initial: ClientIdentityProviderOut | null;
  providers: ClientIdentityProviderOut[];
  onClose: () => void;
}) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<IdpForm>(() => (initial ? idpFormFromOut(initial) : EMPTY_IDP_FORM));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<IdpFormErrors>({});
  const [savedId, setSavedId] = useState<string | null>(initial?.id ?? null);
  const [saved, setSaved] = useState<ClientIdentityProviderOut | null>(initial);
  const editing = savedId !== null;
  const idp = (savedId && providers.find((p) => p.id === savedId)) || saved;
  const set = <K extends keyof IdpForm>(key: K, value: IdpForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const refresh = () => queryClient.invalidateQueries({ queryKey: clientSsoKeys.all(clientId) });

  const save = useMutation({
    mutationFn: async () => {
      let out = savedId
        ? await clientSsoApi.update(clientId, savedId, toUpdatePayload(form, PERMISSION_KEYS))
        : await clientSsoApi.create(clientId, toCreatePayload(form, PERMISSION_KEYS));
      setSavedId(out.id);
      setSaved(out);
      const metadata = toMetadataImport(form);
      if (metadata) out = await clientSsoApi.importMetadata(clientId, out.id, metadata);
      return out;
    },
    onSuccess: async (out) => {
      setSaved(out);
      // Back to the saved values (secret cleared, imported metadata shown as entered values).
      setForm(idpFormFromOut(out));
      setStep(2);
      await refresh();
    },
    onError: async (e) => {
      const field = errorField(e);
      if (field) {
        setErrors({ [field]: clientSsoErrorMessage(e) });
        setStep(field === "certs" ? 0 : 1);
      }
      await refresh();
    },
  });
  const test = useMutation({
    mutationFn: () => clientSsoApi.testUrl(clientId, savedId ?? ""),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
    onError: (e) => toast.error(clientSsoErrorMessage(e)),
  });
  const activate = useMutation({
    mutationFn: () => clientSsoApi.update(clientId, savedId ?? "", { status: "active" }),
    onSuccess: async (out) => {
      setSaved(out);
      toast.success(`${out.name} is active`);
      await refresh();
    },
  });

  function next() {
    const found = step === 0 ? validateConnection(form, editing) : validateSignIn(form, PERMISSION_KEYS);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (step === 0) setStep(1);
    else save.mutate();
  }

  const fieldProps = (key: keyof IdpForm) => ({
    validationMessage: errors[key],
    validationState: errors[key] ? ("error" as const) : ("none" as const),
  });

  return (
    <DetailsDrawer
      open
      size="medium"
      title={initial ? initial.name : "Add identity provider"}
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          {step > 0 && (
            <Button onClick={() => setStep(step - 1)} disabled={save.isPending}>
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button appearance="primary" onClick={next} disabled={save.isPending}>
              {step === 0 ? "Next" : editing ? "Save" : "Save as draft"}
            </Button>
          ) : (
            <>
              <Button icon={<Open20Regular />} onClick={() => test.mutate()} disabled={!savedId || test.isPending}>
                Test sign-in
              </Button>
              {idp?.status !== "active" ? (
                <Button appearance="primary" onClick={() => activate.mutate()} disabled={!savedId || activate.isPending}>
                  Activate
                </Button>
              ) : (
                <Button appearance="primary" onClick={onClose}>
                  Done
                </Button>
              )}
            </>
          )}
        </div>
      }
    >
      <div className={admin.form}>
        <Caption1 className={styles.stepCaption}>
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </Caption1>
        {save.error && !errorField(save.error) ? <ErrorBar message={clientSsoErrorMessage(save.error)} /> : null}
        {activate.error ? <ErrorBar message={clientSsoErrorMessage(activate.error)} /> : null}
        {step === 0 && (
          <>
            <Field label="Name" required {...fieldProps("name")}>
              <Input value={form.name} onChange={(_, d) => set("name", d.value)} placeholder="Acme Entra ID" />
            </Field>
            <Field label="Protocol">
              <RadioGroup value={form.kind} disabled={editing} onChange={(_, d) => set("kind", d.value as ClientIdpKind)}>
                <Radio value="oidc" label="OpenID Connect (Entra ID, Okta, Google Workspace)" />
                <Radio value="saml" label="SAML 2.0" />
              </RadioGroup>
            </Field>
            {form.kind === "oidc" ? (
              <>
                <Field label="Issuer URL" required {...fieldProps("issuer")}>
                  <Input value={form.issuer} onChange={(_, d) => set("issuer", d.value)} placeholder="https://login.microsoftonline.com/<tenant>/v2.0" />
                </Field>
                <Field label="Client ID" required {...fieldProps("clientId")}>
                  <Input value={form.clientId} onChange={(_, d) => set("clientId", d.value)} />
                </Field>
                <Field
                  label="Client secret"
                  hint={idp?.has_secret ? "A secret is stored. Leave empty to keep it." : "Stored encrypted; never shown again."}
                >
                  <Input type="password" value={form.clientSecret} onChange={(_, d) => set("clientSecret", d.value)} autoComplete="off" />
                </Field>
              </>
            ) : (
              <>
                <Field label="Configuration">
                  <RadioGroup value={form.samlSource} onChange={(_, d) => set("samlSource", d.value as SamlSource)}>
                    <Radio value="manual" label="Enter the values" />
                    <Radio value="metadata_url" label="Import metadata from a URL" />
                    <Radio value="metadata_xml" label="Paste metadata XML" />
                  </RadioGroup>
                </Field>
                {form.samlSource === "metadata_url" && (
                  <Field label="Metadata URL" required {...fieldProps("metadataUrl")}>
                    <Input value={form.metadataUrl} onChange={(_, d) => set("metadataUrl", d.value)} placeholder="https://idp.acme.com/metadata.xml" />
                  </Field>
                )}
                {form.samlSource === "metadata_xml" && (
                  <Field label="Metadata XML" required {...fieldProps("metadataXml")}>
                    <Textarea value={form.metadataXml} onChange={(_, d) => set("metadataXml", d.value)} resize="vertical" rows={8} />
                  </Field>
                )}
                {form.samlSource === "manual" && (
                  <>
                    <Field label="IdP entity ID" required {...fieldProps("entityId")}>
                      <Input value={form.entityId} onChange={(_, d) => set("entityId", d.value)} />
                    </Field>
                    <Field label="Single sign-on URL" required {...fieldProps("ssoUrl")}>
                      <Input value={form.ssoUrl} onChange={(_, d) => set("ssoUrl", d.value)} />
                    </Field>
                    <Field
                      label="Signing certificate(s) (PEM)"
                      required={!editing}
                      hint="Paste one or more certificates; add the new one before a rollover."
                      {...fieldProps("certs")}
                    >
                      <Textarea value={form.certs} onChange={(_, d) => set("certs", d.value)} resize="vertical" rows={6} />
                    </Field>
                    <Field label="Email attribute" hint="Optional; defaults to the NameID / standard email claim">
                      <Input value={form.emailAttribute} onChange={(_, d) => set("emailAttribute", d.value)} />
                    </Field>
                    <Field label="Name attribute" hint="Optional">
                      <Input value={form.nameAttribute} onChange={(_, d) => set("nameAttribute", d.value)} />
                    </Field>
                  </>
                )}
              </>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <Field
              label="Email domains"
              required
              hint="Only users with these email domains can sign in with this provider"
              {...fieldProps("domains")}
            >
              <Input value={form.domains} onChange={(_, d) => set("domains", d.value)} placeholder="acme.com, acme.in" />
            </Field>
            <Switch
              label="The client's IdP enforces MFA (skip the portal authenticator code)"
              checked={form.mfaTrusted}
              onChange={(_, d) => set("mfaTrusted", d.checked)}
            />
            <Subtitle2 className={admin.sectionTitle}>Just-in-time access</Subtitle2>
            <Switch
              label="Give portal access on first sign-in to users of these domains"
              checked={form.jitEnabled}
              onChange={(_, d) => set("jitEnabled", d.checked)}
            />
            {form.jitEnabled && (
              <Field label="Default portal permissions" {...fieldProps("jitPermissions")}>
                <div className={styles.checks}>
                  {CLIENT_PORTAL_PERMISSIONS.map((p) => (
                    <Checkbox
                      key={p.key}
                      label={p.label}
                      checked={form.jitPermissions.includes(p.key)}
                      onChange={(_, d) =>
                        set("jitPermissions", d.checked ? [...form.jitPermissions, p.key] : form.jitPermissions.filter((x) => x !== p.key))
                      }
                    />
                  ))}
                </div>
              </Field>
            )}
          </>
        )}
        {step === 2 && idp && (
          <>
            <Warnings codes={idp.warnings} />
            <Body1>Give these values to the client&apos;s identity team, run a test sign-in, then activate.</Body1>
            <CopyField label="Redirect URI" value={idp.redirect_uri} />
            <CopyField label="SP entity ID" value={idp.sp_entity_id} />
            <CopyField label="ACS URL" value={idp.acs_url} />
            {idp.kind === "saml" && (
              <Link href={clientSpMetadataUrl(clientId, idp.id)} target="_blank" rel="noopener">
                Download SP metadata
              </Link>
            )}
            <Body1 className={admin.muted}>
              Status: {idp.status}. The test opens the client&apos;s sign-in page in a new tab and shows how the account would
              resolve, without creating anything.
            </Body1>
          </>
        )}
      </div>
    </DetailsDrawer>
  );
}

/** "Require SSO", approval links and break-glass users. */
function EnforcementCard({ clientId, readOnly }: { clientId: string; readOnly: boolean }) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const settings = useQuery({ queryKey: clientSsoKeys.settings(clientId), queryFn: ({ signal }) => clientSsoApi.settings(clientId, signal) });
  const exemptions = useQuery({
    queryKey: clientSsoKeys.exemptions(clientId),
    queryFn: ({ signal }) => clientSsoApi.exemptions(clientId, signal),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: clientSsoKeys.all(clientId) });
  const saveSettings = useMutation({
    mutationFn: (body: { sso_required?: boolean; approval_links_allowed?: boolean }) => clientSsoApi.saveSettings(clientId, body),
    onSuccess: async (out) => {
      queryClient.setQueryData(clientSsoKeys.settings(clientId), out);
      await refresh();
    },
    onError: (e) => toast.error(clientSsoErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => clientSsoApi.removeExemption(clientId, userId),
    onSuccess: refresh,
    onError: (e) => toast.error(clientSsoErrorMessage(e)),
  });
  const s = settings.data;
  const state = enforcementState(s, exemptions.data?.length ?? 0, saveSettings.isPending || readOnly);

  const requireSwitch = (
    <Switch
      label="Require SSO for this Client"
      checked={s?.sso_required ?? false}
      disabled={state.requireDisabled}
      onChange={(_, d) => saveSettings.mutate({ sso_required: d.checked })}
    />
  );
  const columns: TableColumnDefinition<ClientSsoExemptionOut>[] = [
    createTableColumn({
      columnId: "user",
      renderHeaderCell: () => "Exempt user",
      renderCell: (x) => (
        <span className={admin.cellStack}>
          <span>{x.display_name}</span>
          <span className={admin.muted}>{x.email}</span>
        </span>
      ),
    }),
    createTableColumn({ columnId: "reason", renderHeaderCell: () => "Reason", renderCell: (x) => x.reason }),
    createTableColumn({
      columnId: "mfa",
      renderHeaderCell: () => "Authenticator",
      renderCell: (x) => (
        <Badge appearance="tint" color={x.mfa_enabled ? "success" : "warning"}>
          {x.mfa_enabled ? "Enrolled" : "Enrols at next sign-in"}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (x) =>
        readOnly ? null : (
          <Button size="small" appearance="subtle" disabled={remove.isPending} onClick={() => remove.mutate(x.client_user_id)}>
            Remove
          </Button>
        ),
    }),
  ];

  return (
    <Card className={styles.card}>
      <CardHeader
        image={<ShieldKeyhole20Regular aria-hidden />}
        header={<Subtitle2 as="h2">Enforcement</Subtitle2>}
        description={<Caption1>How this client&apos;s users must sign in to the client portal</Caption1>}
      />
      <div className={styles.cardBody}>
        {settings.error ? <ErrorBar message={clientSsoErrorMessage(settings.error)} /> : null}
        <div className={styles.switchRow}>
          {state.requireTooltip ? (
            <Tooltip content={state.requireTooltip} relationship="description">
              <span>{requireSwitch}</span>
            </Tooltip>
          ) : (
            requireSwitch
          )}
          {state.requireTooltip && <Caption1 className={admin.muted}>{state.requireTooltip}.</Caption1>}
        </div>
        <Switch
          label="Allow approval links by email"
          checked={s?.approval_links_allowed ?? true}
          disabled={!s || saveSettings.isPending || readOnly}
          onChange={(_, d) => saveSettings.mutate({ approval_links_allowed: d.checked })}
        />
        {s && s.warnings.filter((w) => w !== "no_break_glass").length > 0 && (
          <Warnings codes={s.warnings.filter((w) => w !== "no_break_glass")} />
        )}
        {state.showNoBreakGlass && (
          <MessageBar intent="warning" layout="multiline">
            <MessageBarBody>{warningMessage("no_break_glass")} Add at least one exempt user.</MessageBarBody>
          </MessageBar>
        )}
        <Subtitle2 className={admin.sectionTitle}>Break-glass users</Subtitle2>
        <div className={styles.inlineEnd}>
          <Body1 className={admin.muted}>
            Exempt users may still sign in with an emailed link while SSO is required. Exempt users must use an authenticator app
            (TOTP).
          </Body1>
          {!readOnly && (
            <Button icon={<Add20Regular />} onClick={() => setAdding(true)}>
              Add exemption
            </Button>
          )}
        </div>
        <AdminGrid
          items={exemptions.data}
          columns={columns}
          getRowId={(x) => x.client_user_id}
          loading={exemptions.isPending}
          error={exemptions.error}
          emptyText="No exempt users."
          label="Break-glass users"
        />
      </div>
      {adding && (
        <ExemptionDialog
          clientId={clientId}
          exempt={new Set((exemptions.data ?? []).map((x) => x.client_user_id))}
          onClose={() => setAdding(false)}
        />
      )}
    </Card>
  );
}

function ExemptionDialog({ clientId, exempt, onClose }: { clientId: string; exempt: Set<string>; onClose: () => void }) {
  const admin = useAdminStyles();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const users = useQuery({
    queryKey: clientSsoKeys.portalUsers(clientId),
    queryFn: ({ signal }) => clientSsoApi.portalUsers(clientId, signal),
  });
  const options = (users.data ?? []).filter((u) => !exempt.has(u.id) && u.status !== "revoked");
  const reasonError = validateExemptionReason(reason);
  const add = useMutation({
    mutationFn: () => clientSsoApi.addExemption(clientId, { client_user_id: userId ?? "", reason: reason.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: clientSsoKeys.all(clientId) });
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !add.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Exempt a user from SSO</DialogTitle>
          <DialogContent>
            <div className={admin.form}>
              {add.error ? <ErrorBar message={clientSsoErrorMessage(add.error)} /> : null}
              <Field label="Portal user" required>
                <Combobox
                  placeholder={users.isPending ? "Loading…" : "Search portal users"}
                  onOptionSelect={(_, d) => setUserId(d.optionValue ?? null)}
                >
                  {options.map((u) => (
                    <Option key={u.id} value={u.id} text={`${u.display_name} <${u.email}>`}>
                      {`${u.display_name} <${u.email}>`}
                    </Option>
                  ))}
                </Combobox>
              </Field>
              <Field
                label="Reason"
                required
                validationMessage={touched ? reasonError ?? undefined : undefined}
                validationState={touched && reasonError ? "error" : "none"}
              >
                <Textarea
                  value={reason}
                  maxLength={MAX_REASON}
                  onChange={(_, d) => setReason(d.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="Break-glass account for the client's IT admin"
                />
              </Field>
              <Caption1 className={admin.muted}>Exempt users must use an authenticator app (TOTP).</Caption1>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={add.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!userId || add.isPending}
              onClick={() => {
                setTouched(true);
                if (!reasonError) add.mutate();
              }}
            >
              Exempt user
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
