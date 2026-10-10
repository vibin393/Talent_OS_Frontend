"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Text,
  Title2,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { leaveApi, leaveKeys } from "./api";
import type { AccrualMode, LeaveTypeIn, LeaveTypeOut } from "./types";
import { DAYS_RE } from "./validation";

const useStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "960px" },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "flex-end" },
});

const EMPTY: LeaveTypeIn = {
  code: "",
  name: "",
  paid: true,
  billable: false,
  accrual_mode: "monthly",
  accrual_amount: "1.75",
  cap: null,
  carry_forward_limit: null,
  allow_negative: false,
  negative_limit: null,
  allow_half_day: true,
};

const optDays = (v: string | null | undefined) => (v ? v.trim() : null);

/** `/admin/leave-types`: leave types (billable defaults off) with per-Client overrides. */
export function LeaveTypesAdmin() {
  const styles = useStyles();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: leaveKeys.types, queryFn: ({ signal }) => leaveApi.types(signal) });
  const [form, setForm] = useState<LeaveTypeIn>(EMPTY);
  const create = useMutation({
    mutationFn: () =>
      leaveApi.createType({ ...form, cap: optDays(form.cap), carry_forward_limit: optDays(form.carry_forward_limit), negative_limit: optDays(form.negative_limit) }),
    onSuccess: () => {
      setForm(EMPTY);
      void qc.invalidateQueries({ queryKey: leaveKeys.types });
    },
  });
  const badDays = [form.accrual_amount, form.cap, form.carry_forward_limit, form.negative_limit].some((v) => v && !DAYS_RE.test(v.trim()));
  const set = (patch: Partial<LeaveTypeIn>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <div className={styles.page}>
      <Title2>Leave types</Title2>
      <Card className={styles.card}>
        <Text weight="semibold">New leave type</Text>
        <div className={styles.row}>
          <Field label="Code" required>
            <Input value={form.code} onChange={(_, d) => set({ code: d.value })} />
          </Field>
          <Field label="Name" required>
            <Input value={form.name} onChange={(_, d) => set({ name: d.value })} />
          </Field>
          <Field label="Accrual">
            <Dropdown value={form.accrual_mode} selectedOptions={[form.accrual_mode]} onOptionSelect={(_, d) => set({ accrual_mode: d.optionValue as AccrualMode })}>
              <Option value="monthly">monthly</Option>
              <Option value="annual_grant">annual_grant</Option>
              <Option value="none">none</Option>
            </Dropdown>
          </Field>
          <Field label="Days per period">
            <Input value={form.accrual_amount} onChange={(_, d) => set({ accrual_amount: d.value })} />
          </Field>
          <Field label="Cap">
            <Input value={form.cap ?? ""} onChange={(_, d) => set({ cap: d.value })} />
          </Field>
          <Field label="Carry forward limit">
            <Input value={form.carry_forward_limit ?? ""} onChange={(_, d) => set({ carry_forward_limit: d.value })} placeholder="All" />
          </Field>
        </div>
        <div className={styles.row}>
          <Checkbox label="Paid" checked={form.paid} onChange={(_, d) => set({ paid: !!d.checked })} />
          <Checkbox label="Billable to the Client" checked={form.billable} onChange={(_, d) => set({ billable: !!d.checked })} />
          <Checkbox label="Half days" checked={form.allow_half_day} onChange={(_, d) => set({ allow_half_day: !!d.checked })} />
          <Checkbox label="Allow negative balance" checked={form.allow_negative} onChange={(_, d) => set({ allow_negative: !!d.checked })} />
          {form.allow_negative && (
            <Field label="Negative limit">
              <Input value={form.negative_limit ?? ""} onChange={(_, d) => set({ negative_limit: d.value })} />
            </Field>
          )}
        </div>
        {badDays && <ErrorBar message="Day values need at most 2 decimals (for example 1.75)." />}
        {create.isError && <ErrorBar message={errorMessage(create.error)} />}
        <div>
          <Button appearance="primary" disabled={!form.code || !form.name || badDays || create.isPending} onClick={() => create.mutate()}>
            Create leave type
          </Button>
        </div>
      </Card>
      {q.isPending ? (
        <GridSkeleton />
      ) : q.isError ? (
        <ErrorBar message={errorMessage(q.error)} />
      ) : q.data.length === 0 ? (
        <Body1>No leave types yet.</Body1>
      ) : (
        q.data.map((t) => <LeaveTypeCard key={t.id} t={t} />)
      )}
    </div>
  );
}

function LeaveTypeCard({ t }: { t: LeaveTypeOut }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [requiresClient, setRequiresClient] = useState(false);
  const save = useMutation({
    mutationFn: () => leaveApi.putOverride(t.id, clientId.trim(), { requires_client_approval: requiresClient }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: leaveKeys.types }),
  });
  return (
    <Card className={styles.card}>
      <div className={styles.row}>
        <Text weight="semibold">
          {t.name} ({t.code})
        </Text>
        <Badge appearance="tint">{t.paid ? "Paid" : "Unpaid"}</Badge>
        {t.billable && <Badge appearance="tint" color="brand">Billable</Badge>}
      </div>
      <Caption1>
        {t.accrual_mode === "none" ? "No accrual" : `${t.accrual_amount} days ${t.accrual_mode === "monthly" ? "per month" : "per year"}`}
        {t.cap ? ` · cap ${t.cap}` : ""}
        {` · carry forward ${t.carry_forward_limit ?? "all"}`}
      </Caption1>
      {t.overrides.map((o) => (
        <Caption1 key={o.id}>
          Client {o.client_id.slice(0, 8)}: {o.requires_client_approval ? "Client approves" : "no Client step"}
          {o.accrual_amount ? ` · ${o.accrual_amount} days` : ""}
        </Caption1>
      ))}
      <div className={styles.row}>
        <Field label="Client override (client id)">
          <Input value={clientId} onChange={(_, d) => setClientId(d.value)} />
        </Field>
        <Checkbox label="Client approves" checked={requiresClient} onChange={(_, d) => setRequiresClient(!!d.checked)} />
        <Button disabled={!clientId.trim() || save.isPending} onClick={() => save.mutate()}>
          Save override
        </Button>
      </div>
      {save.isError && <ErrorBar message={errorMessage(save.error)} />}
    </Card>
  );
}
