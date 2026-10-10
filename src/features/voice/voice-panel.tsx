"use client";

import { Badge, Body1, Button, Caption1, Card, CardHeader, makeStyles, Subtitle2, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { ApplicationPanelProps } from "@/features/pipeline/application-panels";
import { errorMessage } from "@/lib/api/errors";
import { voiceApi, voiceKeys } from "./api";
import { CallButton } from "./call-button/call-button";
import { CallsList } from "./call-button/calls-list";
import { callChip, canCancel, canUpload, OPEN_STATUSES, recordingChip, STATUS_LABELS } from "./logic";
import { RequestDialog } from "./request-dialog";
import { SpeakerLabeller } from "./speaker-labeller";
import type { VoiceSession } from "./types";
import { UploadDrawer } from "./upload-drawer";
import { VoiceReview } from "./voice-review";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

const STATUS_COLOR: Partial<Record<VoiceSession["status"], "success" | "informative" | "danger" | "warning" | "subtle" | "brand">> = {
  ready_for_review: "brand",
  reviewed: "success",
  failed: "danger",
  cancelled: "subtle",
  consent_pending: "warning",
};

/** Application drawer panel "Voice screening" (Epic 58). */
export function VoicePanel({ applicationId }: ApplicationPanelProps) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const canRequest = usePermission("voice:upload");
  const canReview = usePermission("screening:conduct");
  const [requesting, setRequesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const q = useQuery({ queryKey: voiceKeys.sessions(applicationId), queryFn: ({ signal }) => voiceApi.list(applicationId, signal) });
  const cancel = useMutation({
    mutationFn: (id: string) => voiceApi.cancel(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: voiceKeys.sessions(applicationId) });
      toast.success("Voice screen cancelled.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const current = q.data?.[0];
  const open = current ? OPEN_STATUSES.includes(current.status) || current.status === "ready_for_review" : false;
  return (
    <Card className={styles.root}>
      <CardHeader
        header={
          <Subtitle2>
            Voice screening <AiBadge agentName="Voice Screening Agent" />
          </Subtitle2>
        }
        action={
          canRequest && !open ? (
            <Button size="small" onClick={() => setRequesting(true)}>
              Request voice screen
            </Button>
          ) : undefined
        }
      />
      {q.isPending ? (
        <GridSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorBar message={errorMessage(q.error)} />
      ) : !current ? (
        <Body1 className={styles.muted}>No voice screen yet.</Body1>
      ) : (
        <>
          <div className={styles.row}>
            <Badge appearance="filled" color={STATUS_COLOR[current.status] ?? "informative"}>
              {STATUS_LABELS[current.status]}
            </Badge>
            <Badge appearance="outline">{callChip(current.voice_consent)}</Badge>
            <Badge appearance="outline">{recordingChip(current)}</Badge>
            <Caption1 className={styles.muted}>{current.human_id}</Caption1>
          </div>
          {current.recording_deleted_at && <Caption1 className={styles.muted}>The recording was deleted.</Caption1>}
          <div className={styles.row}>
            {canRequest && canUpload(current) && (
              <>
                <Button size="small" onClick={() => setUploading(true)}>
                  Upload transcript
                </Button>
                <Button size="small" onClick={() => setUploading(true)} disabled={current.recording_block_reason !== null}>
                  Upload recording
                </Button>
              </>
            )}
            {canReview && (current.status === "ready_for_review" || current.status === "reviewed") && (
              <Button size="small" appearance="primary" onClick={() => setReviewing((v) => !v)}>
                Review
              </Button>
            )}
            {canRequest && canCancel(current) && (
              <Button size="small" disabled={cancel.isPending} onClick={() => cancel.mutate(current.id)}>
                Cancel
              </Button>
            )}
          </div>
          <CallsList sessionId={current.id} />
          {canReview && current.needs_speaker_label && current.status === "uploaded" && <SpeakerLabeller sessionId={current.id} />}
          {canReview && reviewing && <VoiceReview session={current} />}
          {uploading && <UploadDrawer session={current} open={uploading} onClose={() => setUploading(false)} />}
        </>
      )}
      {/* Epic 76: recruiter-initiated bridged call (visible with voice:call) */}
      <CallButton subject={{ applicationId }} candidate="the candidate" onManual={() => (current ? setUploading(true) : setRequesting(true))} />
      {requesting && <RequestDialog applicationId={applicationId} open={requesting} onClose={() => setRequesting(false)} />}
    </Card>
  );
}
