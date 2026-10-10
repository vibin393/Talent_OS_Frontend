"use client";

import { Button, Dropdown, Field, makeStyles, Option, SpinButton, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { voiceApi, voiceKeys } from "./api";
import type { VoiceSettings } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "560px" },
});

const CHANNEL_LABELS: Record<string, string> = { email: "Email", whatsapp: "WhatsApp", sms: "SMS" };
const ORDERS: VoiceSettings["consent_channel_order"][] = [
  ["email", "whatsapp", "sms"],
  ["email", "sms", "whatsapp"],
  ["whatsapp", "email", "sms"],
  ["sms", "email", "whatsapp"],
];

/** `/settings/agents/voice-screening` (permission `ai:agent_configure`). */
export function VoiceScreeningSettings() {
  const canConfigure = usePermission("ai:agent_configure");
  const q = useQuery({ queryKey: voiceKeys.settings, queryFn: ({ signal }) => voiceApi.settings(signal), enabled: canConfigure });
  return (
    <>
      <PageHeader title="Voice screening" subtitle="Call method, consent links and upload limits for voice screens." />
      {!canConfigure ? (
        <NoAccess what="Voice screening settings" />
      ) : q.isPending ? (
        <GridSkeleton rows={3} />
      ) : q.isError ? (
        <ErrorBar title="Could not load the settings." message={errorMessage(q.error)} />
      ) : (
        <SettingsForm initial={q.data} />
      )}
    </>
  );
}

function SettingsForm({ initial }: { initial: VoiceSettings }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [value, setValue] = useState(initial);
  const save = useMutation({
    mutationFn: () =>
      voiceApi.saveSettings({
        default_provider: value.default_provider,
        consent_link_days: value.consent_link_days,
        consent_channel_order: value.consent_channel_order,
      }),
    onSuccess: (out) => {
      qc.setQueryData(voiceKeys.settings, out);
      toast.success("Settings saved.");
    },
  });
  const orderKey = value.consent_channel_order.join(",");
  return (
    <div className={styles.form}>
      <ErrorBar message={save.error ? errorMessage(save.error) : null} />
      <Field label="Default call method">
        <Dropdown
          value={value.default_provider === "fake" ? "Demo call" : "We call outside Talent OS and upload"}
          selectedOptions={[value.default_provider]}
          onOptionSelect={(_, d) => setValue({ ...value, default_provider: (d.optionValue as "manual" | "fake") ?? "manual" })}
        >
          <Option value="manual">We call outside Talent OS and upload</Option>
          {initial.fake_available && <Option value="fake">Demo call</Option>}
        </Dropdown>
      </Field>
      <Field label="Consent link valid for (days)">
        <SpinButton min={1} max={14} value={value.consent_link_days} onChange={(_, d) => setValue({ ...value, consent_link_days: Number(d.value ?? d.displayValue ?? value.consent_link_days) })} />
      </Field>
      <Field label="Send consent link by">
        <Dropdown
          value={value.consent_channel_order.map((c) => CHANNEL_LABELS[c]).join(", then ")}
          selectedOptions={[orderKey]}
          onOptionSelect={(_, d) => setValue({ ...value, consent_channel_order: (d.optionValue ?? orderKey).split(",") as VoiceSettings["consent_channel_order"] })}
        >
          {ORDERS.map((o) => (
            <Option key={o.join(",")} value={o.join(",")}>
              {o.map((c) => CHANNEL_LABELS[c]).join(", then ")}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <div>
        <Button appearance="primary" disabled={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      </div>
    </div>
  );
}
