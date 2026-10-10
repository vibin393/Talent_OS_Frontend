"use client";

import { Button, Field, makeStyles, MessageBar, MessageBarBody, SpinButton, Switch, Textarea, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { UserPicker } from "@/features/admin/user-picker";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { demandAgentApi, demandAgentKeys } from "./api";
import { clampInt, fromPercent, toPercent } from "./logic";
import type { AgentSettings } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "640px" },
});

/** `/settings/ai/demand-agent` -- "Demand Agent" (`ai:agent_configure`). */
export function AgentSettingsPage() {
  const canConfigure = usePermission("ai:agent_configure");
  const query = useQuery({ queryKey: demandAgentKeys.agentSettings, queryFn: ({ signal }) => demandAgentApi.agentSettings(signal), enabled: canConfigure });
  return (
    <>
      <PageHeader title="Demand Agent" subtitle="Duplicate and SLA-risk thresholds, JD template and the daily SLA scan." />
      {!canConfigure ? (
        <NoAccess what="Demand Agent settings" />
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

function SettingsForm({ data }: { data: AgentSettings }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [dup, setDup] = useState(toPercent(data.duplicate_threshold));
  const [window_, setWindow] = useState(data.duplicate_window_days);
  const [sla, setSla] = useState(toPercent(data.sla_risk_probability));
  const [digest, setDigest] = useState(data.sla_digest_max_items);
  const [roles, setRoles] = useState(data.roles_per_message_max);
  const [scanOwner, setScanOwner] = useState<string | null>(data.sla_scan_owner_id);
  const [ack, setAck] = useState(data.ack_contact_on_intake);
  const [template, setTemplate] = useState(data.jd_template_md ?? "");
  const save = useMutation({
    mutationFn: () =>
      demandAgentApi.updateAgentSettings({
        duplicate_threshold: fromPercent(dup, 50, 95),
        duplicate_window_days: clampInt(window_, 7, 365),
        sla_risk_probability: fromPercent(sla, 30, 95),
        sla_digest_max_items: clampInt(digest, 5, 100),
        roles_per_message_max: clampInt(roles, 1, 5),
        sla_scan_owner_id: scanOwner,
        ack_contact_on_intake: ack,
        jd_template_md: template.trim() || null,
      }),
    onSuccess: (out) => {
      qc.setQueryData(demandAgentKeys.agentSettings, out);
      toast.success("Settings saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const spin = (value: number, set: (n: number) => void) => (_: unknown, d: { value?: number | null; displayValue?: string }) => {
    const n = d.value ?? (d.displayValue !== undefined ? Number(d.displayValue) : value);
    if (Number.isFinite(n)) set(n);
  };
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      {data.warnings.includes("sla_scan_owner_scope_below_tenant") && (
        <MessageBar intent="warning">
          <MessageBarBody>The scan owner cannot see every demand; the daily digest will miss some.</MessageBarBody>
        </MessageBar>
      )}
      <Field label="Duplicate similarity threshold (%)">
        <SpinButton value={dup} min={50} max={95} onChange={spin(dup, setDup)} />
      </Field>
      <Field label="Look back for duplicates (days)">
        <SpinButton value={window_} min={7} max={365} onChange={spin(window_, setWindow)} />
      </Field>
      <Field label="SLA risk probability (%)">
        <SpinButton value={sla} min={30} max={95} onChange={spin(sla, setSla)} />
      </Field>
      <Field label="Most demands per daily digest">
        <SpinButton value={digest} min={5} max={100} onChange={spin(digest, setDigest)} />
      </Field>
      <Field label="Most roles per email">
        <SpinButton value={roles} min={1} max={5} onChange={spin(roles, setRoles)} />
      </Field>
      <Field hint="The scan sees only demands this person can see. Choose a manager with access to all demands.">
        <UserPicker label="Daily SLA scan runs as" value={scanOwner} onChange={(id) => setScanOwner(id)} />
      </Field>
      <Field hint="Drafts are proposals; nothing is sent without approval.">
        <Switch label="Draft an acknowledgement to the client contact" checked={ack} onChange={(_, d) => setAck(d.checked)} />
      </Field>
      <Field label="JD template" hint="Headings and order the agent follows. Placeholders are filled only from demand fields.">
        <Textarea rows={8} value={template} maxLength={10_000} onChange={(_, d) => setTemplate(d.value)} />
      </Field>
      <div>
        <Button appearance="primary" type="submit" disabled={save.isPending}>
          Save
        </Button>
      </div>
      <AppLink href="/admin/ai">Autonomy and enablement</AppLink>
    </form>
  );
}
