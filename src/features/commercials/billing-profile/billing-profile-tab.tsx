"use client";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Combobox,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Subtitle2,
  Switch,
  type TableColumnDefinition,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Archive20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { DetailsDrawer, ErrorBar, GridSkeleton, IdMultiSelect, IdSelect, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { clientKeys, clientsApi } from "@/features/clients/api";
import { errorMessage, fieldErrors, isApiError } from "@/lib/api/errors";
import { commercialsApi, commercialsKeys } from "../api";
import { gstinRequired, TAX_TREATMENT_LABELS } from "../format";
import type { BillingAddressIn, BillingAddressOut, BillingProfileIn, BillingProfileOut, TaxTreatment } from "../types";
import { GST_STATES } from "./gst-states";

const useStyles = makeStyles({
  layout: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: tokens.spacingHorizontalL, alignItems: "start" },
  card: { padding: tokens.spacingHorizontalL },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacingHorizontalM },
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  bar: { marginBottom: tokens.spacingVerticalM },
});

const EMPTY_PROFILE: BillingProfileIn = {
  legal_name: "",
  pan: null,
  tax_treatment: "registered",
  payment_terms_id: null,
  po_required: false,
  delivery_preference: "email",
  tds_section_code: null,
  tds_rate_pct: null,
  gst_tds_applicable: false,
  preferred_vendor_status: "none",
  msp_name: null,
  vms_name: null,
  vms_reference: null,
};

function toForm(p: BillingProfileOut | null | undefined, fallbackName: string): BillingProfileIn {
  if (!p) return { ...EMPTY_PROFILE, legal_name: fallbackName };
  return {
    legal_name: p.legal_name,
    pan: p.pan ?? null,
    tax_treatment: p.tax_treatment,
    payment_terms_id: p.payment_terms_id ?? null,
    po_required: p.po_required,
    delivery_preference: p.delivery_preference,
    tds_section_code: p.tds_section_code ?? null,
    tds_rate_pct: p.tds_rate_pct ?? null,
    gst_tds_applicable: p.gst_tds_applicable,
    preferred_vendor_status: p.preferred_vendor_status,
    msp_name: p.msp_name ?? null,
    vms_name: p.vms_name ?? null,
    vms_reference: p.vms_reference ?? null,
  };
}

const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** Client 360 "Billing profile" tab (FR-88): profile form, billing addresses and billing contacts. */
export function BillingProfileTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canBilling = usePermission("billing:write");
  const canClient = usePermission("client:update");
  const canWrite = canBilling || canClient;
  const profile = useQuery({
    queryKey: commercialsKeys.billingProfile(clientId),
    queryFn: ({ signal }) => commercialsApi.billingProfile(clientId, signal),
  });
  const terms = useQuery({ queryKey: commercialsKeys.paymentTerms(false), queryFn: ({ signal }) => commercialsApi.paymentTerms(false, signal) });
  const contacts = useQuery({
    queryKey: clientKeys.contactList(clientId, false, 1),
    queryFn: ({ signal }) => clientsApi.listContacts(clientId, false, 1, 100, signal),
  });

  const [form, setForm] = useState<BillingProfileIn>(EMPTY_PROFILE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<BillingAddressOut | "new" | null>(null);
  // Reset the form whenever a new profile arrives (state derived during render, not in an effect).
  const [seen, setSeen] = useState<BillingProfileOut | null | undefined>(undefined);
  if (profile.data !== undefined && profile.data !== seen) {
    setSeen(profile.data);
    setForm(toForm(profile.data, clientName));
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: commercialsKeys.billingProfile(clientId) });
  const save = useMutation({
    mutationFn: () =>
      commercialsApi.putBillingProfile(clientId, {
        ...form,
        pan: blank(form.pan)?.toUpperCase() ?? null,
        tds_section_code: blank(form.tds_section_code),
        tds_rate_pct: blank(form.tds_rate_pct),
        msp_name: blank(form.msp_name),
        vms_name: blank(form.vms_name),
        vms_reference: blank(form.vms_reference),
      }),
    onSuccess: async () => {
      setErrors({});
      toast.success("Billing profile saved");
      await refresh();
    },
    onError: (e) => {
      setErrors(fieldErrors(e));
      toast.error(errorMessage(e));
    },
  });
  const archive = useMutation({
    mutationFn: (a: BillingAddressOut) => commercialsApi.archiveAddress(a.id),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const saveContacts = useMutation({
    mutationFn: (v: { to: string[]; cc: string[] }) => commercialsApi.putBillingContacts(clientId, v.to, v.cc),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  const contactOptions = useMemo(
    () => (contacts.data?.items ?? []).filter((c) => !!c.email).map((c) => ({ id: c.id, label: `${c.name} <${c.email}>` })),
    [contacts.data],
  );

  if (profile.isPending) return <GridSkeleton rows={6} />;
  if (profile.isError) return <ErrorBar title="Could not load the billing profile." message={errorMessage(profile.error)} />;

  const p = profile.data;
  const set = <K extends keyof BillingProfileIn>(key: K, value: BillingProfileIn[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toIds = p?.contacts.filter((c) => c.role === "to").map((c) => c.contact_id) ?? [];
  const ccIds = p?.contacts.filter((c) => c.role === "cc").map((c) => c.contact_id) ?? [];

  const columns: TableColumnDefinition<BillingAddressOut>[] = [
    createTableColumn({
      columnId: "label",
      renderHeaderCell: () => "Address",
      renderCell: (a) => (
        <div className={admin.cellStack}>
          <span>
            {a.label} {a.is_default && <Badge appearance="tint" color="brand">Default</Badge>}{" "}
            {a.is_sez && <Badge appearance="tint" color="informative">SEZ</Badge>}
          </span>
          <span className={admin.muted}>{[a.line1, a.city, a.postal_code, a.country].filter(Boolean).join(", ")}</span>
        </div>
      ),
    }),
    createTableColumn({ columnId: "state", renderHeaderCell: () => "State", renderCell: (a) => GST_STATES.find((s) => s.code === a.state_code)?.name ?? "—" }),
    createTableColumn({ columnId: "gstin", renderHeaderCell: () => "GSTIN", renderCell: (a) => a.gstin ?? "—" }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (a) =>
        canWrite ? (
          <RowActions
            label={a.label}
            actions={[
              { label: "Edit", icon: <Edit20Regular />, onClick: () => setEditing(a) },
              { label: "Archive", icon: <Archive20Regular />, onClick: () => archive.mutate(a) },
            ]}
          />
        ) : null,
    }),
  ];

  return (
    <>
      {!p?.complete && (
        <MessageBar intent="warning" className={styles.bar}>
          <MessageBarBody>Invoices can&apos;t be issued until a billing address exists.</MessageBarBody>
        </MessageBar>
      )}
      <div className={styles.layout}>
        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">Billing profile</Subtitle2>} />
          <fieldset disabled={!canWrite} className={styles.stack} style={{ border: 0, padding: 0, margin: 0 }}>
            <Field label="Legal name" required validationMessage={errors.legal_name}>
              <Input value={form.legal_name} onChange={(_, d) => set("legal_name", d.value)} />
            </Field>
            <div className={styles.row}>
              <Field label="PAN" validationMessage={errors.pan}>
                <Input value={form.pan ?? ""} maxLength={10} onChange={(_, d) => set("pan", d.value.toUpperCase())} />
              </Field>
              <IdSelect
                label="Payment terms"
                options={(terms.data ?? []).map((t) => ({ id: t.id, label: `${t.name} (${t.days} days)` }))}
                value={form.payment_terms_id ?? null}
                noneLabel="Tenant default"
                onChange={(v) => set("payment_terms_id", v)}
              />
            </div>
            <Field label="Tax treatment">
              <RadioGroup layout="horizontal" value={form.tax_treatment} onChange={(_, d) => set("tax_treatment", d.value as TaxTreatment)}>
                {(Object.keys(TAX_TREATMENT_LABELS) as TaxTreatment[]).map((k) => (
                  <Radio key={k} value={k} label={TAX_TREATMENT_LABELS[k]} />
                ))}
              </RadioGroup>
            </Field>
            <div className={styles.row}>
              <Field label="Invoice delivery">
                <Dropdown
                  value={{ email: "Email", portal: "Client portal", email_and_portal: "Email and portal" }[form.delivery_preference]}
                  selectedOptions={[form.delivery_preference]}
                  onOptionSelect={(_, d) => set("delivery_preference", d.optionValue as BillingProfileIn["delivery_preference"])}
                >
                  <Option value="email">Email</Option>
                  <Option value="portal">Client portal</Option>
                  <Option value="email_and_portal">Email and portal</Option>
                </Dropdown>
              </Field>
              <Field label="Preferred vendor status">
                <Dropdown
                  value={{ none: "None", empanelled: "Empanelled", preferred: "Preferred" }[form.preferred_vendor_status]}
                  selectedOptions={[form.preferred_vendor_status]}
                  onOptionSelect={(_, d) => set("preferred_vendor_status", d.optionValue as BillingProfileIn["preferred_vendor_status"])}
                >
                  <Option value="none">None</Option>
                  <Option value="empanelled">Empanelled</Option>
                  <Option value="preferred">Preferred</Option>
                </Dropdown>
              </Field>
            </div>
            <Switch label="PO required on invoices" checked={form.po_required} onChange={(_, d) => set("po_required", d.checked)} />
            <div className={styles.row}>
              <Field label="TDS section" validationMessage={errors.tds_section_code}>
                <Input value={form.tds_section_code ?? ""} placeholder="194J" onChange={(_, d) => set("tds_section_code", d.value)} />
              </Field>
              <Field label="TDS rate %" validationMessage={errors.tds_rate_pct}>
                <Input value={form.tds_rate_pct ?? ""} inputMode="decimal" onChange={(_, d) => set("tds_rate_pct", d.value)} />
              </Field>
            </div>
            <Checkbox label="GST TDS applicable" checked={form.gst_tds_applicable} onChange={(_, d) => set("gst_tds_applicable", !!d.checked)} />
            <div className={styles.row}>
              <Field label="MSP">
                <Input value={form.msp_name ?? ""} onChange={(_, d) => set("msp_name", d.value)} />
              </Field>
              <Field label="VMS">
                <Input value={form.vms_name ?? ""} onChange={(_, d) => set("vms_name", d.value)} />
              </Field>
            </div>
            {canWrite && (
              <div className={admin.footer}>
                <Button appearance="primary" disabled={save.isPending || !form.legal_name.trim()} onClick={() => save.mutate()}>
                  Save profile
                </Button>
              </div>
            )}
          </fieldset>
        </Card>

        <div className={styles.stack}>
          <Card className={styles.card}>
            <CardHeader
              header={<Subtitle2 as="h2">Billing addresses</Subtitle2>}
              action={
                canWrite && p ? (
                  <Button icon={<Add20Regular />} onClick={() => setEditing("new")}>
                    Add address
                  </Button>
                ) : undefined
              }
            />
            {p ? (
              <AdminGrid
                items={p.addresses}
                columns={columns}
                getRowId={(a) => a.id}
                loading={false}
                error={null}
                emptyText="No billing addresses yet."
                label="Billing addresses"
              />
            ) : (
              <span className={admin.muted}>Save the profile first.</span>
            )}
          </Card>
          {p && (
            <Card className={styles.card}>
              <CardHeader header={<Subtitle2 as="h2">Billing contacts</Subtitle2>} />
              <IdMultiSelect
                label="To"
                options={contactOptions}
                value={toIds}
                disabled={!canWrite || saveContacts.isPending}
                onChange={(to) => saveContacts.mutate({ to, cc: ccIds.filter((c) => !to.includes(c)) })}
              />
              <IdMultiSelect
                label="CC"
                options={contactOptions}
                value={ccIds}
                disabled={!canWrite || saveContacts.isPending}
                onChange={(cc) => saveContacts.mutate({ to: toIds.filter((c) => !cc.includes(c)), cc })}
              />
            </Card>
          )}
        </div>
      </div>
      {editing && p && (
        <AddressDrawer
          clientId={clientId}
          taxTreatment={p.tax_treatment}
          address={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}

const EMPTY_ADDRESS: BillingAddressIn = {
  label: "Head office",
  line1: "",
  line2: null,
  city: "",
  state_code: null,
  postal_code: null,
  country: "IN",
  gstin: null,
  is_sez: false,
  is_default: false,
};

function AddressDrawer({
  clientId,
  taxTreatment,
  address,
  onClose,
  onSaved,
}: {
  clientId: string;
  taxTreatment: TaxTreatment;
  address: BillingAddressOut | null;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const admin = useAdminStyles();
  const [form, setForm] = useState<BillingAddressIn>(address ?? EMPTY_ADDRESS);
  const [stateQuery, setStateQuery] = useState(GST_STATES.find((s) => s.code === address?.state_code)?.name ?? "");
  const set = <K extends keyof BillingAddressIn>(key: K, value: BillingAddressIn[K]) => setForm((f) => ({ ...f, [key]: value }));
  const needsGstin = gstinRequired(taxTreatment, form.country);
  const india = form.country.toUpperCase() === "IN";
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, gstin: india ? blank(form.gstin)?.toUpperCase() ?? null : null, state_code: india ? form.state_code : null };
      return address ? commercialsApi.updateAddress(address.id, body) : commercialsApi.addAddress(clientId, body);
    },
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  const errors = fieldErrors(save.error);
  const serverError = save.error && !Object.keys(errors).length ? errorMessage(save.error) : null;
  const gstinError = errors.gstin ?? (isApiError(save.error) && save.error.code.startsWith("gstin") ? errorMessage(save.error) : undefined);
  const filtered = GST_STATES.filter((s) => s.name.toLowerCase().includes(stateQuery.toLowerCase()) || s.code === stateQuery);

  return (
    <DetailsDrawer
      open
      title={address ? "Edit billing address" : "Add billing address"}
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" disabled={save.isPending || !form.line1.trim() || !form.city.trim()} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      }
    >
      <div className={admin.form}>
        <ErrorBar message={gstinError ? null : serverError} />
        <Field label="Label" required>
          <Input value={form.label} onChange={(_, d) => set("label", d.value)} />
        </Field>
        <Field label="Address line 1" required validationMessage={errors.line1}>
          <Input value={form.line1} onChange={(_, d) => set("line1", d.value)} />
        </Field>
        <Field label="Address line 2">
          <Input value={form.line2 ?? ""} onChange={(_, d) => set("line2", d.value)} />
        </Field>
        <Field label="City" required>
          <Input value={form.city} onChange={(_, d) => set("city", d.value)} />
        </Field>
        <Field label="Country (ISO code)" required>
          <Input value={form.country} maxLength={2} onChange={(_, d) => set("country", d.value.toUpperCase())} />
        </Field>
        {india && (
          <Field label="State" required validationMessage={errors.state_code}>
            <Combobox
              value={stateQuery}
              selectedOptions={form.state_code ? [form.state_code] : []}
              onChange={(e) => setStateQuery(e.target.value)}
              onOptionSelect={(_, d) => {
                set("state_code", d.optionValue ?? null);
                setStateQuery(d.optionText ?? "");
              }}
            >
              {filtered.map((s) => (
                <Option key={s.code} value={s.code} text={s.name}>
                  {`${s.name} (${s.code})`}
                </Option>
              ))}
            </Combobox>
          </Field>
        )}
        <Field label="Postal code">
          <Input value={form.postal_code ?? ""} onChange={(_, d) => set("postal_code", d.value)} />
        </Field>
        {india && (
          <Field
            label="GSTIN"
            required={needsGstin}
            hint={needsGstin ? "Required for GST-registered and SEZ clients" : undefined}
            validationState={gstinError ? "error" : "none"}
            validationMessage={gstinError}
          >
            <Input value={form.gstin ?? ""} maxLength={15} onChange={(_, d) => set("gstin", d.value.toUpperCase())} />
          </Field>
        )}
        <Checkbox label="SEZ unit" checked={form.is_sez} onChange={(_, d) => set("is_sez", !!d.checked)} />
        <Checkbox label="Default billing address" checked={form.is_default} onChange={(_, d) => set("is_default", !!d.checked)} />
      </div>
    </DetailsDrawer>
  );
}
