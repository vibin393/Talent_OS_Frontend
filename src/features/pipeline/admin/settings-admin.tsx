"use client";

import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  makeStyles,
  Radio,
  RadioGroup,
  Spinner,
  Subtitle2,
  Switch,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import type { PipelineSettingsOut, PipelineSettingsUpdate } from "@/lib/api/types";
import { pipelineApi, pipelineKeys } from "../api";
import { usePipelineSettings } from "../use-pipeline";

const useStyles = makeStyles({
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: tokens.spacingHorizontalL, alignItems: "start" },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  row: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap" },
  num: { width: "150px" },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalL },
  muted: { color: tokens.colorNeutralForeground3 },
});

const EMPLOYMENT_TYPES: { key: string; label: string }[] = [
  { key: "contract", label: "Contract" },
  { key: "contract_to_hire", label: "Contract to hire" },
  { key: "permanent", label: "Permanent" },
  { key: "freelance", label: "Freelance" },
];

const LINK_LABELS: Record<string, string> = {
  ai_screening: "AI screening",
  client_feedback: "Client feedback",
  consent_request: "Consent requests",
  consent: "Consent requests",
};

type Form = {
  mode: PipelineSettingsOut["submission_consent_mode"];
  window: string;
  minMargin: string;
  burden: Record<string, string>;
  rejectionEnabled: boolean;
  rejectionSubject: string;
  rejectionBody: string;
  autoInterview: boolean;
  showBill: boolean;
};

function toForm(s: PipelineSettingsOut): Form {
  return {
    mode: s.submission_consent_mode,
    window: String(s.prior_submission_window_days),
    minMargin: String(s.min_margin_pct),
    burden: Object.fromEntries(EMPLOYMENT_TYPES.map((t) => [t.key, s.burden_pct[t.key] != null ? String(s.burden_pct[t.key]) : "0"])),
    rejectionEnabled: s.rejection_email_enabled,
    rejectionSubject: s.rejection_email_subject,
    rejectionBody: s.rejection_email_body,
    autoInterview: s.auto_interview_on_interest,
    showBill: s.show_bill_rate_in_submission,
  };
}

function numError(v: string, min: number, max: number): string | undefined {
  const n = Number(v);
  if (v.trim() === "" || !Number.isFinite(n)) return "Enter a number";
  if (n < min || n > max) return `Between ${min} and ${max}`;
  return undefined;
}

/** Submission rules: consent mode, prior-submission window, minimum margin, burden %, rejection email. */
export function PipelineSettingsAdmin() {
  const settings = usePipelineSettings();
  if (settings.isPending) return <GridSkeleton rows={6} />;
  if (settings.isError) return <ErrorBar title="Could not load the pipeline settings." message={errorMessage(settings.error)} />;
  return <SettingsForm key={JSON.stringify(settings.data)} settings={settings.data} />;
}

function SettingsForm({ settings }: { settings: PipelineSettingsOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => toForm(settings));
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const errors = {
    window: numError(form.window, 0, 3650),
    minMargin: numError(form.minMargin, -100, 100),
    ...Object.fromEntries(EMPLOYMENT_TYPES.map((t) => [`burden_${t.key}`, numError(form.burden[t.key] ?? "", 0, 200)])),
  } as Record<string, string | undefined>;
  const invalid = Object.values(errors).some(Boolean);
  const save = useMutation({
    mutationFn: () => {
      const body: PipelineSettingsUpdate = {
        submission_consent_mode: form.mode,
        prior_submission_window_days: Number(form.window),
        min_margin_pct: form.minMargin.trim(),
        burden_pct: Object.fromEntries(EMPLOYMENT_TYPES.map((t) => [t.key, (form.burden[t.key] ?? "0").trim()])),
        rejection_email_enabled: form.rejectionEnabled,
        rejection_email_subject: form.rejectionSubject,
        rejection_email_body: form.rejectionBody,
        auto_interview_on_interest: form.autoInterview,
        show_bill_rate_in_submission: form.showBill,
      };
      return pipelineApi.updateSettings(body);
    },
    onSuccess: (s) => {
      queryClient.setQueryData(pipelineKeys.settings, s);
      toast.success("Pipeline settings saved.");
    },
  });
  const serverFields = fieldErrors(save.error);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) save.mutate();
      }}
    >
      <div className={styles.grid}>
        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">Submission checks</Subtitle2>} />
          <Field label="Candidate consent before submitting to a client">
            <RadioGroup value={form.mode} onChange={(_, d) => set("mode", d.value as Form["mode"])}>
              <Radio value="attestation_allowed" label="Consent link, or recruiter attestation" />
              <Radio value="candidate_link" label="Only the candidate's own consent (link)" />
            </RadioGroup>
          </Field>
          <Field label="Prior-submission window (days)" hint="Re-submitting the same candidate to the same client within this window needs a reason." validationState={errors.window || serverFields.prior_submission_window_days ? "error" : "none"} validationMessage={errors.window ?? serverFields.prior_submission_window_days}>
            <Input className={styles.num} type="number" value={form.window} onChange={(_, d) => set("window", d.value)} />
          </Field>
          <Switch label="Show the bill rate in submission emails" checked={form.showBill} onChange={(_, d) => set("showBill", d.checked)} />
          <Switch label="Move to Interviewing automatically when the client is interested" checked={form.autoInterview} onChange={(_, d) => set("autoInterview", d.checked)} />
        </Card>

        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">Margin and burden</Subtitle2>} description="Margin = bill − pay × (1 + burden %). Below the minimum, a margin approval is required." />
          <Field label="Minimum margin %" validationState={errors.minMargin ? "error" : "none"} validationMessage={errors.minMargin ?? serverFields.min_margin_pct}>
            <Input className={styles.num} inputMode="decimal" value={form.minMargin} onChange={(_, d) => set("minMargin", d.value)} />
          </Field>
          <div className={styles.row}>
            {EMPLOYMENT_TYPES.map((t) => (
              <Field key={t.key} label={`Burden % — ${t.label}`} validationState={errors[`burden_${t.key}`] ? "error" : "none"} validationMessage={errors[`burden_${t.key}`]}>
                <Input className={styles.num} inputMode="decimal" value={form.burden[t.key] ?? ""} onChange={(_, d) => set("burden", { ...form.burden, [t.key]: d.value })} />
              </Field>
            ))}
          </div>
        </Card>

        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">Rejection email</Subtitle2>} />
          <Switch label="Allow sending the rejection email when rejecting" checked={form.rejectionEnabled} onChange={(_, d) => set("rejectionEnabled", d.checked)} />
          <Field label="Subject">
            <Input value={form.rejectionSubject} maxLength={300} onChange={(_, d) => set("rejectionSubject", d.value)} />
          </Field>
          <Field label="Body">
            <Textarea value={form.rejectionBody} rows={6} resize="vertical" maxLength={20000} onChange={(_, d) => set("rejectionBody", d.value)} />
          </Field>
        </Card>

        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h2">Secure link expiry</Subtitle2>} />
          {Object.entries(settings.link_days).map(([k, v]) => (
            <Text key={k}>
              {LINK_LABELS[k] ?? k.replace(/_/g, " ")}: {v} days
            </Text>
          ))}
          <Text className={styles.muted}>
            Change these in <AppLink href="/admin/settings?tab=security_privacy">Settings › Secure link expiries</AppLink>.
          </Text>
        </Card>
      </div>
      {save.isError && <ErrorBar title="Could not save." message={errorMessage(save.error)} />}
      <div className={styles.actions}>
        <Button type="submit" appearance="primary" disabled={invalid || save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined}>
          Save
        </Button>
        <Button disabled={save.isPending} onClick={() => setForm(toForm(settings))}>
          Reset
        </Button>
      </div>
    </form>
  );
}
