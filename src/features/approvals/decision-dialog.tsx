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
  Spinner,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar } from "@/features/admin/ui";
import { demandErrorMessage } from "@/features/demands/errors";
import type { ApprovalRequestOut, DecideIn } from "@/lib/api/types";
import { useDecide } from "./use-my-approvals";

export type DecisionAction = DecideIn["action"];

const TITLES: Record<DecisionAction, string> = {
  approve: "Approve",
  reject: "Reject",
  request_changes: "Request changes",
};

/** Whether `action` needs a comment (reject and request changes do). */
export function commentRequired(action: DecisionAction): boolean {
  return action !== "approve";
}

export function subjectLabel(r: Pick<ApprovalRequestOut, "subject" | "subject_type">): string {
  const s = r.subject;
  return [s?.label, s?.title].filter(Boolean).join(" ") || r.subject_type;
}

const EXPLAIN: Record<DecisionAction, string> = {
  approve: "Approving completes your step.",
  reject: "Rejecting ends this approval request and returns the demand to draft.",
  request_changes: "The demand returns to draft with your comment so the owner can update and resubmit it.",
};

/** Approve / Reject / Request changes on the current step; the comment is required for the last two. */
export function DecisionDialog({
  request,
  action,
  onClose,
}: {
  request: ApprovalRequestOut;
  action: DecisionAction;
  onClose: () => void;
}) {
  const toast = useAppToast();
  const decide = useDecide();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const required = commentRequired(action);
  const label = subjectLabel(request);

  const submit = async () => {
    setError(null);
    if (required && !comment.trim()) return setCommentError("Add a comment to explain your decision");
    try {
      const r = await decide.mutateAsync({ id: request.id, body: { action, comment: comment.trim() || null } });
      if (action === "approve") {
        toast.success(r.status === "approved" ? `Approved ${label}` : `Approved your step. ${label} moves to the next approver.`);
      } else {
        toast.success(action === "reject" ? `Rejected ${label}` : `Sent ${label} back for changes`);
      }
      onClose();
    } catch (e) {
      setError(demandErrorMessage(e));
    }
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !decide.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            {TITLES[action]}: {label}
          </DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            <Body1>
              Step: {request.current_step_name ?? `Step ${request.current_position ?? ""}`}. {EXPLAIN[action]}
            </Body1>
            <ErrorBar message={error} />
            <Field
              label="Comment"
              required={required}
              hint={required ? undefined : "Optional"}
              validationState={commentError ? "error" : "none"}
              validationMessage={commentError}
            >
              <Textarea
                value={comment}
                maxLength={4000}
                resize="vertical"
                onChange={(_, d) => {
                  setComment(d.value);
                  setCommentError(null);
                }}
              />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              disabled={decide.isPending}
              icon={decide.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={submit}
            >
              {TITLES[action]}
            </Button>
            <Button appearance="secondary" disabled={decide.isPending} onClick={onClose}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
