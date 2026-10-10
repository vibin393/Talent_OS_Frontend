"use client";

import {
  Button,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Option,
  SpinButton,
  Spinner,
  Subtitle2,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useEffect, useReducer, useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { PersonPicker } from "@/features/activity/person-picker";
import { DetailsDrawer, ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { errorMessage, fieldErrors, isApiError } from "@/lib/api/errors";
import { crmApi } from "../api";
import type { EstimatedRole, LeadFields, LeadOut } from "../types";
import { useLeadMutations, useLeadSources } from "../use-leads";
import { rolesOf } from "./convert-logic";
import {
  acknowledgeFlag,
  DUPLICATE_DEBOUNCE_MS,
  DUPLICATE_REASON_LABELS,
  duplicateMatchesFromError,
  duplicateReducer,
  matchHref,
  needsAcknowledgement,
  NO_DUPLICATES,
  shouldCheckDuplicates,
} from "./duplicates";

const useStyles = makeStyles({
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 120px auto",
    gap: tokens.spacingHorizontalS,
    alignItems: "end",
  },
  two: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacingHorizontalM },
  matches: { margin: 0, paddingLeft: tokens.spacingHorizontalL },
});

type Draft = {
  company_name: string;
  website: string;
  gstin: string;
  industry: string;
  location: string;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_phone: string;
  source_code: string | null;
  expected_annual_revenue: string;
  currency: string;
  owner_id: string | null;
  owner_name: string;
  roles: EstimatedRole[];
};

function draftOf(lead?: LeadOut | null): Draft {
  return {
    company_name: lead?.company_name ?? "",
    website: lead?.website ?? "",
    gstin: lead?.gstin ?? "",
    industry: lead?.industry ?? "",
    location: lead?.location ?? "",
    contact_name: lead?.contact_name ?? "",
    contact_title: lead?.contact_title ?? "",
    contact_email: lead?.contact_email ?? "",
    contact_phone: lead?.contact_phone ?? "",
    source_code: lead?.source_code ?? null,
    expected_annual_revenue: lead?.expected_annual_revenue ?? "",
    currency: lead?.currency ?? "INR",
    owner_id: lead?.owner_id ?? null,
    owner_name: lead?.owner?.name ?? "",
    roles: lead ? rolesOf(lead) : [],
  };
}

function toBody(d: Draft): LeadFields & { company_name: string } {
  const roles = d.roles.filter((r) => r.title.trim()).map((r) => ({ title: r.title.trim(), positions: r.positions }));
  return {
    company_name: d.company_name.trim(),
    website: d.website.trim() || null,
    gstin: d.gstin.trim() || null,
    industry: d.industry.trim() || null,
    location: d.location.trim() || null,
    contact_name: d.contact_name.trim() || null,
    contact_title: d.contact_title.trim() || null,
    contact_email: d.contact_email.trim() || null,
    contact_phone: d.contact_phone.trim() || null,
    source_code: d.source_code,
    estimated_roles: roles,
    estimated_positions: roles.length ? roles.reduce((n, r) => n + r.positions, 0) : null,
    expected_annual_revenue: d.expected_annual_revenue.trim() || null,
    currency: d.currency.trim() || null,
    ...(d.owner_id ? { owner_id: d.owner_id } : {}),
  };
}

/** New / edit lead `OverlayDrawer` with a debounced duplicate check and "Save anyway". */
export function LeadDrawer({ lead, onClose, onSaved }: { lead?: LeadOut | null; onClose: () => void; onSaved?: (l: LeadOut) => void }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const sources = useLeadSources();
  const { create, update } = useLeadMutations();
  const [draft, setDraft] = useState<Draft>(() => draftOf(lead));
  const [dups, dispatch] = useReducer(duplicateReducer, NO_DUPLICATES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const busy = create.isPending || update.isPending;

  // Debounced live duplicate check on company / website / GSTIN.
  const { company_name, website, gstin } = draft;
  useEffect(() => {
    if (!shouldCheckDuplicates(company_name, website, gstin)) {
      dispatch({ type: "checked", matches: [] });
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      crmApi
        .duplicateCheck(
          { company_name: company_name.trim(), website: website.trim() || null, gstin: gstin.trim() || null, exclude_lead_id: lead?.id ?? null },
          ctrl.signal,
        )
        .then((matches) => dispatch({ type: "checked", matches }))
        .catch(() => undefined);
    }, DUPLICATE_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [company_name, website, gstin, lead?.id]);

  async function save(acknowledge: boolean) {
    setFormError(null);
    if (!draft.company_name.trim()) {
      setErrors({ company_name: "Company name is required." });
      return;
    }
    setErrors({});
    try {
      const body = { ...toBody(draft), acknowledge_duplicates: acknowledge };
      const saved = lead ? await update.mutateAsync({ id: lead.id, body }) : await create.mutateAsync(body);
      toast.success(lead ? `Saved ${saved.company_name}` : `Created lead ${saved.human_id}`);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      const matches = duplicateMatchesFromError(e);
      if (matches) {
        dispatch({ type: "conflict", matches });
        return;
      }
      if (isApiError(e) && e.status === 422) {
        const f = fieldErrors(e);
        if (Object.keys(f).length) {
          setErrors(f);
          return;
        }
      }
      setFormError(errorMessage(e));
    }
  }

  const err = (k: string) => (errors[k] ? { validationState: "error" as const, validationMessage: errors[k] } : {});
  const sourceOptions = (sources.data ?? []).filter((s) => !s.archived_at || s.code === draft.source_code);

  return (
    <DetailsDrawer
      open
      size="medium"
      title={lead ? `Edit ${lead.human_id}` : "New lead"}
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button
            appearance="primary"
            disabled={busy}
            icon={busy ? <Spinner size="tiny" /> : undefined}
            onClick={() => save(acknowledgeFlag(dups))}
          >
            {lead ? "Save changes" : "Create lead"}
          </Button>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </div>
      }
    >
      <form
        className={admin.form}
        onSubmit={(e) => {
          e.preventDefault();
          void save(acknowledgeFlag(dups));
        }}
      >
        {formError && <ErrorBar message={formError} />}
        {dups.matches.length > 0 && (
          <MessageBar intent="warning" layout="multiline">
            <MessageBarBody>
              <MessageBarTitle>Possible duplicates</MessageBarTitle>
              <ul className={styles.matches}>
                {dups.matches.map((m) => (
                  <li key={`${m.kind}:${m.id}`}>
                    <AppLink href={matchHref(m)}>
                      {m.kind === "client" ? "Client" : "Lead"} {m.human_id ? `${m.human_id} ` : ""}
                      {m.name}
                    </AppLink>{" "}
                    ({DUPLICATE_REASON_LABELS[m.reason]})
                  </li>
                ))}
              </ul>
              {dups.acknowledged && "You chose to save anyway."}
            </MessageBarBody>
            {needsAcknowledgement(dups) && (
              <MessageBarActions>
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() => {
                    dispatch({ type: "acknowledge" });
                    void save(true);
                  }}
                >
                  Save anyway
                </Button>
              </MessageBarActions>
            )}
          </MessageBar>
        )}
        <Field label="Company" required {...err("company_name")}>
          <Input value={draft.company_name} maxLength={200} onChange={(_, d) => set({ company_name: d.value })} />
        </Field>
        <div className={styles.two}>
          <Field label="Website" {...err("website")}>
            <Input value={draft.website} maxLength={500} onChange={(_, d) => set({ website: d.value })} />
          </Field>
          <Field label="GSTIN" {...err("gstin")}>
            <Input value={draft.gstin} maxLength={20} onChange={(_, d) => set({ gstin: d.value })} />
          </Field>
          <Field label="Industry">
            <Input value={draft.industry} maxLength={200} onChange={(_, d) => set({ industry: d.value })} />
          </Field>
          <Field label="Location">
            <Input value={draft.location} maxLength={300} onChange={(_, d) => set({ location: d.value })} />
          </Field>
        </div>
        <Subtitle2 as="h3" className={admin.sectionTitle}>
          Contact
        </Subtitle2>
        <div className={styles.two}>
          <Field label="Name">
            <Input value={draft.contact_name} maxLength={200} onChange={(_, d) => set({ contact_name: d.value })} />
          </Field>
          <Field label="Title">
            <Input value={draft.contact_title} maxLength={200} onChange={(_, d) => set({ contact_title: d.value })} />
          </Field>
          <Field label="Email" {...err("contact_email")}>
            <Input type="email" value={draft.contact_email} onChange={(_, d) => set({ contact_email: d.value })} />
          </Field>
          <Field label="Phone" {...err("contact_phone")}>
            <Input type="tel" value={draft.contact_phone} maxLength={40} onChange={(_, d) => set({ contact_phone: d.value })} />
          </Field>
        </div>
        <Subtitle2 as="h3" className={admin.sectionTitle}>
          Opportunity size
        </Subtitle2>
        <div className={styles.two}>
          <Field label="Source">
            <Dropdown
              placeholder="Choose a source"
              value={sourceOptions.find((s) => s.code === draft.source_code)?.label ?? ""}
              selectedOptions={draft.source_code ? [draft.source_code] : []}
              onOptionSelect={(_, d) => set({ source_code: d.optionValue ?? null })}
            >
              {sourceOptions.map((s) => (
                <Option key={s.id} value={s.code}>
                  {s.label}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <PersonPicker
            label="Owner"
            value={draft.owner_id}
            valueLabel={draft.owner_name}
            placeholder="Me"
            onChange={(p) => set({ owner_id: p?.id ?? null, owner_name: p?.name ?? "" })}
          />
          <Field label="Expected annual revenue" {...err("expected_annual_revenue")}>
            <Input
              inputMode="decimal"
              value={draft.expected_annual_revenue}
              onChange={(_, d) => set({ expected_annual_revenue: d.value })}
            />
          </Field>
          <Field label="Currency" {...err("currency")}>
            <Input value={draft.currency} maxLength={3} onChange={(_, d) => set({ currency: d.value.toUpperCase() })} />
          </Field>
        </div>
        <Subtitle2 as="h3" className={admin.sectionTitle}>
          Estimated roles
        </Subtitle2>
        {draft.roles.map((r, i) => (
          <div key={i} className={styles.row}>
            <Field label={i === 0 ? "Role" : undefined}>
              <Input
                aria-label={`Role ${i + 1}`}
                value={r.title}
                maxLength={200}
                onChange={(_, d) => set({ roles: draft.roles.map((x, j) => (j === i ? { ...x, title: d.value } : x)) })}
              />
            </Field>
            <Field label={i === 0 ? "Positions" : undefined}>
              <SpinButton
                aria-label={`Positions for role ${i + 1}`}
                min={1}
                max={10000}
                value={r.positions}
                onChange={(_, d) => {
                  const v = d.value ?? Number(d.displayValue);
                  if (Number.isFinite(v) && v >= 1)
                    set({ roles: draft.roles.map((x, j) => (j === i ? { ...x, positions: Math.round(v as number) } : x)) });
                }}
              />
            </Field>
            <Button
              appearance="subtle"
              icon={<Delete20Regular />}
              aria-label={`Remove role ${i + 1}`}
              onClick={() => set({ roles: draft.roles.filter((_, j) => j !== i) })}
            />
          </div>
        ))}
        <div>
          <Button
            icon={<Add20Regular />}
            disabled={draft.roles.length >= 50}
            onClick={() => set({ roles: [...draft.roles, { title: "", positions: 1 }] })}
          >
            Add role
          </Button>
        </div>
      </form>
    </DetailsDrawer>
  );
}
