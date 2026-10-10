"use client";

import { Button, MessageBar, MessageBarActions, MessageBarBody, makeStyles, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { calendarSyncApi, calendarSyncKeys } from "./api";
import { banners } from "./logic";

const useStyles = makeStyles({ list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS } });

/** Interview drawer banners (Epic 72 spec B). ``onCancel`` opens the P1 cancel dialog (a person's ★ decision). */
export function InterviewSyncBanner({
  interviewId,
  startsAt,
  onReschedule,
  onCancel,
}: {
  interviewId: string;
  startsAt: string;
  onReschedule?: () => void;
  onCancel?: () => void;
}) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const q = useQuery({
    queryKey: calendarSyncKeys.interview(interviewId),
    queryFn: ({ signal }) => calendarSyncApi.interview(interviewId, signal),
  });
  const act = useMutation({
    mutationFn: (fn: (id: string) => Promise<unknown>) => fn(interviewId),
    onSuccess: () => qc.invalidateQueries({ queryKey: calendarSyncKeys.interview(interviewId) }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!q.data) return null;
  const items = banners(q.data, startsAt);
  if (!items.length) return null;
  return (
    <div className={styles.list}>
      {items.map((b) => (
        <MessageBar key={b.kind + b.text} intent={b.kind === "not_syncing" || b.kind === "conflict" ? "warning" : "info"}>
          <MessageBarBody>{b.text}</MessageBarBody>
          {b.kind === "moved_proposal" && (
            <MessageBarActions>
              {onReschedule && <Button onClick={onReschedule}>Reschedule</Button>}
              <Button onClick={() => act.mutate(calendarSyncApi.keepTime)}>Keep Talent OS time</Button>
            </MessageBarActions>
          )}
          {b.kind === "deleted" && (
            <MessageBarActions>
              <Button onClick={() => act.mutate(calendarSyncApi.recreate)}>Re-create the calendar event</Button>
              {onCancel && <Button onClick={onCancel}>Cancel the interview</Button>}
              <Button onClick={() => act.mutate(calendarSyncApi.dismiss)}>Dismiss</Button>
            </MessageBarActions>
          )}
        </MessageBar>
      ))}
    </div>
  );
}
