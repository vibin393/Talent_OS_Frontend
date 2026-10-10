"use client";

import { Body1, Button, Caption1, Card, makeStyles, MessageBar, MessageBarBody, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { interviewAssistantApi, interviewAssistantKeys } from "./api";

const useStyles = makeStyles({
  card: { maxWidth: "640px", padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  actions: { display: "flex", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** `/me/recording-consent`: an interviewer's standing, revocable agreement to interview recording. */
export function RecordingAckSettings() {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: interviewAssistantKeys.ack, queryFn: ({ signal }) => interviewAssistantApi.myAck(signal) });
  const give = useMutation({
    mutationFn: () => interviewAssistantApi.giveAck(),
    onSuccess: (out) => {
      qc.setQueryData(interviewAssistantKeys.ack, out);
      toast.success("Thanks. Interviews you take part in can be recorded when everyone agrees.");
    },
  });
  const revoke = useMutation({
    mutationFn: () => interviewAssistantApi.revokeAck(),
    onSuccess: (out) => {
      qc.setQueryData(interviewAssistantKeys.ack, out);
      toast.success("Withdrawn. Recordings and transcripts of interviews not yet scored will be deleted.");
    },
  });
  return (
    <>
      <PageHeader title="My recording consent" subtitle="Whether interviews you take part in may be recorded or transcribed." />
      {q.isPending ? (
        <GridSkeleton rows={3} />
      ) : q.isError ? (
        <ErrorBar message={errorMessage(q.error)} />
      ) : (
        <Card className={styles.card}>
          <ErrorBar message={give.error ? errorMessage(give.error) : revoke.error ? errorMessage(revoke.error) : null} />
          <Body1 as="p">{q.data.statement}</Body1>
          {q.data.acked && (
            <MessageBar intent="success">
              <MessageBarBody>You agreed{q.data.acked_at ? ` on ${new Date(q.data.acked_at).toLocaleDateString()}` : ""}.</MessageBarBody>
            </MessageBar>
          )}
          <div className={styles.actions}>
            {q.data.acked ? (
              <Button onClick={() => revoke.mutate()} disabled={revoke.isPending}>
                Withdraw
              </Button>
            ) : (
              <Button appearance="primary" onClick={() => give.mutate()} disabled={give.isPending}>
                I agree to interviews I take part in being recorded or transcribed when everyone agrees
              </Button>
            )}
          </div>
          <Caption1 className={styles.muted}>Statement version {q.data.statement_version}</Caption1>
        </Card>
      )}
    </>
  );
}
