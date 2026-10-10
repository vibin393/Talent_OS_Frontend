"use client";

import { Badge, Button, Caption1, makeStyles, Subtitle2, Switch, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { calendarSyncApi, calendarSyncKeys } from "./api";
import { syncStatusText } from "./logic";

const useStyles = makeStyles({
  box: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, marginTop: tokens.spacingVerticalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** "Calendar sync" section of a connected provider card (Epic 72 spec B, additive on /settings/connections). */
export function SyncStatusSection({ connectionId }: { connectionId: string }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const me = useQuery({ queryKey: calendarSyncKeys.me, queryFn: ({ signal }) => calendarSyncApi.me(signal) });
  const resync = useMutation({
    mutationFn: () => calendarSyncApi.resync(),
    onSuccess: () => qc.invalidateQueries({ queryKey: calendarSyncKeys.me }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const optOut = useMutation({
    mutationFn: (v: boolean) => calendarSyncApi.optOut(v),
    onSuccess: (data) => qc.setQueryData(calendarSyncKeys.me, data),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!me.data) return null;
  const ch = me.data.channels.find((c) => c.connection_id === connectionId);
  const status = syncStatusText(me.data.tenant_enabled, ch);
  return (
    <div className={styles.box}>
      <Subtitle2 as="h3">Calendar sync</Subtitle2>
      <Badge appearance="tint" color={status.tone === "subtle" ? "subtle" : status.tone}>
        {status.text}
      </Badge>
      <Caption1 className={styles.muted}>Talent OS reads only the interview events it created. Your other events stay private.</Caption1>
      {me.data.tenant_enabled && (
        <Button size="small" onClick={() => resync.mutate()} disabled={resync.isPending}>
          Sync now
        </Button>
      )}
      {me.data.org_source_enabled && (
        <>
          <Switch
            label="Share my free/busy through the organisation connection"
            checked={!me.data.free_busy_opted_out}
            onChange={(_, d) => optOut.mutate(!d.checked)}
          />
          <Caption1 className={styles.muted}>
            When off, schedulers see your availability as unknown unless you connect your own calendar.
          </Caption1>
        </>
      )}
    </div>
  );
}
