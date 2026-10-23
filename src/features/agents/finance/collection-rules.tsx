"use client";

import {
  Button,
  Checkbox,
  Dropdown,
  Field,
  Input,
  Link,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  SpinButton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { ClientPicker } from "@/features/demands/client-picker";
import { errorMessage } from "@/lib/api/errors";
import { financeAgentApi, financeAgentKeys } from "./api";
import { AUDIENCE_LABELS, AUTO_RULE_MESSAGE, sendLabel, stepErrors, TONE_LABELS } from "./logic";
import type { Audience, RuleIn, RuleOut, StepIn, Tone } from "./types";

const useStyles = makeStyles({
  form: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: tokens.spacingHorizontalM },
  section: { marginTop: tokens.spacingVerticalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalM },
  small: { width: "96px" },
});

/** `/settings/collection-rules` (Epic 63): the tenant default and per-client collection rules. */
export function CollectionRulesList() {
  const admin = useAdminStyles();
  const router = useRouter();
  const perms = usePermissions();
  const allowed = hasAnyPermission(perms, ["collections:write", "billing:configure", "receivables:read"]);
  const q = useQuery({ queryKey: financeAgentKeys.rules(), queryFn: ({ signal }) => financeAgentApi.rules(signal), enabled: allowed });
  if (!allowed) return <NoAccess what="collection rules" />;
  return (
    <>
      <PageHeader title="Collection rules" subtitle="Reminder schedule, tone, contacts and pre-due automatic reminders per client" />
      <div className={admin.toolbar}>
        <span className={admin.grow} />
        {hasAnyPermission(perms, ["collections:write"]) && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => router.push("/settings/collection-rules/new")}>
            New client rule
          </Button>
        )}
      </div>
      <ErrorBar message={q.isError ? errorMessage(q.error) : null} />
      {!q.data ? (
        <GridSkeleton />
      ) : (
        <Table aria-label="Collection rules" size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Rule</TableHeaderCell>
              <TableHeaderCell>Client</TableHeaderCell>
              <TableHeaderCell>Steps</TableHeaderCell>
              <TableHeaderCell>Automatic pre-due steps</TableHeaderCell>
              <TableHeaderCell>Active</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link onClick={() => router.push(`/settings/collection-rules/${r.id}`)}>{r.name}</Link>
                </TableCell>
                <TableCell>{r.client_id ? (r.client_name ?? "Client") : "All clients (default)"}</TableCell>
                <TableCell>{r.steps.length}</TableCell>
                <TableCell>{r.auto_steps}</TableCell>
                <TableCell>{r.active ? "Yes" : "No"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

const EMPTY: RuleIn = {
  client_id: null,
  name: "",
  active: true,
  escalation_contact_id: null,
  max_reminders_per_week: 2,
  quiet_start: "18:00",
  quiet_end: "09:00",
  timezone: "Asia/Kolkata",
};

/** Template options: the system collection templates used by any rule step, labelled by tone. */
function templateOptions(rules: RuleOut[] | undefined): { id: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const r of rules ?? []) for (const s of r.steps) if (s.email_template_id && !seen.has(s.email_template_id)) seen.set(s.email_template_id, `Payment reminder (${TONE_LABELS[s.tone]?.toLowerCase() ?? s.tone})`);
  return [...seen.entries()].map(([id, label]) => ({ id, label }));
}

/** `/settings/collection-rules/[id]` (``new`` creates a client rule): fields and the steps table. */
export function CollectionRuleEditor({ id }: { id: string }) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const qc = useQueryClient();
  const perms = usePermissions();
  const isNew = id === "new";
  const all = useQuery({ queryKey: financeAgentKeys.rules(), queryFn: ({ signal }) => financeAgentApi.rules(signal) });
  const one = useQuery({ queryKey: financeAgentKeys.rule(id), queryFn: ({ signal }) => financeAgentApi.rule(id, signal), enabled: !isNew });
  const [rule, setRule] = useState<RuleIn>(EMPTY);
  const [clientName, setClientName] = useState<string | undefined>();
  const [steps, setSteps] = useState<StepIn[]>([]);
  useEffect(() => {
    if (one.data) {
      const { id: _id, steps: s, client_name, escalation_contact_name: _e, auto_steps: _a, updated_at: _u, ...rest } = one.data;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: seed local state from fetched/client-only data
      setRule({ ...rest, quiet_start: rest.quiet_start.slice(0, 5), quiet_end: rest.quiet_end.slice(0, 5) });
      setClientName(client_name ?? undefined);
      setSteps(s.map(({ id: _sid, ...st }) => st));
    } else if (isNew && all.data) {
      const def = all.data.find((r) => r.client_id === null);
      setSteps((def?.steps ?? []).map(({ id: _sid, ...st }) => st));
    }
  }, [one.data, isNew, all.data]);
  const templates = useMemo(() => templateOptions(all.data), [all.data]);
  const errors = stepErrors(steps);
  const canWrite = hasAnyPermission(perms, rule.client_id === null && !isNew ? ["billing:configure"] : ["collections:write"]);
  const save = useMutation({
    mutationFn: async () => {
      if (isNew) return financeAgentApi.createRule({ ...rule, steps });
      await financeAgentApi.updateRule(id, {
        name: rule.name, active: rule.active, escalation_contact_id: rule.escalation_contact_id,
        max_reminders_per_week: rule.max_reminders_per_week, quiet_start: rule.quiet_start, quiet_end: rule.quiet_end, timezone: rule.timezone,
      });
      return financeAgentApi.putSteps(id, steps);
    },
    onSuccess: (out) => {
      toast.success("Collection rule saved");
      void qc.invalidateQueries({ queryKey: financeAgentKeys.rules() });
      if (isNew) router.push(`/settings/collection-rules/${out.id}`);
    },
  });
  if (!isNew && one.isLoading) return <GridSkeleton />;
  const setStep = (i: number, patch: Partial<StepIn>) => setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <>
      <PageHeader title={isNew ? "New collection rule" : rule.name || "Collection rule"} subtitle="The Collections Agent follows this rule" />
      <ErrorBar message={one.isError ? errorMessage(one.error) : save.isError ? errorMessage(save.error) : null} />
      <div className={styles.form}>
        <Field label="Name" required>
          <Input value={rule.name} maxLength={120} onChange={(_, d) => setRule({ ...rule, name: d.value })} />
        </Field>
        {isNew || rule.client_id ? (
          <ClientPicker
            label="Client"
            value={rule.client_id}
            valueLabel={clientName}
            disabled={!isNew}
            onChange={(c) => {
              setRule({ ...rule, client_id: c?.id ?? null });
              setClientName(c?.name);
            }}
          />
        ) : (
          <Field label="Client">
            <Input value="All clients (default)" readOnly />
          </Field>
        )}
        <Field label="Escalation contact" hint="Contact id of the client's escalation contact (e.g. the CFO)">
          <Input value={rule.escalation_contact_id ?? ""} onChange={(_, d) => setRule({ ...rule, escalation_contact_id: d.value.trim() || null })} />
        </Field>
        <Field label="Max reminders per week">
          <SpinButton min={1} max={7} value={rule.max_reminders_per_week} onChange={(_, d) => setRule({ ...rule, max_reminders_per_week: Number(d.value ?? d.displayValue ?? 2) })} />
        </Field>
        <Field label="Quiet hours" hint="No agent email between these times">
          <div className={admin.toolbar}>
            <Input type="time" aria-label="Quiet hours start" value={rule.quiet_start} onChange={(_, d) => setRule({ ...rule, quiet_start: d.value })} />
            <Input type="time" aria-label="Quiet hours end" value={rule.quiet_end} onChange={(_, d) => setRule({ ...rule, quiet_end: d.value })} />
          </div>
        </Field>
        <Field label="Time zone">
          <Input value={rule.timezone} onChange={(_, d) => setRule({ ...rule, timezone: d.value })} />
        </Field>
        <Switch label="Active" checked={rule.active} onChange={(_, d) => setRule({ ...rule, active: d.checked })} />
      </div>
      <div className={styles.section}>
        <Table aria-label="Steps" size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Step</TableHeaderCell>
              <TableHeaderCell>Days from due date</TableHeaderCell>
              <TableHeaderCell>Tone</TableHeaderCell>
              <TableHeaderCell>Send to</TableHeaderCell>
              <TableHeaderCell>Template</TableHeaderCell>
              <TableHeaderCell>Send</TableHeaderCell>
              <TableHeaderCell>Create task</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.map((s, i) => (
              <TableRow key={i}>
                <TableCell>{s.position}</TableCell>
                <TableCell>
                  <Field hint="Negative = before the due date" validationMessage={errors[i]}>
                    <Input className={styles.small} type="number" value={String(s.offset_days)} onChange={(_, d) => setStep(i, { offset_days: Number(d.value) })} />
                  </Field>
                </TableCell>
                <TableCell>
                  <Dropdown value={TONE_LABELS[s.tone]} selectedOptions={[s.tone]} onOptionSelect={(_, d) => setStep(i, { tone: d.optionValue as Tone })}>
                    {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                      <Option key={t} value={t}>
                        {TONE_LABELS[t]}
                      </Option>
                    ))}
                  </Dropdown>
                </TableCell>
                <TableCell>
                  <Dropdown value={AUDIENCE_LABELS[s.audience]} selectedOptions={[s.audience]} onOptionSelect={(_, d) => setStep(i, { audience: d.optionValue as Audience })}>
                    {Object.entries(AUDIENCE_LABELS).map(([k, v]) => (
                      <Option key={k} value={k}>
                        {v}
                      </Option>
                    ))}
                  </Dropdown>
                </TableCell>
                <TableCell>
                  <Dropdown
                    placeholder="No template"
                    value={templates.find((t) => t.id === s.email_template_id)?.label ?? ""}
                    selectedOptions={s.email_template_id ? [s.email_template_id] : []}
                    onOptionSelect={(_, d) => setStep(i, { email_template_id: d.optionValue === "none" ? null : (d.optionValue ?? null) })}
                  >
                    <Option value="none">No template</Option>
                    {templates.map((t) => (
                      <Option key={t.id} value={t.id}>
                        {t.label}
                      </Option>
                    ))}
                  </Dropdown>
                </TableCell>
                <TableCell>
                  <Dropdown value={sendLabel(s.allow_auto)} selectedOptions={[s.allow_auto ? "auto" : "approval"]} onOptionSelect={(_, d) => setStep(i, { allow_auto: d.optionValue === "auto" })}>
                    <Option value="approval">After approval</Option>
                    <Option value="auto">Automatically (pre-due only)</Option>
                  </Dropdown>
                </TableCell>
                <TableCell>
                  <Checkbox aria-label="Create task" checked={s.create_task} onChange={(_, d) => setStep(i, { create_task: Boolean(d.checked) })} />
                </TableCell>
                <TableCell>
                  <Button appearance="subtle" icon={<Delete20Regular />} aria-label={`Remove step ${s.position}`} onClick={() => setSteps((p) => p.filter((_, j) => j !== i).map((x, j) => ({ ...x, position: j + 1 })))} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div>
          <Button
            icon={<Add20Regular />}
            onClick={() =>
              setSteps((p) => [...p, { position: p.length + 1, offset_days: 7, tone: "friendly", audience: "billing_contacts", email_template_id: null, allow_auto: false, create_task: false, active: true }])
            }
          >
            Add step
          </Button>
        </div>
        {Object.values(errors).includes(AUTO_RULE_MESSAGE) && (
          <MessageBar intent="warning">
            <MessageBarBody>{AUTO_RULE_MESSAGE}</MessageBarBody>
          </MessageBar>
        )}
      </div>
      <div className={styles.actions}>
        <Button appearance="primary" disabled={!canWrite || !rule.name.trim() || Object.keys(errors).length > 0 || save.isPending} onClick={() => save.mutate()}>
          Save rule
        </Button>
        <Button onClick={() => router.push("/settings/collection-rules")}>Back</Button>
      </div>
    </>
  );
}
