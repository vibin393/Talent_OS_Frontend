"use client";

import { Badge, Button, MessageBar, MessageBarActions, MessageBarBody, Tooltip } from "@fluentui/react-components";
import type { ApplicationOut } from "@/lib/api/types";
import { scoreHiddenReason } from "@/features/fairness/logic";
import { ScoreHiddenBadge } from "@/features/fairness/score-hidden";
import { FEEDBACK_STATUS, feedbackStatusOf, formatMatch, SCREENING_STATUS, SUBMISSION_STATUS } from "./format";
import { usePendingRejection } from "./use-actions";

export function ScreeningBadge({ status, passed }: { status: string | null | undefined; passed?: boolean }) {
  const s = status ? SCREENING_STATUS[status] : undefined;
  if (s) {
    return (
      <Badge appearance="tint" color={s.color} size="small">
        {s.label}
      </Badge>
    );
  }
  if (passed) {
    return (
      <Badge appearance="tint" color="success" size="small">
        Screened
      </Badge>
    );
  }
  return null;
}

export function FeedbackBadge({ status }: { status: string | null | undefined }) {
  const s = status ? FEEDBACK_STATUS[status] : undefined;
  if (!s) return null;
  return (
    <Badge appearance="filled" color={s.color} size="small">
      {s.label}
    </Badge>
  );
}

export function SubmissionStatusBadge({ status }: { status: string }) {
  const s = SUBMISSION_STATUS[status] ?? { label: status, color: "informative" as const };
  return (
    <Badge appearance="tint" color={s.color}>
      {s.label}
    </Badge>
  );
}

export function MatchBadge({ score }: { score: string | number | null | undefined }) {
  const label = formatMatch(score);
  if (!label) return null;
  return (
    <Tooltip content="Match score" relationship="description">
      <Badge appearance="outline" color="brand" size="small">
        {label} match
      </Badge>
    </Tooltip>
  );
}

/** Screening, client-feedback and match badges of one application. */
export function ApplicationBadges({ app }: { app: ApplicationOut }) {
  return (
    <>
      <ScreeningBadge status={app.screening_status} passed={app.screening_passed} />
      <FeedbackBadge status={feedbackStatusOf(app)} />
      <MatchBadge score={app.match_score} />
      <ScoreHiddenBadge reason={scoreHiddenReason(app)} />
    </>
  );
}

/** "Client rejected via link — Confirm rejection / Dismiss" (card and drawer). */
export function PendingRejectionBar({
  feedbackId,
  demandId,
  canConfirm,
  compact,
}: {
  feedbackId: string;
  demandId: string | null;
  canConfirm: boolean;
  compact?: boolean;
}) {
  const { confirm, dismiss, busy } = usePendingRejection(demandId);
  return (
    <MessageBar intent="error" layout={compact ? "multiline" : "auto"}>
      <MessageBarBody>Client rejected via link.</MessageBarBody>
      {canConfirm && (
        <MessageBarActions>
          <Button size="small" appearance="primary" disabled={busy} onClick={() => confirm.mutate(feedbackId)}>
            Confirm rejection
          </Button>
          <Button size="small" disabled={busy} onClick={() => dismiss.mutate(feedbackId)}>
            Dismiss
          </Button>
        </MessageBarActions>
      )}
    </MessageBar>
  );
}
