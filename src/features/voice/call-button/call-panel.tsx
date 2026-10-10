"use client";

import { Body1, Button, Caption1, Card, makeStyles, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, tokens } from "@fluentui/react-components";
import { MoreHorizontal20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar } from "@/features/admin/ui";
import { telephonyApi, telephonyKeys } from "@/features/telephony/api";
import { isTerminal, recordingLine, statusText, transcriptLine } from "@/features/telephony/logic";
import type { VoiceCall } from "@/features/telephony/types";
import { errorMessage } from "@/lib/api/errors";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, padding: tokens.spacingHorizontalM },
  row: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** Live call panel (spec B1): polls every 2 s while the call is not terminal (AD-15). */
export function CallPanel({ initial, candidate, onOpenSession }: { initial: VoiceCall; candidate: string; onOpenSession?: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const q = useQuery({
    queryKey: telephonyKeys.call(initial.id),
    queryFn: ({ signal }) => telephonyApi.get(initial.id, signal),
    initialData: initial,
    refetchInterval: (query) => {
      const d = query.state.data as VoiceCall | undefined;
      if (!d) return 2000;
      if (!isTerminal(d.status)) return 2000;
      return d.recording_status === "pending" || d.transcript_status === "queued" || d.transcript_status === "running" ? 5000 : false;
    },
  });
  const call = q.data;
  useEffect(() => {
    if (call.status !== "in_progress") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [call.status]);
  const hangup = useMutation({ mutationFn: () => telephonyApi.hangup(call.id), onSuccess: (out) => qc.setQueryData(telephonyKeys.call(call.id), out) });
  const dnc = useMutation({
    mutationFn: () => telephonyApi.doNotCall(call.id),
    onSuccess: () => {
      toast.success("The candidate won't be called again.");
      void qc.invalidateQueries({ queryKey: ["telephony", "options"] });
    },
  });
  const elapsed = call.answered_at ? (now - new Date(call.answered_at).getTime()) / 1000 : 0;
  const done = isTerminal(call.status);
  return (
    <Card className={styles.root}>
      <ErrorBar message={hangup.error ? errorMessage(hangup.error) : dnc.error ? errorMessage(dnc.error) : null} />
      <div className={styles.row}>
        <Body1 aria-live="polite">{statusText(call, candidate, elapsed)}</Body1>
        <Caption1 className={styles.muted}>{call.human_id}</Caption1>
        {!done && (
          <Button size="small" appearance="primary" onClick={() => hangup.mutate()} disabled={hangup.isPending}>
            Hang up
          </Button>
        )}
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button size="small" appearance="subtle" icon={<MoreHorizontal20Regular />} aria-label="More call actions" />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem
                onClick={() => {
                  if (window.confirm("Do not call this candidate again?")) dnc.mutate();
                }}
              >
                Do not call this candidate again
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>
      {done && call.status === "completed" && (
        <>
          <Caption1>{recordingLine(call)}</Caption1>
          <Caption1>{transcriptLine(call)}</Caption1>
        </>
      )}
      {call.manual_instructions && <Caption1 className={styles.muted}>{call.manual_instructions}</Caption1>}
      {done && onOpenSession && (
        <Button size="small" appearance="transparent" onClick={onOpenSession}>
          Open voice session
        </Button>
      )}
    </Card>
  );
}
