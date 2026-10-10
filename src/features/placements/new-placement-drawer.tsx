"use client";

import { Button, Dropdown, Field, Input, Option } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DetailsDrawer, ErrorBar, IdSelect, useAdminStyles } from "@/features/admin/ui";
import { candidatesApi } from "@/features/candidates/api";
import { EMPTY_CANDIDATE_FILTERS } from "@/features/candidates/query";
import { clientsApi } from "@/features/clients/api";
import { DEFAULT_CLIENT_SORT, EMPTY_CLIENT_FILTERS } from "@/features/clients/query";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { placementKeys, placementsApi } from "./api";
import { isRate, todayIso } from "./format";
import type { EngagementKind, PlacementCreateBody, RateUnit } from "./types";

/** "New placement" `OverlayDrawer`: direct creation (permanent placements, direct engagements, migrations). */
export function NewPlacementDrawer({ onClose }: { onClose: () => void }) {
  const admin = useAdminStyles();
  const router = useRouter();
  const qc = useQueryClient();
  const [candidateQ, setCandidateQ] = useState("");
  const [form, setForm] = useState<PlacementCreateBody>({
    candidate_id: "",
    client_id: "",
    engagement_kind: "contract",
    planned_start_date: todayIso(),
    currency: "INR",
    rate_unit: "hour",
    pay_rate: "",
    bill_rate: "",
    role_title: "",
  });
  const clients = useQuery({
    queryKey: ["clients", "list", "placements-picker"],
    queryFn: ({ signal }) => clientsApi.list(EMPTY_CLIENT_FILTERS, DEFAULT_CLIENT_SORT, 1, 100, signal),
  });
  const candidates = useQuery({
    queryKey: ["candidates", "placements-picker", candidateQ],
    queryFn: ({ signal }) => candidatesApi.list({ ...EMPTY_CANDIDATE_FILTERS, q: candidateQ }, 1, 25, signal),
  });
  const save = useMutation({
    mutationFn: () =>
      placementsApi.create({
        ...form,
        pay_rate: form.pay_rate || null,
        bill_rate: form.bill_rate || null,
        role_title: form.role_title || null,
      }),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: placementKeys.all });
      router.push(`/placements/${p.id}`);
    },
  });
  const errs = fieldErrors(save.error);
  const set = <K extends keyof PlacementCreateBody>(k: K, v: PlacementCreateBody[K]) => setForm((f) => ({ ...f, [k]: v }));
  const ratesOk = (!form.pay_rate || isRate(form.pay_rate)) && (!form.bill_rate || isRate(form.bill_rate));
  const valid = form.candidate_id && form.client_id && form.planned_start_date && ratesOk;
  return (
    <DetailsDrawer
      open
      title="New placement"
      onClose={onClose}
      footer={
        <div className={admin.footer}>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            Create placement
          </Button>
        </div>
      }
    >
      <div className={admin.form}>
        <ErrorBar message={save.isError && !Object.keys(errs).length ? errorMessage(save.error) : null} />
        <Field label="Find worker">
          <Input value={candidateQ} placeholder="Search candidates by name" onChange={(_, d) => setCandidateQ(d.value)} />
        </Field>
        <IdSelect
          label="Worker"
          options={(candidates.data?.items ?? []).map((c) => ({ id: c.id, label: c.full_name }))}
          value={form.candidate_id || null}
          onChange={(v) => set("candidate_id", v ?? "")}
        />
        <IdSelect
          label="Client"
          options={(clients.data?.items ?? []).map((c) => ({ id: c.id, label: c.name }))}
          value={form.client_id || null}
          onChange={(v) => set("client_id", v ?? "")}
        />
        <Field label="Engagement">
          <Dropdown
            value={{ contract: "Contract", c2h: "Contract to hire", permanent: "Permanent" }[form.engagement_kind]}
            selectedOptions={[form.engagement_kind]}
            onOptionSelect={(_, d) => set("engagement_kind", d.optionValue as EngagementKind)}
          >
            <Option value="contract">Contract</Option>
            <Option value="c2h">Contract to hire</Option>
            <Option value="permanent">Permanent</Option>
          </Dropdown>
        </Field>
        <Field label="Role">
          <Input value={form.role_title ?? ""} onChange={(_, d) => set("role_title", d.value)} />
        </Field>
        <Field label="Planned start" required validationMessage={errs.planned_start_date}>
          <Input type="date" value={form.planned_start_date} onChange={(_, d) => set("planned_start_date", d.value)} />
        </Field>
        <Field label="Planned end">
          <Input type="date" value={form.planned_end_date ?? ""} onChange={(_, d) => set("planned_end_date", d.value || null)} />
        </Field>
        <Field label="Rate unit">
          <Dropdown value={form.rate_unit} selectedOptions={[form.rate_unit]} onOptionSelect={(_, d) => set("rate_unit", d.optionValue as RateUnit)}>
            {(["hour", "day", "month", "fixed"] as const).map((u) => (
              <Option key={u} value={u}>
                {u}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Pay rate" validationMessage={form.pay_rate && !isRate(form.pay_rate) ? "Enter an amount" : errs.pay_rate}>
          <Input inputMode="decimal" value={form.pay_rate ?? ""} onChange={(_, d) => set("pay_rate", d.value)} />
        </Field>
        <Field label="Bill rate" validationMessage={form.bill_rate && !isRate(form.bill_rate) ? "Enter an amount" : errs.bill_rate}>
          <Input inputMode="decimal" value={form.bill_rate ?? ""} onChange={(_, d) => set("bill_rate", d.value)} />
        </Field>
      </div>
    </DetailsDrawer>
  );
}
