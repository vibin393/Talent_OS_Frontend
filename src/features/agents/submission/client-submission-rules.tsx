"use client";

import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Subtitle2,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { Client360TabProps } from "@/features/clients/client-360-tabs";
import { errorMessage } from "@/lib/api/errors";
import { submissionPackKeys, submissionPacksApi } from "./api";
import { type RulesForm, rulesBody, rulesErrors } from "./logic";
import type { ClientSubmissionRulesOut, ResumeFormat } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalL, maxWidth: "720px" },
  row: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: tokens.spacingHorizontalM },
  footer: { display: "flex", gap: tokens.spacingHorizontalS },
});

const FORMAT_LABELS: Record<ResumeFormat, string> = {
  either: "Either",
  original: "Original resume only",
  client_formatted: "Client-formatted only",
};

function toForm(r: ClientSubmissionRulesOut): RulesForm {
  return {
    resume_format: r.resume_format,
    mask_contact_details: r.mask_contact_details,
    write_up_max_words: String(r.write_up_max_words),
    write_up_instructions: r.write_up_instructions ?? "",
    duplicate_window_days: r.duplicate_window_days == null ? "" : String(r.duplicate_window_days),
    require_candidate_consent: r.require_candidate_consent,
    show_notice_period: r.show_notice_period,
  };
}

/** Client 360 tab "Submission rules" (Epic 61, B3). */
export function ClientSubmissionRules({ clientId }: Client360TabProps) {
  const rules = useQuery({ queryKey: submissionPackKeys.rules(clientId), queryFn: ({ signal }) => submissionPacksApi.rules(clientId, signal) });
  if (rules.isPending) return <GridSkeleton rows={5} />;
  if (rules.isError) return <ErrorBar title="Could not load the submission rules." message={errorMessage(rules.error)} />;
  return <RulesEditor key={rules.data.updated_at ?? "default"} clientId={clientId} rules={rules.data} />;
}

function RulesEditor({ clientId, rules }: { clientId: string; rules: ClientSubmissionRulesOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canConfigure = usePermission("pipeline:configure");
  const [form, setForm] = useState<RulesForm>(() => toForm(rules));
  const errors = rulesErrors(form);
  const set = <K extends keyof RulesForm>(key: K, value: RulesForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const save = useMutation({
    mutationFn: () => submissionPacksApi.saveRules(clientId, rulesBody(form)),
    onSuccess: async () => {
      toast.success("Submission rules saved.");
      await queryClient.invalidateQueries({ queryKey: submissionPackKeys.rules(clientId) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const disabled = !canConfigure;

  return (
    <Card className={styles.root} aria-labelledby="submission-rules-title">
      <Subtitle2 as="h2" id="submission-rules-title">
        Submission rules
      </Subtitle2>
      <div className={styles.row}>
        <Field label="Resume format">
          <Dropdown
            disabled={disabled}
            value={FORMAT_LABELS[form.resume_format]}
            selectedOptions={[form.resume_format]}
            onOptionSelect={(_, d) => d.optionValue && set("resume_format", d.optionValue as ResumeFormat)}
          >
            {(Object.keys(FORMAT_LABELS) as ResumeFormat[]).map((k) => (
              <Option key={k} value={k}>
                {FORMAT_LABELS[k]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Write-up length (words)" validationMessage={errors.write_up_max_words}>
          <Input type="number" min={40} max={400} disabled={disabled} value={form.write_up_max_words} onChange={(_, d) => set("write_up_max_words", d.value)} />
        </Field>
        <Field
          label="Duplicate window (days)"
          hint={`Leave empty to use the tenant setting (${rules.tenant_duplicate_window_days} days)`}
          validationMessage={errors.duplicate_window_days}
        >
          <Input type="number" min={1} max={730} disabled={disabled} value={form.duplicate_window_days} onChange={(_, d) => set("duplicate_window_days", d.value)} />
        </Field>
      </div>
      <Checkbox disabled={disabled} checked={form.mask_contact_details} label="Hide contact details" onChange={(_, d) => set("mask_contact_details", !!d.checked)} />
      <Checkbox
        disabled={disabled}
        checked={form.require_candidate_consent}
        label="Require the candidate's own consent (no recruiter attestation)"
        onChange={(_, d) => set("require_candidate_consent", !!d.checked)}
      />
      <Checkbox disabled={disabled} checked={form.show_notice_period} label="Include notice period" onChange={(_, d) => set("show_notice_period", !!d.checked)} />
      <Field label="Write-up guidance for the agent" validationMessage={errors.write_up_instructions}>
        <Textarea disabled={disabled} value={form.write_up_instructions} maxLength={1000} rows={3} onChange={(_, d) => set("write_up_instructions", d.value)} />
      </Field>
      {canConfigure && (
        <div className={styles.footer}>
          <Button appearance="primary" disabled={save.isPending || Object.keys(errors).length > 0} onClick={() => save.mutate()}>
            Save rules
          </Button>
        </div>
      )}
    </Card>
  );
}
