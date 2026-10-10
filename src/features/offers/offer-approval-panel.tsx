"use client";

import {
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowReset20Regular,
  Checkmark20Regular,
  CheckmarkCircle20Filled,
  Circle20Regular,
  DismissCircle20Filled,
  Hourglass20Regular,
  Next20Regular,
  Prohibited20Regular,
  Dismiss20Regular,
  ArrowUndo20Filled,
} from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { approvalKeys, approvalsApi } from "@/features/approvals/api";
import { useUserNames } from "@/features/approvals/use-user-names";
import { formatDateTime } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { type ChainStep, chainSteps, commentRequired, type DecideAction, isCurrentApprover, latestRequest, returnComment, type StepState } from "./approval";
import { OFFER_RELATED_ROOTS, offerKeys } from "./api";
import type { ApprovalRequest, OfferDetailOut } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  steps: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" },
  step: {
    display: "grid",
    gridTemplateColumns: "28px 1fr",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} 0`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
  },
  muted: { color: tokens.colorNeutralForeground3 },
  comment: { whiteSpace: "pre-wrap", margin: 0 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

const STATE: Record<StepState, { label: string; icon: React.ReactElement }> = {
  approved: { label: "Approved", icon: <CheckmarkCircle20Filled color={tokens.colorPaletteGreenForeground1} /> },
  pending: { label: "Waiting for decision", icon: <Hourglass20Regular color={tokens.colorPaletteMarigoldForeground1} /> },
  skipped: { label: "Skipped (condition not met)", icon: <Next20Regular /> },
  returned: { label: "Changes requested", icon: <ArrowUndo20Filled color={tokens.colorPaletteDarkOrangeForeground1} /> },
  rejected: { label: "Rejected", icon: <DismissCircle20Filled color={tokens.colorPaletteRedForeground1} /> },
  waiting: { label: "Not reached yet", icon: <Circle20Regular /> },
  cancelled: { label: "Cancelled", icon: <Prohibited20Regular /> },
};

const TITLES: Record<DecideAction, string> = { approve: "Approve", reject: "Reject", request_changes: "Request changes" };

function DecideDialog({ request, action, offer, onClose }: { request: ApprovalRequest; action: DecideAction; offer: OfferDetailOut; onClose: () => void }) {
  const toast = useAppToast();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: () => approvalsApi.decide(request.id, { action, comment: comment.trim() || null }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: offerKeys.all }),
        qc.invalidateQueries({ queryKey: approvalKeys.mine }),
        ...OFFER_RELATED_ROOTS.map((k) => qc.invalidateQueries({ queryKey: k })),
      ]);
    },
  });
  const required = commentRequired(action);
  const submit = async () => {
    if (required && !comment.trim()) return setFieldError("Add a comment so the owner knows what to change");
    try {
      await decide.mutateAsync();
      toast.success(action === "approve" ? `Approved your step for ${offer.human_id}` : action === "reject" ? `Rejected ${offer.human_id}` : `Sent ${offer.human_id} back for changes`);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !decide.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            {TITLES[action]}: {offer.human_id}
          </DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            <Body1>
              {action === "approve"
                ? "Approving completes your step."
                : action === "reject"
                  ? "Rejecting ends this approval request and returns the offer to draft."
                  : "The offer returns to draft with your comment so the owner can change it and resubmit."}
            </Body1>
            {error && (
              <MessageBar intent="error" role="alert">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            <Field label="Comment" required={required} hint={required ? undefined : "Optional"} validationState={fieldError ? "error" : "none"} validationMessage={fieldError}>
              <Textarea
                value={comment}
                maxLength={4000}
                onChange={(_, d) => {
                  setComment(d.value);
                  setFieldError(null);
                }}
              />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={decide.isPending} icon={decide.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
              {TITLES[action]}
            </Button>
            <Button disabled={decide.isPending} onClick={onClose}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function StepRow({ step, nameOf }: { step: ChainStep; nameOf: (id: string | null | undefined) => string | null }) {
  const styles = useStyles();
  const s = STATE[step.state];
  const who = step.actorId ? nameOf(step.actorId) : step.approverUserId ? nameOf(step.approverUserId) : step.approverRoleId ? "anyone with the step's role" : null;
  return (
    <li className={styles.step}>
      <span aria-hidden>{s.icon}</span>
      <div>
        <Text weight="semibold">{step.name}</Text> · {s.label}
        {who && <Caption1 className={styles.muted}>{step.actorId ? ` by ${who}` : ` · approver: ${who}`}</Caption1>}
        {step.at && <Caption1 className={styles.muted}> · {formatDateTime(step.at)}</Caption1>}
        {step.comment && (
          <Body1 as="p" className={styles.comment}>
            “{step.comment}”
          </Body1>
        )}
      </div>
    </li>
  );
}

/** Approval tab: chain steps with state icons, approvers, comments and times; Approve / Reject / Request changes for the current approver. */
export function OfferApprovalPanel({ offer }: { offer: OfferDetailOut }) {
  const styles = useStyles();
  const { data: me } = useMe();
  const canApprove = usePermission("offer:approve");
  const nameOf = useUserNames();
  const [deciding, setDeciding] = useState<DecideAction | null>(null);
  const requests = [...offer.approvals].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  const latest = latestRequest(requests);
  const returned = offer.status === "draft" ? returnComment(requests, offer.status_comment) : null;
  const mine = isCurrentApprover(latest, me?.user.id, canApprove) && offer.status === "pending_approval";

  return (
    <div className={styles.root}>
      {returned && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <strong>Returned by the approver:</strong> {returned}
          </MessageBarBody>
        </MessageBar>
      )}
      {!latest && (
        <Body1 className={styles.muted}>
          {offer.status === "approved" ? "Approved automatically — no approval chain applied to this offer." : "Not submitted for approval yet."}
        </Body1>
      )}
      {mine && latest && (
        <div className={styles.actions}>
          <Button appearance="primary" icon={<Checkmark20Regular />} onClick={() => setDeciding("approve")}>
            Approve
          </Button>
          <Button icon={<ArrowReset20Regular />} onClick={() => setDeciding("request_changes")}>
            Request changes
          </Button>
          <Button icon={<Dismiss20Regular />} onClick={() => setDeciding("reject")}>
            Reject
          </Button>
        </div>
      )}
      {requests.map((r, i) => (
        <section key={r.id} aria-label={`Approval request submitted ${formatDateTime(r.submitted_at)}`}>
          <Caption1 className={styles.muted}>
            {i === 0 ? "Current request" : "Earlier request"} · submitted {formatDateTime(r.submitted_at)}
            {nameOf(r.submitted_by) ? ` by ${nameOf(r.submitted_by)}` : ""}
          </Caption1>
          <ol className={styles.steps}>
            {chainSteps(r).map((s) => (
              <StepRow key={s.position} step={s} nameOf={nameOf} />
            ))}
          </ol>
        </section>
      ))}
      {deciding && latest && <DecideDialog request={latest} action={deciding} offer={offer} onClose={() => setDeciding(null)} />}
    </div>
  );
}
