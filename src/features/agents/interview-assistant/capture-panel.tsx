"use client";

import { Badge, Button, Caption1, Card, makeStyles, MessageBar, MessageBarBody, Subtitle2, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import type { InterviewPanelProps } from "@/features/interviews/interview-panels";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { interviewAssistantApi, interviewAssistantKeys } from "./api";
import { ConsentStatus } from "./consent-status";
import { blockedMessage, STATUS_BADGES } from "./logic";
import { OutputsView } from "./outputs-view";
import { UploadDrawer } from "./upload-drawer";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM, minWidth: 0 },
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** Interview drawer panel "Interview assistant" (registered as `interview_assistant`): consent per participant, the
 * policy gate, uploads, re-runs and -- for the draft owner or under the blind rule -- the assistant's outputs. */
export function InterviewAssistantPanel({ interviewId }: InterviewPanelProps) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const status = useQuery({
    queryKey: interviewAssistantKeys.status(interviewId),
    queryFn: ({ signal }) => interviewAssistantApi.status(interviewId, signal),
    retry: (n, e) => !(isApiError(e) && (e.status === 404 || e.status === 403)) && n < 2,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: interviewAssistantKeys.status(interviewId) });
  const ask = useMutation({
    mutationFn: () =>
      status.data?.status === "not_requested" ? interviewAssistantApi.request(interviewId) : interviewAssistantApi.askConsent(interviewId),
    onSuccess: (out) => {
      refresh();
      toast.success(out.sent.length ? `Consent requested from ${out.sent.length} ${out.sent.length === 1 ? "person" : "people"}` : "Nobody is waiting to be asked");
    },
  });
  const rerun = useMutation({
    mutationFn: () => interviewAssistantApi.rerun(interviewId),
    onSuccess: (out) => {
      refresh();
      if (out.run_id) toast.success("The assistant is working on it");
      else toast.error(`The assistant could not start (${out.reason ?? out.status})`);
    },
  });

  if (status.isPending) return <GridSkeleton rows={2} />;
  if (status.isError) return isApiError(status.error) && [403, 404].includes(status.error.status) ? null : <ErrorBar message={errorMessage(status.error)} />;
  const s = status.data;
  const badge = STATUS_BADGES[s.status];
  const blocked = s.status === "blocked" || (s.status !== "not_requested" && !s.offered && s.reasons.some((r) => !r.startsWith("missing_")));
  const canUpload = s.can_manage && s.offered && ["planned", "uploaded", "processing", "ready"].includes(s.status);

  return (
    <Card className={styles.root} aria-labelledby={`ia-title-${interviewId}`}>
      <div className={styles.head}>
        <Subtitle2 as="h3" id={`ia-title-${interviewId}`}>
          Interview assistant
        </Subtitle2>
        <AiBadge agentName="Interview Assistant" />
        <Badge appearance="tint" color={badge.color}>
          {badge.label}
        </Badge>
      </div>
      <ErrorBar message={ask.error ? errorMessage(ask.error) : rerun.error ? errorMessage(rerun.error) : null} />
      {blocked && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>{blockedMessage(s)}</MessageBarBody>
        </MessageBar>
      )}
      {s.status === "uploaded" && !s.unknown_speakers.length && s.capture_kind === "recording" && (
        <MessageBar intent="info">
          <MessageBarBody>Upload the meeting transcript so the assistant can work from what was said.</MessageBarBody>
        </MessageBar>
      )}
      {s.unknown_speakers.length > 0 && (
        <MessageBar intent="info">
          <MessageBarBody>Tell us who the candidate is before the assistant starts.</MessageBarBody>
        </MessageBar>
      )}
      {s.status !== "not_requested" && <ConsentStatus participants={s.participants} />}
      {s.status === "not_requested" && <Caption1 className={styles.muted}>Record or transcribe this interview with everyone&apos;s agreement.</Caption1>}
      {s.can_manage && s.status !== "erased" && (
        <div className={styles.actions}>
          {!s.offered && !blocked && (
            <Button onClick={() => ask.mutate()} disabled={ask.isPending}>
              Ask for consent
            </Button>
          )}
          {canUpload && (
            <Button appearance="primary" onClick={() => setUploading(true)}>
              {s.unknown_speakers.length ? "Who is the candidate?" : "Upload transcript or recording"}
            </Button>
          )}
          {canUpload && ["processing", "ready", "uploaded"].includes(s.status) && s.uploaded_at && !s.unknown_speakers.length && s.capture_kind !== "recording" && (
            <Button onClick={() => rerun.mutate()} disabled={rerun.isPending}>
              Re-run assistant
            </Button>
          )}
        </div>
      )}
      {s.has_draft && (
        <AppLink href={`/interviews/${interviewId}/scorecard`}>Open my scorecard with the AI draft</AppLink>
      )}
      {s.has_outputs && <OutputsView interviewId={interviewId} />}
      <UploadDrawer
        interviewId={interviewId}
        open={uploading}
        status={s}
        allowRecording={s.allow_recording_upload}
        allowTranscript={s.allow_transcript_upload}
        onClose={() => setUploading(false)}
      />
    </Card>
  );
}
