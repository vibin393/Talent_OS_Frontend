"use client";

import { Button, Checkbox, Dropdown, Field, Input, makeStyles, Option, SpinButton, Spinner, Tag, TagGroup, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { schedulingApi, schedulingKeys } from "./api";
import { offsetLabel } from "./logic";
import type { SchedulingSettingsOut } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "560px" },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  actions: { display: "flex", gap: tokens.spacingHorizontalS },
});

const OFFSET_CHOICES = [10080, 2880, 1440, 240, 120, 60, 30];

export function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** `/settings/agents/scheduling` (permission `ai:agent_configure`). */
export function SchedulingSettings() {
  const canConfigure = usePermission("ai:agent_configure");
  const query = useQuery({ queryKey: schedulingKeys.settings, queryFn: ({ signal }) => schedulingApi.settings(signal), enabled: canConfigure });
  return (
    <>
      <PageHeader title="Scheduling Agent" subtitle="How the Scheduling Agent offers interview times, negotiates and reminds." />
      {!canConfigure ? (
        <NoAccess what="Scheduling Agent settings" />
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

function SettingsForm({ data }: { data: SchedulingSettingsOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [maxSlots, setMaxSlots] = useState(data.max_slots);
  const [horizon, setHorizon] = useState(data.horizon_business_days);
  const [step, setStep] = useState<15 | 30 | 60>(data.slot_step_minutes);
  const [buffer, setBuffer] = useState(data.default_buffer_minutes);
  const [candStart, setCandStart] = useState(data.candidate_hours.start);
  const [candEnd, setCandEnd] = useState(data.candidate_hours.end);
  const [rounds, setRounds] = useState(data.max_rounds);
  const [linkDays, setLinkDays] = useState(data.link_days);
  const [offsets, setOffsets] = useState<number[]>(data.reminder_offsets_minutes);
  const [channels, setChannels] = useState(data.reminder_channels);
  const [nudgeAfter, setNudgeAfter] = useState(data.scorecard_nudge_after_hours);
  const [nudgeMax, setNudgeMax] = useState(data.scorecard_nudge_max);
  const save = useMutation({
    mutationFn: () =>
      schedulingApi.updateSettings({
        max_slots: clampInt(maxSlots, 1, 10),
        horizon_business_days: clampInt(horizon, 3, 20),
        slot_step_minutes: step,
        default_buffer_minutes: clampInt(buffer, 0, 60),
        candidate_hours: { start: candStart, end: candEnd },
        max_rounds: clampInt(rounds, 1, 5),
        link_days: clampInt(linkDays, 1, 14),
        reminder_offsets_minutes: offsets,
        reminder_channels: channels,
        scorecard_nudge_after_hours: clampInt(nudgeAfter, 2, 72),
        scorecard_nudge_max: clampInt(nudgeMax, 0, 5),
      }),
    onSuccess: (out) => {
      queryClient.setQueryData(schedulingKeys.settings, out);
      toast.success("Settings saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const spin = (value: number, set: (n: number) => void) => (_: unknown, d: { value?: number | null; displayValue?: string }) => {
    const n = d.value ?? (d.displayValue !== undefined ? Number(d.displayValue) : value);
    if (Number.isFinite(n)) set(n);
  };
  const addOffset = (m: number) => setOffsets((o) => (o.includes(m) || o.length >= 4 ? o : [...o, m].sort((a, b) => b - a)));

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Field label="Slots to offer" hint="1 to 10">
        <SpinButton value={maxSlots} min={1} max={10} onChange={spin(maxSlots, setMaxSlots)} />
      </Field>
      <Field label="Look ahead (business days)" hint="3 to 20">
        <SpinButton value={horizon} min={3} max={20} onChange={spin(horizon, setHorizon)} />
      </Field>
      <Field label="Slot step">
        <Dropdown value={`${step} min`} selectedOptions={[String(step)]} onOptionSelect={(_, d) => d.optionValue && setStep(Number(d.optionValue) as 15 | 30 | 60)}>
          {[15, 30, 60].map((s) => (
            <Option key={s} value={String(s)}>{`${s} min`}</Option>
          ))}
        </Dropdown>
      </Field>
      <Field label="Default buffer" hint="Minutes before and after other meetings (0 to 60)">
        <SpinButton value={buffer} min={0} max={60} step={5} onChange={spin(buffer, setBuffer)} />
      </Field>
      <div className={styles.row} role="group" aria-label="Candidate hours">
        <Field label="Candidate hours from">
          <Input type="time" value={candStart} onChange={(_, d) => setCandStart(d.value)} />
        </Field>
        <Field label="to">
          <Input type="time" value={candEnd === "24:00" ? "23:59" : candEnd} onChange={(_, d) => setCandEnd(d.value)} />
        </Field>
      </div>
      <Field label="Negotiation rounds" hint="After this many rounds without agreement the request goes to the recruiter (1 to 5)">
        <SpinButton value={rounds} min={1} max={5} onChange={spin(rounds, setRounds)} />
      </Field>
      <Field label="Link valid for (days)" hint="1 to 14">
        <SpinButton value={linkDays} min={1} max={14} onChange={spin(linkDays, setLinkDays)} />
      </Field>
      <Field label="Reminders before interview" hint="Up to 4">
        <div className={styles.row}>
          <TagGroup aria-label="Reminders before interview" onDismiss={(_, d) => setOffsets((o) => o.filter((m) => String(m) !== d.value))}>
            {offsets.map((m) => (
              <Tag key={m} value={String(m)} dismissible dismissIcon={{ "aria-label": `Remove ${offsetLabel(m)}` }}>
                {offsetLabel(m)}
              </Tag>
            ))}
          </TagGroup>
          <Dropdown placeholder="Add a reminder" selectedOptions={[]} onOptionSelect={(_, d) => d.optionValue && addOffset(Number(d.optionValue))}>
            {OFFSET_CHOICES.filter((m) => !offsets.includes(m)).map((m) => (
              <Option key={m} value={String(m)}>
                {offsetLabel(m)}
              </Option>
            ))}
          </Dropdown>
        </div>
      </Field>
      <Field label="Reminder channels">
        <div className={styles.row}>
          {(["email", "whatsapp"] as const).map((c) => (
            <Checkbox
              key={c}
              label={c === "email" ? "Email" : "WhatsApp"}
              checked={channels.includes(c)}
              onChange={(_, d) => setChannels((cs) => (d.checked ? [...cs.filter((x) => x !== c), c] : cs.filter((x) => x !== c)))}
            />
          ))}
        </div>
      </Field>
      <Field label="Scorecard nudge after (hours)" hint="2 to 72">
        <SpinButton value={nudgeAfter} min={2} max={72} onChange={spin(nudgeAfter, setNudgeAfter)} />
      </Field>
      <Field label="Maximum nudges" hint="0 to 5">
        <SpinButton value={nudgeMax} min={0} max={5} onChange={spin(nudgeMax, setNudgeMax)} />
      </Field>
      <div className={styles.actions}>
        <Button type="submit" appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined}>
          Save
        </Button>
      </div>
    </form>
  );
}
