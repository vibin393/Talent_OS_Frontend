"use client";

/**
 * Copilot settings (Epic 54 B7, `/settings/ai/copilot`, `ai:agent_configure`): turn on (foundation agents API),
 * retention, rate limit, draft expiry, feedback comments, and the usage grid (`ai:govern`; metadata only).
 */
import {
  Body1,
  Button,
  Card,
  Caption1,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  SpinButton,
  Subtitle2,
  Switch,
  type TableColumnDefinition,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { hasPermission } from "@/features/auth/permissions";
import { useMe } from "@/features/auth/use-me";
import { errorMessage } from "@/lib/api/errors";
import { copilotApi, copilotKeys } from "./api";
import type { CopilotSettings, CopilotSettingsIn, UsageDay } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "880px" },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: tokens.spacingHorizontalL },
  muted: { color: tokens.colorNeutralForeground3 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS },
});

const LIMITS = {
  retention_days: [7, 365],
  questions_per_hour: [5, 300],
  draft_expiry_hours: [1, 72],
} as const;

const usageColumns: TableColumnDefinition<UsageDay>[] = [
  createTableColumn<UsageDay>({ columnId: "day", renderHeaderCell: () => "Day", renderCell: (d) => d.day }),
  createTableColumn<UsageDay>({ columnId: "conversations", renderHeaderCell: () => "Conversations", renderCell: (d) => d.conversations }),
  createTableColumn<UsageDay>({ columnId: "turns", renderHeaderCell: () => "Questions", renderCell: (d) => d.turns }),
  createTableColumn<UsageDay>({ columnId: "users", renderHeaderCell: () => "Active users", renderCell: (d) => d.active_users }),
  createTableColumn<UsageDay>({
    columnId: "tokens",
    renderHeaderCell: () => "Tokens",
    renderCell: (d) => (d.input_tokens + d.output_tokens).toLocaleString("en-IN"),
  }),
  createTableColumn<UsageDay>({
    columnId: "cost",
    renderHeaderCell: () => "Cost (USD)",
    renderCell: (d) => (d.cost_micros / 1_000_000).toFixed(2),
  }),
  createTableColumn<UsageDay>({
    columnId: "helpful",
    renderHeaderCell: () => "Helpful",
    renderCell: (d) => (d.helpful_pct === null ? "—" : `${d.helpful_pct}%`),
  }),
  createTableColumn<UsageDay>({
    columnId: "failures",
    renderHeaderCell: () => "Failures",
    renderCell: (d) =>
      Object.entries(d.failures)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ") || "—",
  }),
];

function clamp(key: keyof typeof LIMITS, value: number): number {
  const [lo, hi] = LIMITS[key];
  return Math.min(hi, Math.max(lo, Math.round(value)));
}

export function CopilotSettingsPage() {
  const styles = useStyles();
  const me = useMe();
  const canConfigure = hasPermission(me.data?.permissions, "ai:agent_configure");
  const canGovern = hasPermission(me.data?.permissions, "ai:govern");
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: copilotKeys.settings,
    queryFn: ({ signal }) => copilotApi.settings(signal),
    enabled: canConfigure || canGovern,
  });
  const usage = useQuery({ queryKey: copilotKeys.usage(), queryFn: ({ signal }) => copilotApi.usage(undefined, undefined, signal), enabled: canGovern });
  const [draft, setDraft] = useState<CopilotSettingsIn>({});
  const save = useMutation({
    mutationFn: (body: CopilotSettingsIn) => copilotApi.saveSettings(body),
    onSuccess: (out) => {
      qc.setQueryData(copilotKeys.settings, out);
      setDraft({});
    },
  });
  const enable = useMutation({
    mutationFn: (on: boolean) => copilotApi.setEnabled(on),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: copilotKeys.settings });
      void qc.invalidateQueries({ queryKey: copilotKeys.status });
    },
  });

  if (!canConfigure && !canGovern) {
    return (
      <MessageBar intent="warning">
        <MessageBarBody>You don&apos;t have access to the Copilot settings.</MessageBarBody>
      </MessageBar>
    );
  }
  if (settings.isPending) return <Spinner label="Loading Copilot settings" />;
  if (settings.isError) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{errorMessage(settings.error)}</MessageBarBody>
      </MessageBar>
    );
  }
  const s: CopilotSettings = { ...settings.data, ...draft } as CopilotSettings;
  const set = (patch: CopilotSettingsIn) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = Object.keys(draft).length > 0;

  return (
    <div className={styles.root}>
      <PageHeader title="Copilot" />
      <Card className={styles.card}>
        <Switch
          label="Turn on Copilot"
          checked={settings.data.enabled}
          disabled={!canConfigure || !settings.data.agentic_enabled || enable.isPending}
          onChange={(_, d) => enable.mutate(d.checked)}
        />
        {!settings.data.agentic_enabled ? <Caption1 className={styles.muted}>Turn on AI agents for your organisation first</Caption1> : null}
        {enable.isError ? (
          <MessageBar intent="error">
            <MessageBarBody>{errorMessage(enable.error)}</MessageBarBody>
          </MessageBar>
        ) : null}
        <div className={styles.grid}>
          <Field label="Keep conversations for (days)">
            <SpinButton
              value={s.retention_days}
              min={7}
              max={365}
              disabled={!canConfigure}
              onChange={(_, d) => set({ retention_days: clamp("retention_days", Number(d.value ?? d.displayValue ?? s.retention_days)) })}
            />
          </Field>
          <Field label="Questions per person per hour">
            <SpinButton
              value={s.questions_per_hour}
              min={5}
              max={300}
              disabled={!canConfigure}
              onChange={(_, d) => set({ questions_per_hour: clamp("questions_per_hour", Number(d.value ?? d.displayValue ?? s.questions_per_hour)) })}
            />
          </Field>
          <Field label="Drafts expire after (hours)">
            <SpinButton
              value={s.draft_expiry_hours}
              min={1}
              max={72}
              disabled={!canConfigure}
              onChange={(_, d) => set({ draft_expiry_hours: clamp("draft_expiry_hours", Number(d.value ?? d.displayValue ?? s.draft_expiry_hours)) })}
            />
          </Field>
        </div>
        <Switch
          label="Allow feedback comments"
          checked={s.allow_feedback_comments}
          disabled={!canConfigure}
          onChange={(_, d) => set({ allow_feedback_comments: d.checked })}
        />
        <Body1 className={styles.muted}>Admins can see usage, cost and ratings, never conversation content.</Body1>
        {save.isError ? (
          <MessageBar intent="error">
            <MessageBarBody>{errorMessage(save.error)}</MessageBarBody>
          </MessageBar>
        ) : null}
        {canConfigure ? (
          <div className={styles.actions}>
            <Button appearance="primary" disabled={!dirty || save.isPending} onClick={() => save.mutate(draft)}>
              Save
            </Button>
          </div>
        ) : null}
      </Card>
      {canGovern ? (
        <Card className={styles.card}>
          <Subtitle2 as="h2">Usage</Subtitle2>
          {usage.isPending ? <Spinner size="small" label="Loading usage" /> : null}
          {usage.isError ? (
            <MessageBar intent="error">
              <MessageBarBody>{errorMessage(usage.error)}</MessageBarBody>
            </MessageBar>
          ) : null}
          {usage.data ? (
            <DataGrid items={usage.data.days} columns={usageColumns} getRowId={(d: UsageDay) => d.day} aria-label="Copilot usage by day">
              <DataGridHeader>
                <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
              </DataGridHeader>
              <DataGridBody<UsageDay>>
                {({ item, rowId }) => (
                  <DataGridRow<UsageDay> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
          ) : null}
          {usage.data?.comments.length ? (
            <div>
              <Subtitle2 as="h3">Feedback comments</Subtitle2>
              {usage.data.comments.map((c) => (
                <Body1 as="p" key={`${c.run_id}-${c.created_at}`}>{`${c.rating === "helpful" ? "Helpful" : "Not helpful"}: ${c.comment}`}</Body1>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
