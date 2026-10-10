"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  Combobox,
  createTableColumn,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Subtitle2,
  Switch,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
} from "@fluentui/react-components";
import { Add20Regular, Eye20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { CsrfReloadBanner } from "@/features/access-denied/csrf-reload-banner";
import { useFormDraft } from "@/features/access-denied/use-form-draft";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ConfirmDialog, DetailsDrawer, ErrorBar, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { legalEntitiesApi, legalEntityKeys } from "./api";
import { fiscalYearOf, gstinHint, maskAccount } from "./gstin";
import { DocumentSeriesTab } from "./document-series-tab";
import { ReadinessBanner } from "./readiness-banner";
import type { BankAccountOut, GstRegistrationOut, LegalEntityOut } from "./types";

type TabKey = "profile" | "gst" | "bank" | "numbering" | "danger";

/** `/settings/legal-entities/[id]`: Profile, GST registrations, Bank accounts and Danger zone tabs. */
export function LegalEntityDetail({ id }: { id: string }) {
  const canRead = usePermission("legal_entity:read");
  const [tab, setTab] = useState<TabKey>("profile");
  const entity = useQuery({ queryKey: legalEntityKeys.detail(id), queryFn: ({ signal }) => legalEntitiesApi.get(id, signal), enabled: canRead });
  if (!canRead) return <NoAccess what="legal entities" />;
  if (entity.error) return <ErrorBar title="Could not load the legal entity." message={errorMessage(entity.error)} />;
  const e = entity.data;
  return (
    <>
      <PageHeader
        title={e?.name ?? "Legal entity"}
        subtitle={
          e && (
            <Badge appearance="tint" color={e.status === "active" ? "success" : "subtle"}>
              {e.status === "active" ? "Active" : "Inactive"}
            </Badge>
          )
        }
      />
      <ReadinessBanner legalEntityId={id} />
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as TabKey)} style={{ marginBlock: 12 }}>
        <Tab value="profile">Profile</Tab>
        <Tab value="gst">GST registrations</Tab>
        <Tab value="bank">Bank accounts</Tab>
        <Tab value="numbering">Document numbering</Tab>
        <Tab value="danger">Danger zone</Tab>
      </TabList>
      {e && tab === "profile" && <ProfileTab entity={e} />}
      {e && tab === "gst" && <GstTab entity={e} />}
      {e && tab === "bank" && <BankTab entity={e} />}
      {e && tab === "numbering" && <DocumentSeriesTab entity={e} />}
      {e && tab === "danger" && <DangerTab entity={e} />}
    </>
  );
}

function useInvalidate(id: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: legalEntityKeys.detail(id) }),
      queryClient.invalidateQueries({ queryKey: legalEntityKeys.readiness(id) }),
      queryClient.invalidateQueries({ queryKey: legalEntityKeys.list }),
    ]);
}

type ProfileValues = {
  name: string;
  legal_name: string;
  pan: string;
  cin: string;
  line1: string;
  city: string;
  postal_code: string;
  state_code: string;
  country: string;
  default_currency: string;
  timezone: string;
  signatory_name: string;
  signatory_title: string;
};

function profileOf(e: LegalEntityOut): ProfileValues {
  const address = e.address as Record<string, string | undefined>;
  return {
    name: e.name,
    legal_name: e.legal_name,
    pan: e.pan ?? "",
    cin: e.cin ?? "",
    line1: address.line1 ?? "",
    city: address.city ?? "",
    postal_code: address.postal_code ?? "",
    state_code: e.state_code ?? "",
    country: e.country,
    default_currency: e.default_currency,
    timezone: e.timezone,
    signatory_name: e.signatory_name ?? "",
    signatory_title: e.signatory_title ?? "",
  };
}

function ProfileTab({ entity }: { entity: LegalEntityOut }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const canWrite = usePermission("legal_entity:write");
  const invalidate = useInvalidate(entity.id);
  const [values, setValues] = useState<ProfileValues>(() => profileOf(entity));
  const { saveAndReload } = useFormDraft<ProfileValues>(`legal-entity:${entity.id}`, setValues);
  const states = useQuery({ queryKey: legalEntityKeys.states, queryFn: ({ signal }) => legalEntitiesApi.states(signal) });
  const currencies = useQuery({ queryKey: legalEntityKeys.currencies, queryFn: ({ signal }) => legalEntitiesApi.currencies(signal) });
  const set = (key: keyof ProfileValues) => (_: unknown, d: { value: string }) => setValues((v) => ({ ...v, [key]: d.value }));
  const save = useMutation({
    mutationFn: () =>
      legalEntitiesApi.update(entity.id, {
        name: values.name.trim(),
        legal_name: values.legal_name.trim(),
        pan: values.pan.trim().toUpperCase() || null,
        cin: values.cin.trim() || null,
        address: { line1: values.line1, city: values.city, postal_code: values.postal_code },
        state_code: values.state_code || null,
        country: values.country,
        default_currency: values.default_currency,
        timezone: values.timezone,
        signatory_name: values.signatory_name.trim() || null,
        signatory_title: values.signatory_title.trim() || null,
      }),
    onSuccess: async () => {
      toast.success("Legal entity saved");
      await invalidate();
    },
  });
  const errors = fieldErrors(save.error);
  const logo = useMutation({
    mutationFn: (file: File) => legalEntitiesApi.uploadLogo(entity.id, file),
    onSuccess: async () => {
      toast.success("Logo uploaded");
      await invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const stateName = states.data?.find((s) => s.code === values.state_code)?.name ?? values.state_code;
  return (
    <Card style={{ maxWidth: 760 }}>
      <div className={admin.form}>
        <CsrfReloadBanner error={save.error} onReload={() => saveAndReload(values)} />
        {save.error && !Object.keys(errors).length ? <ErrorBar message={errorMessage(save.error)} /> : null}
        <Field label="Name" required validationMessage={errors.name}>
          <Input value={values.name} onChange={set("name")} disabled={!canWrite} />
        </Field>
        <Field label="Registered legal name" required validationMessage={errors.legal_name}>
          <Input value={values.legal_name} onChange={set("legal_name")} disabled={!canWrite} />
        </Field>
        <Field label="PAN" validationMessage={errors.pan ?? (save.error && "code" in save.error && (save.error as { code: string }).code === "pan_mismatch" ? errorMessage(save.error) : undefined)}>
          <Input value={values.pan} onChange={set("pan")} disabled={!canWrite} placeholder="ABCDE1234F" />
        </Field>
        <Field label="CIN">
          <Input value={values.cin} onChange={set("cin")} disabled={!canWrite} />
        </Field>
        <Subtitle2 className={admin.sectionTitle}>Registered address</Subtitle2>
        <Field label="Address line">
          <Input value={values.line1} onChange={set("line1")} disabled={!canWrite} />
        </Field>
        <Field label="City">
          <Input value={values.city} onChange={set("city")} disabled={!canWrite} />
        </Field>
        <Field label="PIN code">
          <Input value={values.postal_code} onChange={set("postal_code")} disabled={!canWrite} />
        </Field>
        <Field label="State" hint="Locked once invoices exist">
          <Combobox
            value={stateName}
            selectedOptions={values.state_code ? [values.state_code] : []}
            onOptionSelect={(_, d) => setValues((v) => ({ ...v, state_code: d.optionValue ?? "" }))}
            disabled={!canWrite}
            placeholder="Choose a state"
          >
            {(states.data ?? []).map((s) => (
              <Option key={s.code} value={s.code} text={s.name}>
                {`${s.name} (${s.code})`}
              </Option>
            ))}
          </Combobox>
        </Field>
        <Field label="Country">
          <Input value={values.country} onChange={set("country")} disabled={!canWrite} maxLength={2} />
        </Field>
        <Field label="Currency">
          <Combobox
            value={values.default_currency}
            selectedOptions={[values.default_currency]}
            onOptionSelect={(_, d) => setValues((v) => ({ ...v, default_currency: d.optionValue ?? v.default_currency }))}
            disabled={!canWrite}
          >
            {(currencies.data ?? [])
              .filter((c) => c.document_allowed)
              .map((c) => (
                <Option key={c.code} value={c.code} text={c.code}>
                  {`${c.code} — ${c.name}`}
                </Option>
              ))}
          </Combobox>
        </Field>
        <Field label="Time zone">
          <Input value={values.timezone} onChange={set("timezone")} disabled={!canWrite} />
        </Field>
        <Subtitle2 className={admin.sectionTitle}>Authorised signatory</Subtitle2>
        <Field label="Name">
          <Input value={values.signatory_name} onChange={set("signatory_name")} disabled={!canWrite} />
        </Field>
        <Field label="Title">
          <Input value={values.signatory_title} onChange={set("signatory_title")} disabled={!canWrite} />
        </Field>
        <Field label="Logo" hint="PNG or JPEG, up to 1 MB">
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={!canWrite || logo.isPending}
            onChange={(ev) => {
              const file = ev.target.files?.[0];
              if (file) logo.mutate(file);
            }}
          />
        </Field>
        {entity.logo_file_id && <Text className={admin.muted}>A logo is set.</Text>}
        {canWrite && (
          <div className={admin.footer}>
            <Button appearance="primary" disabled={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function GstTab({ entity }: { entity: LegalEntityOut }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canWrite = usePermission("legal_entity:write");
  const invalidate = useInvalidate(entity.id);
  const [open, setOpen] = useState(false);
  const [gstin, setGstin] = useState("");
  const [stateCode, setStateCode] = useState(entity.state_code ?? "");
  const [einvoice, setEinvoice] = useState(false);
  const [lutFor, setLutFor] = useState<GstRegistrationOut | null>(null);
  const list = useQuery({ queryKey: legalEntityKeys.registrations(entity.id), queryFn: ({ signal }) => legalEntitiesApi.registrations(entity.id, signal) });
  const states = useQuery({ queryKey: legalEntityKeys.states, queryFn: ({ signal }) => legalEntitiesApi.states(signal) });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: legalEntityKeys.registrations(entity.id) });
    await invalidate();
  };
  const create = useMutation({
    mutationFn: () => legalEntitiesApi.createRegistration(entity.id, { gstin: gstin.trim().toUpperCase(), state_code: stateCode, einvoice_applicable: einvoice }),
    onSuccess: async () => {
      setOpen(false);
      setGstin("");
      await refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: (r: GstRegistrationOut) => legalEntitiesApi.setRegistrationActive(r.id, r.status !== "active"),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const principal = useMutation({
    mutationFn: (r: GstRegistrationOut) => legalEntitiesApi.updateRegistration(r.id, { is_principal: true }),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const hint = gstinHint(gstin, { stateCode, pan: entity.pan });
  const columns: TableColumnDefinition<GstRegistrationOut>[] = [
    createTableColumn({
      columnId: "gstin",
      renderHeaderCell: () => "GSTIN",
      renderCell: (r) => (
        <span className={admin.badges}>
          {r.gstin}
          {r.is_principal && <Badge appearance="tint" color="brand">Principal</Badge>}
        </span>
      ),
    }),
    createTableColumn({ columnId: "state", renderHeaderCell: () => "State", renderCell: (r) => states.data?.find((s) => s.code === r.state_code)?.name ?? r.state_code }),
    createTableColumn({ columnId: "einv", renderHeaderCell: () => "E-invoicing", renderCell: (r) => (r.einvoice_applicable ? "Applicable" : "—") }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => <Badge appearance="tint" color={r.status === "active" ? "success" : "subtle"}>{r.status === "active" ? "Active" : "Inactive"}</Badge>,
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (r) =>
        canWrite ? (
          <RowActions
            label={r.gstin}
            actions={[
              { label: "LUT by financial year", onClick: () => setLutFor(r) },
              ...(r.status === "active" && !r.is_principal ? [{ label: "Make principal", onClick: () => principal.mutate(r) }] : []),
              { label: r.status === "active" ? "Deactivate" : "Reactivate", onClick: () => toggle.mutate(r) },
            ]}
          />
        ) : null,
    }),
  ];
  return (
    <>
      <div className={admin.toolbar}>
        {canWrite && (
          <Button icon={<Add20Regular />} onClick={() => setOpen(true)}>
            Add GST registration
          </Button>
        )}
      </div>
      <AdminGrid items={list.data} columns={columns} getRowId={(r) => r.id} loading={list.isPending} error={list.error} emptyText="No GST registrations yet." label="GST registrations" />
      <DetailsDrawer
        open={open}
        title="Add GST registration"
        onClose={() => setOpen(false)}
        footer={
          <div className={admin.footer}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button appearance="primary" disabled={!gstin || !stateCode || create.isPending} onClick={() => create.mutate()}>
              Add
            </Button>
          </div>
        }
      >
        <div className={admin.form}>
          {create.error ? <ErrorBar message={errorMessage(create.error)} /> : null}
          <Field label="State" required>
            <Combobox
              value={states.data?.find((s) => s.code === stateCode)?.name ?? stateCode}
              selectedOptions={stateCode ? [stateCode] : []}
              onOptionSelect={(_, d) => setStateCode(d.optionValue ?? "")}
            >
              {(states.data ?? []).map((s) => (
                <Option key={s.code} value={s.code} text={s.name}>
                  {`${s.name} (${s.code})`}
                </Option>
              ))}
            </Combobox>
          </Field>
          <Field
            label="GSTIN"
            required
            validationState={hint ? "warning" : gstin.length === 15 ? "success" : "none"}
            validationMessage={hint ?? (gstin.length === 15 ? "Looks valid — the server checks it on save." : undefined)}
          >
            <Input value={gstin} onChange={(_, d) => setGstin(d.value.toUpperCase())} maxLength={15} />
          </Field>
          <Switch label="E-invoicing applicable" checked={einvoice} onChange={(_, d) => setEinvoice(d.checked)} />
        </div>
      </DetailsDrawer>
      {lutFor && <LutDrawer registration={lutFor} onClose={() => setLutFor(null)} />}
    </>
  );
}

function LutDrawer({ registration, onClose }: { registration: GstRegistrationOut; onClose: () => void }) {
  const admin = useAdminStyles();
  const queryClient = useQueryClient();
  const fy = fiscalYearOf(new Date());
  const [fiscalYear, setFiscalYear] = useState(fy);
  const [lut, setLut] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const luts = useQuery({ queryKey: legalEntityKeys.luts(registration.id), queryFn: ({ signal }) => legalEntitiesApi.luts(registration.id, signal) });
  const put = useMutation({
    mutationFn: () => legalEntitiesApi.putLut(registration.id, fiscalYear, { lut_number: lut.trim(), valid_from: from, valid_to: to }),
    onSuccess: async () => {
      setLut("");
      await queryClient.invalidateQueries({ queryKey: legalEntityKeys.luts(registration.id) });
    },
  });
  return (
    <DetailsDrawer open title={`LUT — ${registration.gstin}`} onClose={onClose}>
      <div className={admin.form}>
        {(luts.data ?? []).map((l) => (
          <Body1 key={l.id}>
            FY {l.fiscal_year}: {l.lut_number} ({l.valid_from} → {l.valid_to})
          </Body1>
        ))}
        {put.error ? <ErrorBar message={errorMessage(put.error)} /> : null}
        <Field label="Financial year" hint="e.g. 26-27">
          <Input value={fiscalYear} onChange={(_, d) => setFiscalYear(d.value)} />
        </Field>
        <Field label="LUT number">
          <Input value={lut} onChange={(_, d) => setLut(d.value)} />
        </Field>
        <Field label="Valid from">
          <Input type="date" value={from} onChange={(_, d) => setFrom(d.value)} />
        </Field>
        <Field label="Valid to">
          <Input type="date" value={to} onChange={(_, d) => setTo(d.value)} />
        </Field>
        <div className={admin.footer}>
          <Button appearance="primary" disabled={!lut || !from || !to || put.isPending} onClick={() => put.mutate()}>
            Save LUT
          </Button>
        </div>
      </div>
    </DetailsDrawer>
  );
}

function BankTab({ entity }: { entity: LegalEntityOut }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canWrite = usePermission("legal_entity:write");
  const canUnmask = usePermission("identity:view");
  const invalidate = useInvalidate(entity.id);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", bank_name: "", account_number: "", ifsc: "", branch: "", account_name: "", currency: entity.default_currency });
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const list = useQuery({ queryKey: legalEntityKeys.bankAccounts(entity.id), queryFn: ({ signal }) => legalEntitiesApi.bankAccounts(entity.id, signal) });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: legalEntityKeys.bankAccounts(entity.id) });
    await invalidate();
  };
  const create = useMutation({
    mutationFn: () =>
      legalEntitiesApi.createBankAccount(entity.id, {
        label: form.label.trim(),
        bank_name: form.bank_name.trim(),
        account_number: form.account_number.trim(),
        ifsc: form.ifsc.trim().toUpperCase() || null,
        branch: form.branch.trim() || null,
        account_name: form.account_name.trim() || null,
        currency: form.currency || null,
      }),
    onSuccess: async () => {
      setOpen(false);
      setForm((f) => ({ ...f, label: "", bank_name: "", account_number: "", ifsc: "", branch: "", account_name: "" }));
      await refresh();
    },
  });
  const update = useMutation({
    mutationFn: (v: { a: BankAccountOut; body: { is_default?: boolean; archived?: boolean } }) => legalEntitiesApi.updateBankAccount(v.a.id, v.body),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const unmask = useMutation({
    mutationFn: (a: BankAccountOut) => legalEntitiesApi.unmask(a.id),
    onSuccess: (out) => setRevealed((r) => ({ ...r, [out.id]: out.account_number })),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const field = (key: keyof typeof form) => (_: unknown, d: { value: string }) => setForm((f) => ({ ...f, [key]: d.value }));
  const columns: TableColumnDefinition<BankAccountOut>[] = [
    createTableColumn({
      columnId: "label",
      renderHeaderCell: () => "Account",
      renderCell: (a) => (
        <span className={admin.badges}>
          {a.label}
          {a.is_default && <Badge appearance="tint" color="brand">Default</Badge>}
          {a.archived_at && <Badge appearance="tint" color="subtle">Archived</Badge>}
        </span>
      ),
    }),
    createTableColumn({ columnId: "bank", renderHeaderCell: () => "Bank", renderCell: (a) => `${a.bank_name}${a.branch ? ` · ${a.branch}` : ""}` }),
    createTableColumn({
      columnId: "number",
      renderHeaderCell: () => "Number",
      renderCell: (a) => (
        <span className={admin.badges}>
          <span>{revealed[a.id] ?? maskAccount(a.account_number_last4)}</span>
          {canUnmask && !revealed[a.id] && (
            <Button size="small" appearance="subtle" icon={<Eye20Regular />} onClick={() => unmask.mutate(a)} aria-label={`Unmask ${a.label}`}>
              Unmask
            </Button>
          )}
        </span>
      ),
    }),
    createTableColumn({ columnId: "ifsc", renderHeaderCell: () => "IFSC", renderCell: (a) => a.ifsc ?? "—" }),
    createTableColumn({ columnId: "currency", renderHeaderCell: () => "Currency", renderCell: (a) => a.currency ?? "Any" }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (a) =>
        canWrite ? (
          <RowActions
            label={a.label}
            actions={[
              ...(!a.is_default && !a.archived_at ? [{ label: "Make default", onClick: () => update.mutate({ a, body: { is_default: true } }) }] : []),
              { label: a.archived_at ? "Restore" : "Archive", onClick: () => update.mutate({ a, body: { archived: !a.archived_at } }) },
            ]}
          />
        ) : null,
    }),
  ];
  return (
    <>
      <div className={admin.toolbar}>
        {canWrite && (
          <Button icon={<Add20Regular />} onClick={() => setOpen(true)}>
            Add bank account
          </Button>
        )}
      </div>
      <AdminGrid items={list.data} columns={columns} getRowId={(a) => a.id} loading={list.isPending} error={list.error} emptyText="No bank accounts yet." label="Bank accounts" />
      <DetailsDrawer
        open={open}
        title="Add bank account"
        onClose={() => setOpen(false)}
        footer={
          <div className={admin.footer}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button appearance="primary" disabled={!form.label || !form.bank_name || form.account_number.length < 4 || create.isPending} onClick={() => create.mutate()}>
              Add
            </Button>
          </div>
        }
      >
        <div className={admin.form}>
          {create.error ? <ErrorBar message={errorMessage(create.error)} /> : null}
          <Field label="Label" required>
            <Input value={form.label} onChange={field("label")} placeholder="Main INR account" />
          </Field>
          <Field label="Bank" required>
            <Input value={form.bank_name} onChange={field("bank_name")} />
          </Field>
          <Field label="Branch">
            <Input value={form.branch} onChange={field("branch")} />
          </Field>
          <Field label="Account name">
            <Input value={form.account_name} onChange={field("account_name")} />
          </Field>
          <Field label="Account number" required hint="Stored encrypted; only the last four digits are shown">
            <Input value={form.account_number} onChange={field("account_number")} />
          </Field>
          <Field label="IFSC">
            <Input value={form.ifsc} onChange={field("ifsc")} placeholder="HDFC0001234" />
          </Field>
          <Field label="Currency" hint="One default account per currency">
            <Input value={form.currency} onChange={field("currency")} maxLength={3} />
          </Field>
        </div>
      </DetailsDrawer>
    </>
  );
}

function DangerTab({ entity }: { entity: LegalEntityOut }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const router = useRouter();
  const canWrite = usePermission("legal_entity:write");
  const invalidate = useInvalidate(entity.id);
  const [confirm, setConfirm] = useState<"deactivate" | "reactivate" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const run = async () => {
    try {
      if (confirm === "deactivate") await legalEntitiesApi.deactivate(entity.id, reason);
      if (confirm === "reactivate") await legalEntitiesApi.reactivate(entity.id);
      if (confirm === "delete") {
        await legalEntitiesApi.remove(entity.id);
        router.push("/settings/legal-entities");
        return;
      }
      await invalidate();
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  };
  if (!canWrite) return <NoAccess what="the danger zone of this legal entity" />;
  return (
    <Card style={{ maxWidth: 760 }}>
      <div className={admin.form}>
        {entity.status === "active" ? (
          <>
            <Body1>Deactivating stops new contracts, placements and invoices for this entity. Existing documents stay.</Body1>
            <Field label="Reason">
              <Input value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
            <div>
              <Button onClick={() => setConfirm("deactivate")}>Deactivate</Button>
            </div>
          </>
        ) : (
          <>
            {entity.deactivation_reason && (
              <MessageBar intent="info">
                <MessageBarBody>Deactivated: {entity.deactivation_reason}</MessageBarBody>
              </MessageBar>
            )}
            <div>
              <Button onClick={() => setConfirm("reactivate")}>Reactivate</Button>
            </div>
          </>
        )}
        <Body1>Delete is only possible while no placement, contract, invoice or pay period uses the entity.</Body1>
        <div>
          <Button appearance="primary" onClick={() => setConfirm("delete")}>
            Delete legal entity
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "delete" ? "Delete legal entity?" : confirm === "deactivate" ? "Deactivate legal entity?" : "Reactivate legal entity?"}
        confirmLabel={confirm === "delete" ? "Delete" : confirm === "deactivate" ? "Deactivate" : "Reactivate"}
        onConfirm={run}
        onClose={() => setConfirm(null)}
      >
        {confirm === "delete" ? `"${entity.name}" will be removed permanently.` : `"${entity.name}" will be ${confirm}d.`}
      </ConfirmDialog>
    </Card>
  );
}
