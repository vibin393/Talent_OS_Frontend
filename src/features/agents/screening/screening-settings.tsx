"use client";

import { Button, Dropdown, Field, Input, makeStyles, Option, SpinButton, Spinner, Switch, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { messagingApi, messagingKeys } from "@/features/messaging/api";
import { errorMessage } from "@/lib/api/errors";
import { screeningAgentApi, screeningAgentKeys } from "./api";
import { START_CHANNEL_LABELS, toNumber } from "./logic";
import type { ScreeningAgentSettingsIn, ScreeningAgentSettingsOut, StartChannel } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "560px" },
  actions: { display: "flex", gap: tokens.spacingHorizontalS },
});

const DEFAULT_CHANNELS: StartChannel[] = ["auto", "portal_chat", "link_chat", "whatsapp"];
const NONE = "__none__";

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Stop words from a comma / newline separated list (trimmed, unique, at most 30 of ≤ 40 chars). */
export function parseStopWords(raw: string): string[] {
  const out: string[] = [];
  for (const w of raw.split(/[,\n]/)) {
    const t = w.trim().toLowerCase().slice(0, 40);
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 30);
}

/** `/settings/agents/screening` (permission `ai:agent_configure`). */
export function ScreeningAgentSettings() {
  const canConfigure = usePermission("ai:agent_configure");
  const query = useQuery({ queryKey: screeningAgentKeys.settings, queryFn: ({ signal }) => screeningAgentApi.settings(signal), enabled: canConfigure });
  return (
    <>
      <PageHeader title="Screening Agent" subtitle="How the Screening Agent runs pre-screening conversations with candidates." />
      {!canConfigure ? (
        <NoAccess what="Screening Agent settings" />
      ) : query.isPending ? (
        <GridSkeleton rows={8} />
      ) : query.isError ? (
        <ErrorBar title="Could not load the settings." message={errorMessage(query.error)} />
      ) : (
        <SettingsForm key={query.dataUpdatedAt} data={query.data} />
      )}
    </>
  );
}

function SettingsForm({ data }: { data: ScreeningAgentSettingsOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [expiry, setExpiry] = useState(data.expiry_days);
  const [reminderAfter, setReminderAfter] = useState(data.reminder_after_hours);
  const [maxReminders, setMaxReminders] = useState(data.max_reminders);
  const [perTurn, setPerTurn] = useState(data.questions_per_turn);
  const [threshold, setThreshold] = useState(toNumber(data.low_confidence_threshold) ?? 0.7);
  const [stopWords, setStopWords] = useState(data.stop_words.join(", "));
  const [channel, setChannel] = useState<StartChannel>(data.default_channel);
  const [waTemplate, setWaTemplate] = useState<string | null>(data.whatsapp_invite_template_id);
  const [campus, setCampus] = useState(data.allow_campus_candidates);
  const templates = useQuery({
    queryKey: messagingKeys.templates("whatsapp", "approved"),
    queryFn: ({ signal }) => messagingApi.templates("whatsapp", "approved", signal),
    retry: false,
  });
  const save = useMutation({
    mutationFn: () => {
      const body: ScreeningAgentSettingsIn = {
        expiry_days: clamp(expiry, 1, 14),
        reminder_after_hours: clamp(reminderAfter, 4, 72),
        max_reminders: clamp(maxReminders, 0, 2),
        questions_per_turn: clamp(perTurn, 1, 3),
        low_confidence_threshold: clamp(threshold, 0.5, 0.95).toFixed(2),
        stop_words: parseStopWords(stopWords),
        default_channel: channel,
        whatsapp_invite_template_id: waTemplate,
        allow_campus_candidates: campus,
      };
      return screeningAgentApi.updateSettings(body);
    },
    onSuccess: (out) => {
      queryClient.setQueryData(screeningAgentKeys.settings, out);
      toast.success("Settings saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const spin = (value: number, set: (n: number) => void) => (_: unknown, d: { value?: number | null; displayValue?: string }) => {
    const n = d.value ?? (d.displayValue !== undefined ? Number(d.displayValue) : value);
    if (Number.isFinite(n)) set(n);
  };
  const waOptions = templates.data ?? [];
  const waLabel = waOptions.find((t) => t.id === waTemplate)?.name ?? (waTemplate ? "Selected template" : "None");

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Field label="Expire after (days)" hint="1 to 14 days">
        <SpinButton value={expiry} min={1} max={14} onChange={spin(expiry, setExpiry)} />
      </Field>
      <Field label="First reminder after (hours)" hint="4 to 72 hours">
        <SpinButton value={reminderAfter} min={4} max={72} onChange={spin(reminderAfter, setReminderAfter)} />
      </Field>
      <Field label="Maximum reminders" hint="0 to 2 templated reminders, within quiet hours">
        <SpinButton value={maxReminders} min={0} max={2} onChange={spin(maxReminders, setMaxReminders)} />
      </Field>
      <Field label="Questions per message" hint="1 to 3">
        <SpinButton value={perTurn} min={1} max={3} onChange={spin(perTurn, setPerTurn)} />
      </Field>
      <Field label="Low-confidence threshold" hint="Answers below this confidence are highlighted and never accepted automatically (0.50 to 0.95)">
        <SpinButton value={threshold} min={0.5} max={0.95} step={0.05} precision={2} onChange={spin(threshold, setThreshold)} />
      </Field>
      <Field label="Stop words" hint="Comma-separated. A candidate message with one of these ends the AI conversation and hands it to you.">
        <Input value={stopWords} onChange={(_, d) => setStopWords(d.value)} />
      </Field>
      <Field label="Default channel">
        <Dropdown value={START_CHANNEL_LABELS[channel]} selectedOptions={[channel]} onOptionSelect={(_, d) => d.optionValue && setChannel(d.optionValue as StartChannel)}>
          {DEFAULT_CHANNELS.map((c) => (
            <Option key={c} value={c}>
              {START_CHANNEL_LABELS[c]}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Field label="WhatsApp invitation template" hint="WhatsApp conversations must open with an approved template.">
        <Dropdown
          value={waLabel}
          selectedOptions={[waTemplate ?? NONE]}
          onOptionSelect={(_, d) => setWaTemplate(d.optionValue === NONE || !d.optionValue ? null : d.optionValue)}
        >
          <Option value={NONE}>None</Option>
          {waOptions.map((t) => (
            <Option key={t.id} value={t.id}>
              {t.name}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Switch label="Include campus candidates" checked={campus} onChange={(_, d) => setCampus(d.checked)} />
      <div className={styles.actions}>
        <Button type="submit" appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined}>
          Save
        </Button>
      </div>
    </form>
  );
}
