"use client";

import { Button, Field, makeStyles, SpinButton, Switch, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { interviewAssistantApi, interviewAssistantKeys } from "./api";
import type { AssistantSettings } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "560px" },
});

/** `/settings/agents/interview-assistant` (permission `ai:agent_configure`). */
export function InterviewAssistantSettings() {
  const canConfigure = usePermission("ai:agent_configure");
  const query = useQuery({ queryKey: interviewAssistantKeys.settings, queryFn: ({ signal }) => interviewAssistantApi.settings(signal), enabled: canConfigure });
  return (
    <>
      <PageHeader title="Interview Assistant" subtitle="Interview recording uploads, consent links and AI rating suggestions." />
      {!canConfigure ? (
        <NoAccess what="Interview Assistant settings" />
      ) : query.isPending ? (
        <GridSkeleton rows={4} />
      ) : query.isError ? (
        <ErrorBar title="Could not load the settings." message={errorMessage(query.error)} />
      ) : (
        <SettingsForm key={query.dataUpdatedAt} data={query.data} />
      )}
    </>
  );
}

function SettingsForm({ data }: { data: AssistantSettings }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<AssistantSettings>(data);
  const save = useMutation({
    mutationFn: () => interviewAssistantApi.saveSettings({ ...form, consent_link_days: Math.min(30, Math.max(1, Math.round(form.consent_link_days))) }),
    onSuccess: (out) => {
      qc.setQueryData(interviewAssistantKeys.settings, out);
      toast.success("Settings saved.");
    },
  });
  return (
    <div className={styles.form}>
      <ErrorBar message={save.error ? errorMessage(save.error) : null} />
      <Switch
        checked={form.show_suggestions_by_default}
        onChange={(_, d) => setForm((f) => ({ ...f, show_suggestions_by_default: d.checked }))}
        label="Show AI rating suggestions by default"
      />
      <Switch checked={form.allow_recording_upload} onChange={(_, d) => setForm((f) => ({ ...f, allow_recording_upload: d.checked }))} label="Allow recording uploads" />
      <Switch checked={form.allow_transcript_upload} onChange={(_, d) => setForm((f) => ({ ...f, allow_transcript_upload: d.checked }))} label="Allow transcript uploads" />
      <Field label="Consent link valid for (days)">
        <SpinButton min={1} max={30} value={form.consent_link_days} onChange={(_, d) => setForm((f) => ({ ...f, consent_link_days: Number(d.value ?? d.displayValue ?? f.consent_link_days) || f.consent_link_days }))} />
      </Field>
      <div>
        <Button appearance="primary" disabled={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      </div>
    </div>
  );
}
