"use client";

import { Button, Dropdown, Field, Input, Option, Radio, RadioGroup } from "@fluentui/react-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DetailsDrawer, ErrorBar, IdSelect, useAdminStyles } from "@/features/admin/ui";
import { clientKeys, clientsApi } from "@/features/clients/api";
import { DEFAULT_CLIENT_SORT, EMPTY_CLIENT_FILTERS } from "@/features/clients/query";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { commercialsApi, commercialsKeys } from "../api";
import { CONTRACT_TYPE_LABELS } from "../format";
import { PRICING_MODEL_LABELS, PRICING_MODELS, valueCapLabel } from "../sow";
import type { ContractCreate, ContractOut, ContractType, PricingModel } from "../types";

const TYPES: ContractType[] = ["msa", "sow", "amendment"];
const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** Create-contract `OverlayDrawer` with type-driven fields (SOW / amendment need a parent; amendments may
 * extend the parent's end date). */
export function ContractDrawer({
  clientId,
  onClose,
  onCreated,
}: {
  clientId?: string;
  onClose: () => void;
  onCreated: (c: ContractOut) => void;
}) {
  const admin = useAdminStyles();
  const [form, setForm] = useState<ContractCreate>({
    contract_type: "msa",
    client_id: clientId ?? null,
    legal_entity_id: "",
    title: "",
    start_date: "",
    end_date: null,
    currency: "INR",
  });
  const set = <K extends keyof ContractCreate>(key: K, value: ContractCreate[K]) => setForm((f) => ({ ...f, [key]: value }));
  const clients = useQuery({
    queryKey: [...clientKeys.lists, "commercials-picker"],
    queryFn: ({ signal }) => clientsApi.list(EMPTY_CLIENT_FILTERS, DEFAULT_CLIENT_SORT, 1, 100, signal),
    enabled: !clientId,
  });
  const clientOptions = (clients.data?.items ?? []).map((c) => ({ id: c.id, label: c.name }));
  const entities = useQuery({ queryKey: commercialsKeys.legalEntities, queryFn: ({ signal }) => commercialsApi.legalEntities(signal) });
  const parents = useQuery({
    queryKey: commercialsKeys.clientContracts(form.client_id ?? ""),
    queryFn: ({ signal }) => commercialsApi.clientContracts(form.client_id!, signal),
    enabled: !!form.client_id && form.contract_type !== "msa",
  });
  const terms = useQuery({ queryKey: commercialsKeys.paymentTerms(false), queryFn: ({ signal }) => commercialsApi.paymentTerms(false, signal) });
  const create = useMutation({
    mutationFn: () =>
      commercialsApi.createContract({
        ...form,
        end_date: blank(form.end_date),
        amends_end_date: form.contract_type === "amendment" ? blank(form.amends_end_date) : null,
        parent_contract_id: form.contract_type === "msa" ? null : form.parent_contract_id,
        value_cap: blank(form.value_cap),
        placement_fee_pct: blank(form.placement_fee_pct),
        pricing_model: form.contract_type === "sow" ? (form.pricing_model ?? null) : null,
      }),
    onSuccess: onCreated,
  });
  const errors = fieldErrors(create.error);
  const needsParent = form.contract_type === "sow" || form.contract_type === "amendment";
  const valid = !!form.client_id && !!form.legal_entity_id && !!form.title.trim() && !!form.start_date && (!needsParent || !!form.parent_contract_id);

  return (
    <DetailsDrawer
      open
      title="New contract"
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            Create draft
          </Button>
        </div>
      }
    >
      <div className={admin.form}>
        <ErrorBar message={create.error && !Object.keys(errors).length ? errorMessage(create.error) : null} />
        <Field label="Type" required>
          <Dropdown
            value={CONTRACT_TYPE_LABELS[form.contract_type]}
            selectedOptions={[form.contract_type]}
            onOptionSelect={(_, d) => set("contract_type", d.optionValue as ContractType)}
          >
            {TYPES.map((t) => (
              <Option key={t} value={t}>
                {CONTRACT_TYPE_LABELS[t]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        {!clientId && (
          <IdSelect label="Client" options={clientOptions} value={form.client_id ?? null} onChange={(v) => set("client_id", v)} />
        )}
        <IdSelect
          label="Legal entity"
          options={(entities.data ?? []).map((e) => ({ id: e.id, label: e.name }))}
          value={form.legal_entity_id || null}
          onChange={(v) => set("legal_entity_id", v ?? "")}
        />
        {needsParent && (
          <IdSelect
            label="Parent contract"
            options={(parents.data ?? []).filter((c) => c.status !== "terminated" && c.contract_type !== "amendment").map((c) => ({ id: c.id, label: `${c.human_id} · ${c.title ?? ""}` }))}
            value={form.parent_contract_id ?? null}
            onChange={(v) => set("parent_contract_id", v)}
          />
        )}
        <Field label="Title" required validationMessage={errors.title}>
          <Input value={form.title} onChange={(_, d) => set("title", d.value)} />
        </Field>
        <Field label="Start date" required validationMessage={errors.start_date}>
          <Input type="date" value={form.start_date} onChange={(_, d) => set("start_date", d.value)} />
        </Field>
        <Field label="End date" validationMessage={errors.end_date}>
          <Input type="date" value={form.end_date ?? ""} onChange={(_, d) => set("end_date", d.value)} />
        </Field>
        {form.contract_type === "amendment" && (
          <Field label="New end date of the parent" hint="Activating the amendment extends (and re-activates) the parent">
            <Input type="date" value={form.amends_end_date ?? ""} onChange={(_, d) => set("amends_end_date", d.value)} />
          </Field>
        )}
        {form.contract_type === "sow" && (
          <Field label="Pricing model" hint="Required before the SOW can be submitted or activated" validationMessage={errors.pricing_model}>
            <RadioGroup value={form.pricing_model ?? ""} onChange={(_, d) => set("pricing_model", d.value as PricingModel)}>
              {PRICING_MODELS.map((m) => (
                <Radio key={m} value={m} label={PRICING_MODEL_LABELS[m]} />
              ))}
            </RadioGroup>
          </Field>
        )}
        <Field
          label={valueCapLabel(form.contract_type)}
          hint={form.contract_type === "sow" ? "Required before the SOW can be submitted or activated" : undefined}
          validationMessage={errors.value_cap}
        >
          <Input value={form.value_cap ?? ""} inputMode="decimal" contentAfter={form.currency} onChange={(_, d) => set("value_cap", d.value)} />
        </Field>
        <Field label="Currency">
          <Input value={form.currency} maxLength={3} onChange={(_, d) => set("currency", d.value.toUpperCase())} />
        </Field>
        <IdSelect
          label="Payment terms"
          options={(terms.data ?? []).map((t) => ({ id: t.id, label: `${t.name} (${t.days} days)` }))}
          value={form.payment_terms_id ?? null}
          noneLabel="Billing profile default"
          onChange={(v) => set("payment_terms_id", v)}
        />
        <Field label="Permanent placement fee %">
          <Input value={form.placement_fee_pct ?? ""} inputMode="decimal" onChange={(_, d) => set("placement_fee_pct", d.value)} />
        </Field>
        <Field label="Notice period (days)">
          <Input
            type="number"
            value={form.notice_period_days?.toString() ?? ""}
            onChange={(_, d) => set("notice_period_days", d.value ? Number(d.value) : null)}
          />
        </Field>
      </div>
    </DetailsDrawer>
  );
}
