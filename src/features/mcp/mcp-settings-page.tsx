"use client";

import {
  Body1,
  Button,
  Card,
  CardHeader,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Switch,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { type LowToolMode, mcpApi, mcpKeys, type McpSettings } from "./api";
import { DisableDialog, EnableDialog } from "./enable-dialog";
import { LimitsFormView } from "./limits-form";
import { type LimitsForm, limitErrors } from "./logic";
import { LowToolModes } from "./low-tool-modes";
import { OriginsEditor } from "./origins-editor";
import { ToolGroupsEditor } from "./tool-groups-editor";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1100px", paddingBottom: "72px" },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: tokens.spacingHorizontalM },
  footer: {
    position: "sticky",
    bottom: 0,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    display: "flex",
    justifyContent: "flex-end",
  },
});

function limitsOf(s: McpSettings): LimitsForm {
  return {
    calls_per_minute: s.calls_per_minute ?? s.tier_calls_per_minute,
    calls_per_user_day: s.calls_per_user_day,
    proposals_per_hour: s.proposals_per_hour,
    bulk_read_threshold: s.bulk_read_threshold,
    max_results: s.max_results,
  };
}

/** Admin → AI → AI assistant access (MCP) (Epic 73, spec B2). */
export function McpSettingsPage() {
  const canConfigure = usePermission("ai:agent_configure");
  const canView = usePermission("ai:govern") || canConfigure;
  const q = useQuery({ queryKey: mcpKeys.settings, queryFn: ({ signal }) => mcpApi.settings(signal), enabled: canView });
  if (!canView) return <NoAccess what="AI assistant access settings" />;
  if (!q.data) return q.error ? <MessageBar intent="error"><MessageBarBody>{errorMessage(q.error)}</MessageBarBody></MessageBar> : <Spinner />;
  return <McpSettingsForm key={JSON.stringify(q.data)} s={q.data} canConfigure={canConfigure} />;
}

function McpSettingsForm({ s, canConfigure }: { s: McpSettings; canConfigure: boolean }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [groups, setGroups] = useState<string[]>(s.tool_groups);
  const [modes, setModes] = useState<Record<string, LowToolMode>>(s.low_tool_modes);
  const [limits, setLimits] = useState<LimitsForm>(limitsOf(s));
  const [notify, setNotify] = useState(s.notify_user_on_first_connection);
  const [origins, setOrigins] = useState<string[]>(s.allowed_origins);
  const [dialog, setDialog] = useState<"enable" | "disable" | null>(null);
  const done = (data: McpSettings) => qc.setQueryData(mcpKeys.settings, data);
  const enable = useMutation({
    mutationFn: (g: string[]) => mcpApi.enable({ notice_version: s.current_notice_version, acknowledged: true, tool_groups: g }),
    onSuccess: (d) => {
      done(d);
      setDialog(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const disable = useMutation({
    mutationFn: (reason: string) => mcpApi.disable(reason),
    onSuccess: (d) => {
      done(d);
      setDialog(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: () =>
      mcpApi.update({
        ...(s.enabled ? { tool_groups: groups } : {}),
        ...limits,
        notify_user_on_first_connection: notify,
        allowed_origins: origins,
        low_tool_modes: modes,
      }),
    onSuccess: (d) => {
      done(d);
      toast.success("Settings saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const ro = !canConfigure;
  const invalid = Object.keys(limitErrors(limits, s.tier_calls_per_minute)).length > 0 || (s.enabled && groups.length === 0);
  return (
    <div className={styles.root}>
      <PageHeader
        title="AI assistant access (MCP)"
        subtitle="Let people use their own AI assistants, such as Claude, with Talent OS tools. Assistants only see and do what the person could."
      />
      <Card>
        <div className={styles.section}>
          <Switch
            label="Allow external AI assistants"
            checked={s.enabled}
            disabled={ro || enable.isPending || disable.isPending}
            onChange={(_, d) => setDialog(d.checked ? "enable" : "disable")}
          />
          {s.kill_switch ? (
            <MessageBar intent="error">
              <MessageBarBody>AI agents are paused by the kill switch. AI assistants can&apos;t use tools.</MessageBarBody>
            </MessageBar>
          ) : null}
          {s.enabled ? (
            <Body1>
              On since {s.enabled_at ? new Date(s.enabled_at).toLocaleDateString() : "—"}
              {s.enabled_by_name ? ` by ${s.enabled_by_name}` : ""}. Notice version {s.notice_version}.
            </Body1>
          ) : (
            <MessageBar intent="info">
              <MessageBarBody>Off. AI assistants can&apos;t connect.</MessageBarBody>
            </MessageBar>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader header={<Subtitle2 as="h2">Tool groups</Subtitle2>} />
        <ToolGroupsEditor groups={s.groups} value={groups} modes={modes} disabled={ro || !s.enabled} onChange={setGroups} />
      </Card>
      <Card>
        <CardHeader header={<Subtitle2 as="h2">Creating items</Subtitle2>} />
        <LowToolModes value={modes} disabled={ro} onChange={setModes} />
      </Card>
      <Card>
        <CardHeader header={<Subtitle2 as="h2">Limits</Subtitle2>} />
        <LimitsFormView value={limits} tier={s.tier_calls_per_minute} notify={notify} disabled={ro} onChange={setLimits} onNotify={setNotify} />
      </Card>
      <Card>
        <CardHeader header={<Subtitle2 as="h2">Browser-based assistants</Subtitle2>} />
        <OriginsEditor value={origins} disabled={ro} onChange={setOrigins} />
      </Card>
      <Card>
        <CardHeader header={<Subtitle2 as="h2">Connected assistant apps</Subtitle2>} action={<AppLink href="/settings/integrations">Manage in Marketplace</AppLink>} />
        <div className={styles.section}>
          <Body1>Assistant apps (such as Claude) are installed from the Marketplace. Server URL: {s.server_url}</Body1>
        </div>
      </Card>
      {canConfigure ? (
        <div className={styles.footer}>
          <Button appearance="primary" disabled={invalid || save.isPending} onClick={() => save.mutate()}>
            Save changes
          </Button>
        </div>
      ) : null}
      {dialog === "enable" ? (
        <EnableDialog open settings={s} busy={enable.isPending} onCancel={() => setDialog(null)} onConfirm={(g) => enable.mutate(g)} />
      ) : null}
      {dialog === "disable" ? <DisableDialog open busy={disable.isPending} onCancel={() => setDialog(null)} onConfirm={(r) => disable.mutate(r)} /> : null}
    </div>
  );
}
