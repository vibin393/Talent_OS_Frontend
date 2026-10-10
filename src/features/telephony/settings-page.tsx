"use client";

import {
  Body1,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  Link,
  makeStyles,
  ProgressBar,
  SpinButton,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { telephonyApi, telephonyKeys } from "./api";
import { CallPhoneCard } from "./call-phone-card";
import { LANGUAGE_LABELS, rupees, settingsErrors } from "./logic";
import type { TelephonySettings } from "./types";

const useStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "960px" },
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM },
  row: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap", alignItems: "flex-end" },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** `/settings/telephony` "Calling and transcription" (spec B3; `integration:view` to read, `integration:manage` to edit). */
export function TelephonySettingsPage() {
  const styles = useStyles();
  const canView = usePermission("integration:view");
  const canManage = usePermission("integration:manage");
  const allowed = canView || canManage;
  const s = useQuery({ queryKey: telephonyKeys.settings, queryFn: ({ signal }) => telephonyApi.settings(signal), enabled: allowed });
  return (
    <>
      <PageHeader title="Calling and transcription" subtitle="Caller IDs, calling hours, recording notice, daily budget and automatic transcription." />
      <div className={styles.page}>
        <CallPhoneCard />
        {!allowed ? (
          <NoAccess what="Calling and transcription settings" />
        ) : s.isPending ? (
          <GridSkeleton rows={4} />
        ) : s.isError ? (
          <ErrorBar title="Could not load the settings." message={errorMessage(s.error)} />
        ) : (
          <>
            <Card className={styles.card}>
              <CardHeader header={<Subtitle2>Provider</Subtitle2>} />
              <Body1>The calling provider is installed per legal entity from the Marketplace.</Body1>
              <Link href="/settings/integrations">Manage in Marketplace</Link>
            </Card>
            <CallerIds canManage={canManage} />
            <RulesForm initial={s.data} canManage={canManage} />
            <UsageCard />
          </>
        )}
      </div>
    </>
  );
}

function CallerIds({ canManage }: { canManage: boolean }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const q = useQuery({ queryKey: telephonyKeys.numbers, queryFn: ({ signal }) => telephonyApi.numbers(signal) });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ installation_id: "", number_e164: "", label: "", regulatory_ref: "", rate: 0 });
  const add = useMutation({
    mutationFn: () =>
      telephonyApi.addNumber({
        installation_id: form.installation_id,
        number_e164: form.number_e164,
        label: form.label || null,
        regulatory_ref: form.regulatory_ref || null,
        rate_per_minute_minor: Math.round(form.rate * 100),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: telephonyKeys.numbers });
      setAdding(false);
      toast.success("Caller ID added.");
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => telephonyApi.deactivateNumber(id), onSuccess: () => void qc.invalidateQueries({ queryKey: telephonyKeys.numbers }) });
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2>Caller IDs</Subtitle2>}
        action={canManage ? <Button size="small" onClick={() => setAdding((v) => !v)}>Add number</Button> : undefined}
      />
      <ErrorBar message={add.error ? errorMessage(add.error) : q.error ? errorMessage(q.error) : null} />
      {adding && (
        <div className={styles.row}>
          <Field label="Installation ID">
            <Input value={form.installation_id} onChange={(_, d) => setForm({ ...form, installation_id: d.value })} />
          </Field>
          <Field label="Number">
            <Input value={form.number_e164} onChange={(_, d) => setForm({ ...form, number_e164: d.value })} placeholder="+91 80 4000 0000" />
          </Field>
          <Field label="Label">
            <Input value={form.label} onChange={(_, d) => setForm({ ...form, label: d.value })} />
          </Field>
          <Field label="Registration ref">
            <Input value={form.regulatory_ref} onChange={(_, d) => setForm({ ...form, regulatory_ref: d.value })} />
          </Field>
          <Field label="Rate per minute (₹)">
            <SpinButton value={form.rate} min={0} step={0.1} onChange={(_, d) => setForm({ ...form, rate: Number(d.value ?? d.displayValue ?? 0) })} />
          </Field>
          <Button appearance="primary" disabled={add.isPending || !form.installation_id || !form.number_e164} onClick={() => add.mutate()}>
            Save
          </Button>
        </div>
      )}
      <Table size="small" aria-label="Caller IDs">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Number</TableHeaderCell>
            <TableHeaderCell>Legal entity</TableHeaderCell>
            <TableHeaderCell>Provider</TableHeaderCell>
            <TableHeaderCell>Registration ref</TableHeaderCell>
            <TableHeaderCell>Rate per minute (₹)</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(q.data ?? []).map((n) => (
            <TableRow key={n.id}>
              <TableCell>{n.label ? `${n.label} (${n.number_e164})` : n.number_e164}</TableCell>
              <TableCell>{n.legal_entity_id ?? "Default"}</TableCell>
              <TableCell>{n.provider_key}</TableCell>
              <TableCell>{n.regulatory_ref ?? "—"}</TableCell>
              <TableCell>{rupees(n.rate_per_minute_minor)}</TableCell>
              <TableCell>{n.status === "active" ? "Active" : "Inactive"}</TableCell>
              <TableCell>
                {canManage && n.status === "active" && (
                  <Button size="small" appearance="subtle" onClick={() => remove.mutate(n.id)}>
                    Deactivate
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function RulesForm({ initial, canManage }: { initial: TelephonySettings; canManage: boolean }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [v, setV] = useState(initial);
  const errors = settingsErrors(v);
  const save = useMutation({
    mutationFn: () =>
      telephonyApi.saveSettings({
        call_window_start: v.call_window_start.slice(0, 5),
        call_window_end: v.call_window_end.slice(0, 5),
        max_call_minutes: v.max_call_minutes,
        max_concurrent_per_user: v.max_concurrent_per_user,
        recording_notice_text: v.recording_notice_text,
        daily_cost_cap_minor: v.daily_cost_cap_minor,
        cost_alert_pct: v.cost_alert_pct,
        stt_enabled: v.stt_enabled,
        stt_language_hints: v.stt_language_hints,
        auto_transcribe_uploads: v.auto_transcribe_uploads,
      }),
    onSuccess: (out) => {
      qc.setQueryData(telephonyKeys.settings, out);
      toast.success("Settings saved.");
    },
  });
  const toggleLang = (lang: string, on: boolean) =>
    setV({ ...v, stt_language_hints: on ? [...new Set([...v.stt_language_hints, lang])] : v.stt_language_hints.filter((x) => x !== lang) });
  return (
    <>
      <Card className={styles.card}>
        <CardHeader header={<Subtitle2>Calling rules</Subtitle2>} />
        <div className={styles.row}>
          <Field label="Calling hours from">
            <Input type="time" value={v.call_window_start.slice(0, 5)} disabled={!canManage} onChange={(_, d) => setV({ ...v, call_window_start: d.value })} />
          </Field>
          <Field label="to" validationMessage={errors.call_window_end}>
            <Input type="time" value={v.call_window_end.slice(0, 5)} disabled={!canManage} onChange={(_, d) => setV({ ...v, call_window_end: d.value })} />
          </Field>
          <Field label="Max call length (minutes)">
            <SpinButton value={v.max_call_minutes} min={5} max={60} disabled={!canManage} onChange={(_, d) => setV({ ...v, max_call_minutes: Number(d.value ?? v.max_call_minutes) })} />
          </Field>
          <Field label="Calls at a time per recruiter">
            <SpinButton value={v.max_concurrent_per_user} min={1} max={3} disabled={!canManage} onChange={(_, d) => setV({ ...v, max_concurrent_per_user: Number(d.value ?? v.max_concurrent_per_user) })} />
          </Field>
        </div>
        <Field label="Recording notice" hint="{tenant} is replaced with your organisation's name.">
          <Textarea value={v.recording_notice_text} disabled={!canManage} maxLength={300} onChange={(_, d) => setV({ ...v, recording_notice_text: d.value })} />
        </Field>
      </Card>
      <Card className={styles.card}>
        <CardHeader header={<Subtitle2>Budget</Subtitle2>} />
        <div className={styles.row}>
          <Field label="Daily cost cap (₹)" validationMessage={errors.daily_cost_cap_minor}>
            <SpinButton value={v.daily_cost_cap_minor / 100} min={0} step={100} disabled={!canManage} onChange={(_, d) => setV({ ...v, daily_cost_cap_minor: Math.round(Number(d.value ?? 0) * 100) })} />
          </Field>
          <Field label="Alert at (%)" validationMessage={errors.cost_alert_pct}>
            <SpinButton value={v.cost_alert_pct} min={50} max={95} disabled={!canManage} onChange={(_, d) => setV({ ...v, cost_alert_pct: Number(d.value ?? v.cost_alert_pct) })} />
          </Field>
        </div>
      </Card>
      <Card className={styles.card}>
        <CardHeader header={<Subtitle2>Transcription</Subtitle2>} />
        <Switch label="Transcribe recordings automatically" checked={v.stt_enabled} disabled={!canManage} onChange={(_, d) => setV({ ...v, stt_enabled: d.checked })} />
        <Body1 className={styles.muted}>Requires a speech-to-text Installation (Azure AI Speech, Central India).</Body1>
        <Field label="Language hints">
          <div className={styles.row}>
            {Object.entries(LANGUAGE_LABELS).map(([k, label]) => (
              <Checkbox key={k} label={label} checked={v.stt_language_hints.includes(k)} disabled={!canManage} onChange={(_, d) => toggleLang(k, Boolean(d.checked))} />
            ))}
          </div>
        </Field>
        <Switch label="Also transcribe uploaded recordings" checked={v.auto_transcribe_uploads} disabled={!canManage} onChange={(_, d) => setV({ ...v, auto_transcribe_uploads: d.checked })} />
        {canManage && (
          <div>
            <ErrorBar message={save.error ? errorMessage(save.error) : null} />
            <Button appearance="primary" disabled={save.isPending || Object.keys(errors).length > 0} onClick={() => save.mutate()}>
              Save
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}

function UsageCard() {
  const styles = useStyles();
  const [groupBy, setGroupBy] = useState<"user" | "legal_entity" | "day">("day");
  const q = useQuery({ queryKey: telephonyKeys.usage(groupBy), queryFn: ({ signal }) => telephonyApi.usage(groupBy, signal), retry: false });
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2>Usage</Subtitle2>} />
      {q.data && (
        <Field label={`Today: ${rupees(q.data.today_cost_minor)} of ${rupees(q.data.daily_cost_cap_minor)}`}>
          <ProgressBar value={Math.min(q.data.today_cost_pct, 100) / 100} color={q.data.today_cost_pct >= 100 ? "error" : q.data.today_cost_pct >= 80 ? "warning" : "brand"} />
        </Field>
      )}
      <div className={styles.row}>
        {(["day", "user", "legal_entity"] as const).map((g) => (
          <Button key={g} size="small" appearance={groupBy === g ? "primary" : "secondary"} onClick={() => setGroupBy(g)}>
            {g === "day" ? "By day" : g === "user" ? "By user" : "By legal entity"}
          </Button>
        ))}
      </div>
      <ErrorBar message={q.error ? errorMessage(q.error) : null} />
      <Table size="small" aria-label="View as table">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>{groupBy === "day" ? "Day" : groupBy === "user" ? "User" : "Legal entity"}</TableHeaderCell>
            <TableHeaderCell>Calls</TableHeaderCell>
            <TableHeaderCell>Minutes</TableHeaderCell>
            <TableHeaderCell>Transcription minutes</TableHeaderCell>
            <TableHeaderCell>Estimated cost</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(q.data?.rows ?? []).map((r) => (
            <TableRow key={r.key}>
              <TableCell>{r.label ?? r.key}</TableCell>
              <TableCell>{r.calls}</TableCell>
              <TableCell>{r.minutes}</TableCell>
              <TableCell>{r.stt_minutes}</TableCell>
              <TableCell>{rupees(r.cost_estimate_minor)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
