"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Subtitle2,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { type AppPolicy, ecosystemApi, ecosystemKeys, type EcosystemState, type PublisherKind } from "./api";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "880px" },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center", flexWrap: "wrap" },
});

const PUBLISHERS: { kind: PublisherKind; label: string }[] = [
  { kind: "platform", label: "Apps published by Talent OS" },
  { kind: "partner", label: "Apps from verified partners" },
  { kind: "tenant", label: "Your organisation's private apps" },
];

/** Settings → Integrations (Epic 66 placeholder; Epics 69 and 79 extend the page). */
export function IntegrationsSettingsPage() {
  const styles = useStyles();
  const canView = usePermission("integration:view");
  const q = useQuery({ queryKey: ecosystemKeys.state, queryFn: ({ signal }) => ecosystemApi.state(signal), enabled: canView });
  if (!canView)
    return (
      <>
        <PageHeader title="Integrations" />
        <NoAccess what="integrations" />
      </>
    );
  return (
    <div className={styles.root}>
      <PageHeader title="Integrations" subtitle="Apps, connectors and external access to your workspace." />
      {q.error ? (
        <MessageBar intent="error">
          <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
        </MessageBar>
      ) : null}
      {q.data ? <KillSwitchCard state={q.data} /> : null}
      {q.data ? <AppPolicyCard state={q.data} /> : null}
      {/* Epic 68: Webhooks entry card. */}
      <Card>
        <CardHeader header={<Subtitle2>Webhooks</Subtitle2>} description={<Caption1>Send event notifications to your systems.</Caption1>} />
        <div className={styles.body}>
          <div>
            <Button as="a" href="/settings/integrations/webhooks">
              Manage webhooks
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function KillSwitchCard({ state }: { state: EcosystemState }) {
  const styles = useStyles();
  const canKill = usePermission("ecosystem:kill_switch");
  const toast = useAppToast();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const toggle = useMutation({
    mutationFn: () => ecosystemApi.setKillSwitch(!state.kill_switch_on, reason.trim()),
    onSuccess: (next) => {
      qc.setQueryData(ecosystemKeys.state, next);
      setReason("");
      toast.success(next.kill_switch_on ? "External access suspended." : "External access restored.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const suspended = state.kill_switch_on || state.platform_suspended || state.global_suspended;
  return (
    <Card>
      <CardHeader
        header={<Subtitle2>Ecosystem kill switch</Subtitle2>}
        action={
          <Badge appearance="tint" color={suspended ? "danger" : "success"}>
            {suspended ? "External access suspended" : "External access on"}
          </Badge>
        }
      />
      <div className={styles.body}>
        <Body1>
          Suspends every app, API key, webhook, connector and AI assistant connection at once. People keep using Talent
          OS; portals and internal AI agents are not affected.
        </Body1>
        {state.platform_suspended || state.global_suspended ? (
          <MessageBar intent="warning">
            <MessageBarBody>
              Talent OS suspended external access to this workspace
              {state.platform_suspended_reason ? `: ${state.platform_suspended_reason}` : "."}
            </MessageBarBody>
          </MessageBar>
        ) : null}
        {state.kill_switch_on && state.kill_switch_reason ? (
          <Caption1>Reason given: {state.kill_switch_reason}</Caption1>
        ) : null}
        {canKill ? (
          <>
            <Field label="Reason" required hint="Recorded in the audit log and sent to the admins.">
              <Textarea value={reason} maxLength={500} onChange={(_, d) => setReason(d.value)} />
            </Field>
            <div className={styles.row}>
              <Button
                appearance="primary"
                disabled={!reason.trim() || toggle.isPending}
                onClick={() => toggle.mutate()}
              >
                {state.kill_switch_on ? "Restore external access" : "Suspend external access"}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}

function AppPolicyCard({ state }: { state: EcosystemState }) {
  const styles = useStyles();
  const canManage = usePermission("integration:manage");
  const toast = useAppToast();
  const qc = useQueryClient();
  const [policy, setPolicy] = useState<AppPolicy>(state.app_policy);
  const save = useMutation({
    mutationFn: () => ecosystemApi.setAppPolicy(policy),
    onSuccess: (next) => {
      qc.setQueryData(ecosystemKeys.state, next);
      toast.success("App policy saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggleKind = (kind: PublisherKind, on: boolean) =>
    setPolicy((p) => ({
      ...p,
      publisher_kinds: on ? [...new Set([...p.publisher_kinds, kind])] : p.publisher_kinds.filter((k) => k !== kind),
    }));
  return (
    <Card>
      <CardHeader header={<Subtitle2>App policy</Subtitle2>} />
      <div className={styles.body}>
        <Body1>Which apps people in your workspace may install or authorise. Changing it never widens an existing grant.</Body1>
        {PUBLISHERS.map(({ kind, label }) => (
          <Checkbox
            key={kind}
            label={label}
            disabled={!canManage}
            checked={policy.publisher_kinds.includes(kind)}
            onChange={(_, d) => toggleKind(kind, Boolean(d.checked))}
          />
        ))}
        <Checkbox
          label="Let people connect apps to their own account"
          disabled={!canManage}
          checked={policy.user_self_authorize}
          onChange={(_, d) => setPolicy((p) => ({ ...p, user_self_authorize: Boolean(d.checked) }))}
        />
        {canManage ? (
          <div className={styles.row}>
            <Button appearance="primary" disabled={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
