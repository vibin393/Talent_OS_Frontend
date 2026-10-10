"use client";

import {
  Body1,
  Button,
  Card,
  CardHeader,
  Field,
  makeStyles,
  Radio,
  RadioGroup,
  SpinButton,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { type CalendarSyncSettingsIn, calendarSyncApi, calendarSyncKeys } from "./api";
import { CHANNEL_STATUS_LABELS } from "./logic";

const useStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "960px" },
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM },
  row: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
});

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

/** `/settings/calendar-sync` "Calendar sync" (Epic 72 spec B; `integration:manage`). */
export function CalendarSyncSettingsPage() {
  const styles = useStyles();
  const canManage = usePermission("integration:manage");
  const canView = usePermission("integration:view") || canManage;
  const qc = useQueryClient();
  const toast = useAppToast();
  const s = useQuery({ queryKey: calendarSyncKeys.settings, queryFn: ({ signal }) => calendarSyncApi.settings(signal), enabled: canView });
  const ch = useQuery({ queryKey: calendarSyncKeys.channels, queryFn: ({ signal }) => calendarSyncApi.channels(signal), enabled: canView });
  const save = useMutation({
    mutationFn: (body: CalendarSyncSettingsIn) => calendarSyncApi.saveSettings(body),
    onSuccess: (data) => qc.setQueryData(calendarSyncKeys.settings, data),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const v = s.data;
  return (
    <>
      <PageHeader title="Calendar sync" subtitle="Bring interview changes back from Google and Microsoft calendars." />
      <div className={styles.page}>
        {!canView ? (
          <NoAccess what="Calendar sync settings" />
        ) : s.isPending ? (
          <GridSkeleton rows={4} />
        ) : s.isError || !v ? (
          <ErrorBar message={errorMessage(s.error)} />
        ) : (
          <>
            <Card className={styles.card}>
              <Switch
                label="Sync changes from connected calendars"
                checked={v.enabled}
                disabled={!canManage || save.isPending}
                onChange={(_, d) => save.mutate({ enabled: d.checked })}
              />
              <Field label="When someone moves an interview in their calendar">
                <RadioGroup
                  value={v.move_policy}
                  disabled={!canManage}
                  onChange={(_, d) => save.mutate({ move_policy: d.value as CalendarSyncSettingsIn["move_policy"] })}
                >
                  <Radio value="restore" label="Put it back to the Talent OS time and ask for a reschedule (recommended)" />
                  <Radio value="keep_as_proposal" label="Leave it and treat the new time as a proposal" />
                </RadioGroup>
              </Field>
              <div className={styles.row}>
                <Field label="If push notifications fail, check every (minutes)">
                  <SpinButton
                    value={v.poll_minutes}
                    min={5}
                    max={60}
                    disabled={!canManage}
                    onChange={(_, d) => d.value != null && save.mutate({ poll_minutes: d.value })}
                  />
                </Field>
                <Field label="Stop restoring after (moves per hour)">
                  <SpinButton
                    value={v.restore_limit_per_hour}
                    min={1}
                    max={10}
                    disabled={!canManage}
                    onChange={(_, d) => d.value != null && save.mutate({ restore_limit_per_hour: d.value })}
                  />
                </Field>
              </div>
            </Card>
            <Card className={styles.card}>
              <CardHeader header={<Subtitle2>Organisation free/busy</Subtitle2>} />
              <Body1>
                Show availability for people who haven&apos;t connected their own calendar. Only free/busy is read, never event details.
              </Body1>
              {v.org_source_installed ? (
                <>
                  <Switch
                    label="Use organisation free/busy"
                    checked={v.org_source_enabled}
                    disabled={!canManage}
                    onChange={(_, d) => save.mutate({ org_source_enabled: d.checked })}
                  />
                  <Body1 className={styles.muted}>Opted-out people: {v.opted_out_count}</Body1>
                </>
              ) : (
                <div className={styles.row}>
                  <Button as="a" href="/settings/integrations?connector=google_calendar_org" disabled={!canManage}>
                    Connect Google Workspace (free/busy only)
                  </Button>
                  <Button as="a" href="/settings/integrations?connector=microsoft_calendar_org" disabled={!canManage}>
                    Connect Microsoft 365 (free/busy only)
                  </Button>
                </div>
              )}
            </Card>
            <Card className={styles.card}>
              <CardHeader header={<Subtitle2>Channels</Subtitle2>} />
              <Table aria-label="Channels" size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Person</TableHeaderCell>
                    <TableHeaderCell>Provider</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Last change received</TableHeaderCell>
                    <TableHeaderCell>Last sync</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ch.data ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.person}</TableCell>
                      <TableCell>{r.provider === "microsoft" ? "Microsoft" : "Google"}</TableCell>
                      <TableCell>{CHANNEL_STATUS_LABELS[r.status]}</TableCell>
                      <TableCell>{when(r.last_notification_at)}</TableCell>
                      <TableCell>{when(r.last_sync_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
