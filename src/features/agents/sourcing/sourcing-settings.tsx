"use client";

import { Button, Caption1, Dropdown, Field, makeStyles, Option, SpinButton, Spinner, Switch, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { sequenceKeys, sequencesApi } from "@/features/sequences/api";
import { errorMessage } from "@/lib/api/errors";
import { sourcingApi, sourcingKeys } from "./api";
import { CHANNEL_LABELS, CHANNELS } from "./logic";
import type { Channel, SourcingSettingsOut } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "560px" },
  actions: { display: "flex", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

const NONE = "__none__";

export function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** `/settings/agents/sourcing` (permission `ai:agent_configure`). */
export function SourcingAgentSettings() {
  const canConfigure = usePermission("ai:agent_configure");
  const query = useQuery({ queryKey: sourcingKeys.settings, queryFn: ({ signal }) => sourcingApi.settings(signal), enabled: canConfigure });
  return (
    <>
      <PageHeader title="Sourcing Agent" subtitle="Shortlist size and outreach drafting for the Sourcing Agent." />
      {!canConfigure ? (
        <NoAccess what="Sourcing Agent settings" />
      ) : query.isPending ? (
        <GridSkeleton rows={7} />
      ) : query.isError ? (
        <ErrorBar title="Could not load the settings." message={errorMessage(query.error)} />
      ) : (
        <SettingsForm key={query.dataUpdatedAt} data={query.data} />
      )}
    </>
  );
}

function SettingsForm({ data }: { data: SourcingSettingsOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [topN, setTopN] = useState(data.top_n);
  const [draftTop, setDraftTop] = useState(data.draft_top);
  const [channel, setChannel] = useState<Channel>(data.preferred_channel);
  const [silver, setSilver] = useState(data.include_silver_medalists);
  const [searches, setSearches] = useState(data.max_searches);
  const [pipelineAdds, setPipelineAdds] = useState(data.propose_pipeline_adds);
  const [sequenceId, setSequenceId] = useState<string | null>(data.propose_sequence_id);
  const sequences = useQuery({ queryKey: sequenceKeys.list, queryFn: ({ signal }) => sequencesApi.list(signal), retry: false });
  const save = useMutation({
    mutationFn: () =>
      sourcingApi.updateSettings({
        top_n: clampInt(topN, 5, 100),
        draft_top: clampInt(draftTop, 0, 25),
        preferred_channel: channel,
        include_silver_medalists: silver,
        max_searches: clampInt(searches, 0, 5),
        propose_pipeline_adds: pipelineAdds,
        ...(sequenceId ? { propose_sequence_id: sequenceId } : { clear_sequence: true }),
      }),
    onSuccess: (out) => {
      qc.setQueryData(sourcingKeys.settings, out);
      toast.success("Settings saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const spin = (value: number, set: (n: number) => void) => (_: unknown, d: { value?: number | null; displayValue?: string }) => {
    const n = d.value ?? (d.displayValue !== undefined ? Number(d.displayValue) : value);
    if (Number.isFinite(n)) set(n);
  };
  const activeSequences = (sequences.data ?? []).filter((s) => s.status === "active");
  const sequenceLabel = activeSequences.find((s) => s.id === sequenceId)?.name ?? (sequenceId ? "Selected Sequence" : "None");

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Field label="Shortlist size" hint="5 to 100 people">
        <SpinButton value={topN} min={5} max={100} onChange={spin(topN, setTopN)} />
      </Field>
      <Field label="Drafts for top" hint="Outreach drafts for the top 0 to 25 entries">
        <SpinButton value={draftTop} min={0} max={25} onChange={spin(draftTop, setDraftTop)} />
      </Field>
      <Field label="Preferred channel">
        <Dropdown value={CHANNEL_LABELS[channel]} selectedOptions={[channel]} onOptionSelect={(_, d) => d.optionValue && setChannel(d.optionValue as Channel)}>
          {CHANNELS.map((c) => (
            <Option key={c} value={c}>
              {CHANNEL_LABELS[c]}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Switch label="Include silver medalists" checked={silver} onChange={(_, d) => setSilver(d.checked)} />
      <Field label="Searches per run" hint="0 to 5 structured searches of your own database">
        <SpinButton value={searches} min={0} max={5} onChange={spin(searches, setSearches)} />
      </Field>
      <Switch label="Let the agent propose pipeline adds" checked={pipelineAdds} onChange={(_, d) => setPipelineAdds(d.checked)} />
      <Field label="Propose enrolment in Sequence" hint="The agent may propose enrolling shortlisted people in this Sequence; a person approves.">
        <Dropdown
          value={sequenceLabel}
          selectedOptions={[sequenceId ?? NONE]}
          onOptionSelect={(_, d) => setSequenceId(d.optionValue === NONE || !d.optionValue ? null : d.optionValue)}
        >
          <Option value={NONE}>None</Option>
          {activeSequences.map((s) => (
            <Option key={s.id} value={s.id}>
              {s.name}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <div className={styles.actions}>
        <Button type="submit" appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined}>
          Save
        </Button>
      </div>
      <Caption1 className={styles.muted}>The agent never sources outside your own data and never changes match scores.</Caption1>
    </form>
  );
}
