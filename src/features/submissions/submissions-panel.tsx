"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Link,
  makeStyles,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { DocumentPdf20Regular, Send20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { pipelineApi } from "@/features/pipeline/api";
import { FeedbackBadge, PendingRejectionBar, SubmissionStatusBadge } from "@/features/pipeline/badges";
import { pipelineError } from "@/features/pipeline/use-actions";
import { useDemandSubmissions, useInvalidatePipeline } from "@/features/pipeline/use-pipeline";
import { errorMessage } from "@/lib/api/errors";
import type { ApplicationDetailOut, SubmissionOut } from "@/lib/api/types";
import { useState } from "react";
import { DECISION_TITLES, RecordFeedbackMenu } from "./feedback";
import { SubmissionAssessmentShares } from "@/features/assessments/integrations";
import { formatMoney, formatPct } from "./wizard-logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  card: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalS },
  facts: {
    display: "grid",
    gridTemplateColumns: "max-content 1fr",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXXS,
    margin: 0,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0, overflowWrap: "anywhere" },
  },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  feedback: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** Submissions of one application (drawer tab) with send / cancel / record feedback. */
export function SubmissionsPanel({ app, feedbackOnly }: { app: ApplicationDetailOut; feedbackOnly?: boolean }) {
  const styles = useStyles();
  const list = useDemandSubmissions(app.demand_id);
  const canRead = usePermission("submission:read");
  if (!canRead) return <Body1>You do not have access to submissions.</Body1>;
  if (list.isPending) return <GridSkeleton rows={3} />;
  if (list.isError) return <ErrorBar title="Could not load submissions." message={errorMessage(list.error)} />;
  const mine = list.data.filter((s) => s.application_id === app.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const shown = feedbackOnly ? mine.filter((s) => s.status === "sent") : mine;
  if (shown.length === 0) {
    return (
      <Body1 className={styles.muted}>
        {feedbackOnly ? "No sent submissions yet, so there is no client feedback." : "Not submitted to the client yet."}
      </Body1>
    );
  }
  return (
    <div className={styles.root}>
      {app.pending_client_rejection_id && feedbackOnly && (
        <PendingRejectionBar feedbackId={app.pending_client_rejection_id} demandId={app.demand_id} canConfirm />
      )}
      {shown.map((s) =>
        feedbackOnly ? (
          <FeedbackHistory key={s.id} submission={s} />
        ) : (
          <SubmissionCard key={s.id} submission={s} candidateName={app.candidate.full_name ?? "the candidate"} candidateId={app.candidate.id} />
        ),
      )}
    </div>
  );
}

function SubmissionCard({ submission: s, candidateName, candidateId }: { submission: SubmissionOut; candidateName: string; candidateId?: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const invalidate = useInvalidatePipeline();
  const canSubmit = usePermission("submission:create");
  const canFeedback = usePermission("submission:update");
  const [cancelling, setCancelling] = useState(false);
  const send = useMutation({
    mutationFn: () => pipelineApi.sendSubmission(s.id),
    onSuccess: () => toast.success(`${s.human_id} sent to the client.`),
    onError: (e) => toast.error(pipelineError(e)),
    onSettled: () => invalidate(s.demand_id),
  });
  const cancelable = ["draft", "pending_approval", "approved", "approval_rejected"].includes(s.status);
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h3">{s.human_id}</Subtitle2>}
        description={<Caption1>{s.sent_at ? `Sent ${formatDateTime(s.sent_at)}` : `Created ${formatDateTime(s.created_at)}`}</Caption1>}
        action={<SubmissionStatusBadge status={s.status} />}
      />
      <dl className={styles.facts}>
        <dt>Bill rate</dt>
        <dd>{s.bill_rate ? `${formatMoney(s.bill_rate.amount, s.bill_rate.currency)} per ${s.rate_unit}` : "Hidden"}</dd>
        {s.pay_rate && (
          <>
            <dt>Pay rate</dt>
            <dd>{`${formatMoney(s.pay_rate.amount, s.pay_rate.currency)} per ${s.rate_unit}`}</dd>
          </>
        )}
        {s.margin_amount && (
          <>
            <dt>Margin</dt>
            <dd>
              {formatMoney(s.margin_amount.amount, s.margin_amount.currency)} ({formatPct(s.margin_pct)})
              {s.below_min_margin ? " — below minimum" : ""}
            </dd>
          </>
        )}
        <dt>Resume</dt>
        <dd>
          {s.resume_kind === "client_formatted" ? "Client-formatted PDF" : "Original"}
          {s.resume_file_id && (
            <>
              {" · "}
              <Link href={pipelineApi.resumeUrl(s.id)} target="_blank" rel="noopener noreferrer">
                <DocumentPdf20Regular aria-hidden style={{ verticalAlign: "middle" }} /> Open snapshot
              </Link>
            </>
          )}
        </dd>
        {s.status === "sent" && (
          <>
            <dt>Client feedback</dt>
            <dd>{s.feedback_status === "none" ? "Waiting" : <FeedbackBadge status={s.feedback_status} />}</dd>
          </>
        )}
      </dl>
      {s.note && <Body1>{s.note}</Body1>}
      {/* Epic 40: the composer sends in one step, so assessment shares are chosen here, per submission. */}
      {candidateId && s.status !== "cancelled" && <SubmissionAssessmentShares submissionId={s.id} candidateId={candidateId} canEdit={canSubmit} />}
      <div className={styles.actions}>
        {canSubmit && s.status === "approved" && (
          <Button appearance="primary" icon={<Send20Regular />} disabled={send.isPending} onClick={() => send.mutate()}>
            Send
          </Button>
        )}
        {s.status === "pending_approval" && <Caption1 className={styles.muted}>Waiting for margin approval.</Caption1>}
        {canFeedback && s.status === "sent" && <RecordFeedbackMenu submissionId={s.id} demandId={s.demand_id} candidateName={candidateName} />}
        {canSubmit && cancelable && (
          <Button appearance="subtle" onClick={() => setCancelling(true)}>
            Cancel submission
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={cancelling}
        title="Cancel this submission?"
        confirmLabel="Cancel submission"
        onClose={() => setCancelling(false)}
        onConfirm={() =>
          pipelineApi
            .cancelSubmission(s.id)
            .then(() => {
              toast.success(`${s.human_id} cancelled.`);
              return invalidate(s.demand_id);
            })
            .catch((e) => {
              toast.error(pipelineError(e));
              throw e;
            })
        }
      >
        The submission has not been emailed yet. Cancelling keeps the candidate in Shortlisted.
      </ConfirmDialog>
    </Card>
  );
}

function FeedbackHistory({ submission: s }: { submission: SubmissionOut }) {
  const styles = useStyles();
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h3">{s.human_id}</Subtitle2>} action={<FeedbackBadge status={s.feedback_status} />} />
      {!s.feedback?.length ? (
        <Body1 className={styles.muted}>No feedback yet.</Body1>
      ) : (
        <ul className={styles.feedback}>
          {[...(s.feedback ?? [])]
            .sort((a, b) => b.received_at.localeCompare(a.received_at))
            .map((f) => (
              <li key={f.id}>
                <Text weight="semibold">{DECISION_TITLES[f.decision]}</Text>{" "}
                <Caption1 className={styles.muted}>
                  {f.source === "link" ? "via email link" : "recorded"} · {formatDateTime(f.received_at)}
                  {f.confirmed_at ? ` · confirmed ${formatDateTime(f.confirmed_at)}` : ""}
                  {f.dismissed_at ? " · dismissed" : ""}
                </Caption1>
                {f.comment && <Body1 block>{f.comment}</Body1>}
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}
