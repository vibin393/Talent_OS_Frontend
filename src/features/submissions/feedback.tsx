"use client";

import {
  Body1,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  Spinner,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { ChatBubblesQuestion20Regular, Checkmark20Regular, Dismiss20Regular, Pause20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar } from "@/features/admin/ui";
import { pipelineApi } from "@/features/pipeline/api";
import { pipelineError } from "@/features/pipeline/use-actions";
import { useInvalidatePipeline } from "@/features/pipeline/use-pipeline";
import type { ClientFeedbackOut, FeedbackDecision } from "@/lib/api/types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

export const DECISION_TITLES: Record<FeedbackDecision, string> = {
  interested: "Interested",
  rejected: "Rejected",
  on_hold: "On hold",
};

/** "Record feedback" menu on a sent submission: Interested / Rejected / On hold, then a comment dialog. */
export function RecordFeedbackMenu({
  submissionId,
  demandId,
  candidateName,
}: {
  submissionId: string;
  demandId: string;
  candidateName: string;
}) {
  const [decision, setDecision] = useState<FeedbackDecision | null>(null);
  return (
    <>
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Button size="small" icon={<ChatBubblesQuestion20Regular />}>
            Record feedback
          </Button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem icon={<Checkmark20Regular />} onClick={() => setDecision("interested")}>
              Interested
            </MenuItem>
            <MenuItem icon={<Dismiss20Regular />} onClick={() => setDecision("rejected")}>
              Rejected
            </MenuItem>
            <MenuItem icon={<Pause20Regular />} onClick={() => setDecision("on_hold")}>
              On hold
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
      {decision && (
        <FeedbackDialog
          submissionId={submissionId}
          demandId={demandId}
          decision={decision}
          candidateName={candidateName}
          onClose={() => setDecision(null)}
        />
      )}
    </>
  );
}

/**
 * Comment dialog for recorded client feedback. A "Rejected" decision is stored as a pending rejection
 * (`rejected_pending`); the dialog then asks to confirm moving the candidate to Rejected.
 */
function FeedbackDialog({
  submissionId,
  demandId,
  decision,
  candidateName,
  onClose,
}: {
  submissionId: string;
  demandId: string;
  decision: FeedbackDecision;
  candidateName: string;
  onClose: () => void;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const invalidate = useInvalidatePipeline();
  const [comment, setComment] = useState("");
  const [recorded, setRecorded] = useState<ClientFeedbackOut | null>(null);
  const record = useMutation({
    mutationFn: () => pipelineApi.recordFeedback(submissionId, { decision, comment: comment.trim() || null }),
    onSuccess: (fb) => {
      if (decision === "rejected") setRecorded(fb);
      else {
        toast.success(`Feedback recorded: ${DECISION_TITLES[decision]}.`);
        onClose();
      }
    },
    onSettled: () => invalidate(demandId),
  });
  const confirm = useMutation({
    mutationFn: (feedbackId: string) => pipelineApi.confirmRejection(feedbackId),
    onSuccess: () => {
      toast.success(`${candidateName} moved to Rejected.`);
      onClose();
    },
    onSettled: () => invalidate(demandId),
  });
  const busy = record.isPending || confirm.isPending;

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{recorded ? "Confirm the rejection" : `Client feedback: ${DECISION_TITLES[decision]}`}</DialogTitle>
          <DialogContent className={styles.form}>
            {recorded ? (
              <>
                <MessageBar intent="warning" layout="multiline">
                  <MessageBarBody>The client&apos;s rejection is recorded and waiting for confirmation.</MessageBarBody>
                </MessageBar>
                <Body1>
                  Move {candidateName} to Rejected now (reason “Client rejected”)? You can also confirm later from the pipeline card.
                </Body1>
                {confirm.isError && <ErrorBar message={pipelineError(confirm.error)} />}
              </>
            ) : (
              <>
                <Body1>Record the feedback you received from the client about {candidateName}.</Body1>
                <Field label="Comment">
                  <Textarea value={comment} onChange={(_, d) => setComment(d.value)} maxLength={4000} resize="vertical" />
                </Field>
                {record.isError && <ErrorBar message={pipelineError(record.error)} />}
              </>
            )}
          </DialogContent>
          <DialogActions>
            {recorded ? (
              <>
                <Button disabled={busy} onClick={onClose}>
                  Later
                </Button>
                <Button appearance="primary" disabled={busy} icon={confirm.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => confirm.mutate(recorded.id)}>
                  Confirm rejection
                </Button>
              </>
            ) : (
              <>
                <Button disabled={busy} onClick={onClose}>
                  Cancel
                </Button>
                <Button appearance="primary" disabled={busy} icon={record.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => record.mutate()}>
                  Record
                </Button>
              </>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
