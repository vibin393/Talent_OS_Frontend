"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  type TableColumnDefinition,
  Text,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { screeningAgentApi, screeningAgentKeys } from "./api";
import { bulkAcceptable, formatConfidence, formatValue, isBelowThreshold, parseEditedValue, reviewGate, turnRef } from "./logic";
import type { AnswerDecisionIn, AnswerOut, ReviewOut, ReviewTarget } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, minWidth: 0 },
  grid: { overflowX: "auto" },
  low: {
    display: "inline-flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    padding: `0 ${tokens.spacingHorizontalXS}`,
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorPaletteYellowBackground1,
    color: tokens.colorNeutralForeground1,
  },
  said: { overflowWrap: "anywhere", whiteSpace: "pre-wrap" },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS, alignItems: "center" },
  summary: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalS, borderLeft: `3px solid ${tokens.colorBrandStroke1}` },
  muted: { color: tokens.colorNeutralForeground3 },
  footer: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM },
  gaps: { margin: 0, paddingInlineStart: tokens.spacingHorizontalL },
});

const STATUS_LABELS: Record<AnswerOut["status"], { label: string; color: "success" | "informative" | "danger" | "subtle" }> = {
  unconfirmed: { label: "Not reviewed", color: "subtle" },
  accepted: { label: "Accepted", color: "success" },
  edited: { label: "Edited", color: "informative" },
  rejected: { label: "Rejected", color: "danger" },
};

function gapText(gap: unknown): string {
  if (typeof gap === "string") return gap;
  if (gap && typeof gap === "object") {
    const g = gap as Record<string, unknown>;
    return String(g.label ?? g.question ?? g.text ?? g.note ?? JSON.stringify(g));
  }
  return String(gap);
}

export type DecideFn = (answer: AnswerOut, body: AnswerDecisionIn) => void;

/** Presentational review: answers grid, AI summary, "Complete review" (gated). */
export function AnswerReviewView({
  review,
  busyId = null,
  locked = false,
  completing = false,
  onDecide,
  onEdit,
  onAcceptConfident,
  onComplete,
}: {
  review: ReviewOut;
  busyId?: string | null;
  locked?: boolean;
  completing?: boolean;
  onDecide: DecideFn;
  onEdit: (answer: AnswerOut) => void;
  onAcceptConfident?: (ids: string[]) => void;
  onComplete: () => void;
}) {
  const styles = useStyles();
  const gate = reviewGate(review.answers, review.threshold, review.can_complete);
  const confident = bulkAcceptable(review.answers, review.threshold);
  const columns: TableColumnDefinition<AnswerOut>[] = [
    createTableColumn({
      columnId: "question",
      renderHeaderCell: () => "Question",
      renderCell: (a) => (
        <span>
          {a.question_label}
          {a.required ? " *" : ""}
        </span>
      ),
    }),
    createTableColumn({ columnId: "said", renderHeaderCell: () => "Candidate said", renderCell: (a) => <span className={styles.said}>{a.answer_text || "—"}</span> }),
    createTableColumn({
      columnId: "value",
      renderHeaderCell: () => "Value",
      renderCell: (a) => (a.status === "edited" ? `${formatValue(a.edited_value, a.unit)} (edited)` : formatValue(a.normalized, a.unit)),
    }),
    createTableColumn({
      columnId: "confidence",
      renderHeaderCell: () => "Confidence",
      renderCell: (a) =>
        isBelowThreshold(a, review.threshold) ? (
          <span className={styles.low} data-low-confidence="true">
            {formatConfidence(a.confidence)}
            <Badge appearance="filled" color="warning" size="small">
              Check
            </Badge>
          </span>
        ) : (
          formatConfidence(a.confidence)
        ),
    }),
    createTableColumn({
      columnId: "knockout",
      renderHeaderCell: () => "Knockout",
      renderCell: (a) =>
        a.flags.includes("knockout") ? (
          <Tooltip content="Flags never reject" relationship="description">
            <Badge appearance="tint" color="danger" tabIndex={0}>
              Flag
            </Badge>
          </Tooltip>
        ) : (
          "—"
        ),
    }),
    createTableColumn({
      columnId: "turn",
      renderHeaderCell: () => "Turn",
      renderCell: (a) =>
        a.source === "text" && a.segment_refs.length ? <a href={`#screening-turn-${a.segment_refs[0]}`}>{turnRef(a)}</a> : turnRef(a),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Decision",
      renderCell: (a) => (
        <span className={styles.actions}>
          <Badge appearance="tint" color={STATUS_LABELS[a.status].color}>
            {STATUS_LABELS[a.status].label}
          </Badge>
          {!locked && (
            <>
              <Button size="small" disabled={busyId !== null} aria-label={`Accept: ${a.question_label}`} onClick={() => onDecide(a, { decision: "accept" })}>
                Accept
              </Button>
              <Button size="small" disabled={busyId !== null} aria-label={`Edit: ${a.question_label}`} onClick={() => onEdit(a)}>
                Edit
              </Button>
              <Button size="small" disabled={busyId !== null} aria-label={`Reject: ${a.question_label}`} onClick={() => onDecide(a, { decision: "reject" })}>
                Reject
              </Button>
              {busyId === a.id && <Spinner size="tiny" aria-label="Saving" />}
            </>
          )}
        </span>
      ),
    }),
  ];

  return (
    <div className={styles.root}>
      {review.answers.length === 0 ? (
        <Body1 className={styles.muted}>No answers yet.</Body1>
      ) : (
        <div className={styles.grid}>
          <DataGrid items={review.answers} columns={columns} getRowId={(a: AnswerOut) => a.id} aria-label="Screening answers">
            <DataGridHeader>
              <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
            </DataGridHeader>
            <DataGridBody<AnswerOut>>
              {({ item, rowId }) => (
                <DataGridRow<AnswerOut> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        </div>
      )}
      {review.unanswered_required.length > 0 && (
        <Caption1 className={styles.muted}>
          {review.unanswered_required.length} required {review.unanswered_required.length === 1 ? "question was" : "questions were"} not answered.
        </Caption1>
      )}

      {(review.summary || review.gaps.length > 0) && (
        <Card className={styles.summary}>
          <CardHeader
            header={
              <span className={styles.actions}>
                <Subtitle2 as="h4">AI summary</Subtitle2>
                <AiBadge agentName="Screening Agent" />
              </span>
            }
            description={<Caption1 className={styles.muted}>AI-generated — check before you decide</Caption1>}
          />
          {review.summary && <Body1 className={styles.said}>{review.summary}</Body1>}
          {review.gaps.length > 0 && (
            <>
              <Text weight="semibold">Gaps</Text>
              <ul className={styles.gaps}>
                {review.gaps.map((g, i) => (
                  <li key={i}>{gapText(g)}</li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {!locked && (
        <div className={styles.footer}>
          {onAcceptConfident && confident.length > 0 && (
            <Button disabled={busyId !== null} onClick={() => onAcceptConfident(confident)}>
              Accept confident answers ({confident.length})
            </Button>
          )}
          <Button
            appearance="primary"
            disabled={!gate.canComplete || completing || busyId !== null}
            icon={completing ? <Spinner size="tiny" /> : undefined}
            aria-describedby="screening-review-gate"
            onClick={onComplete}
          >
            Complete review
          </Button>
          <Caption1 id="screening-review-gate" className={styles.muted} aria-live="polite">
            {gate.reason ?? ""}
          </Caption1>
        </div>
      )}
      {locked && (
        <MessageBar intent="success">
          <MessageBarBody>Review complete. Set the screening outcome below.</MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}

function EditAnswerDialog({ answer, saving, onSave, onClose }: { answer: AnswerOut; saving: boolean; onSave: (value: Record<string, unknown>) => void; onClose: () => void }) {
  const initial = formatValue(answer.edited_value ?? answer.normalized, null);
  const [raw, setRaw] = useState(initial === "—" ? "" : String((answer.edited_value ?? answer.normalized)?.value ?? initial));
  const parsed = parseEditedValue(answer.question_type, raw, answer.unit);
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !saving && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Edit answer</DialogTitle>
          <DialogContent>
            <Field
              label={answer.question_label}
              hint={answer.unit ? `Unit: ${answer.unit}` : answer.question_type === "boolean" ? "Yes or No" : undefined}
              validationState={raw.trim() && !parsed ? "error" : "none"}
              validationMessage={raw.trim() && !parsed ? "Enter a valid value." : undefined}
            >
              <Input value={raw} onChange={(_, d) => setRaw(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={!parsed || saving} icon={saving ? <Spinner size="tiny" /> : undefined} onClick={() => parsed && onSave(parsed)}>
              Save
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/**
 * Answer review for a text conversation or (Epic 58) a voice session: pass exactly one of `conversationId` /
 * `voiceSessionId`. After "Complete review" the P1 outcome control (unchanged) sets the Screening outcome.
 */
export function AnswerReview({
  onCompleted,
  completeFn,
  ...target
}: ReviewTarget & { onCompleted?: () => void; /** Epic 58 hook: the voice session completes through its own endpoint. */ completeFn?: () => Promise<ReviewOut> }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const key = screeningAgentKeys.review(target);
  const [editing, setEditing] = useState<AnswerOut | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const review = useQuery({ queryKey: key, queryFn: ({ signal }) => screeningAgentApi.review(target, signal) });
  const patchAnswer = (answer: AnswerOut) =>
    queryClient.setQueryData<ReviewOut>(key, (prev) => (prev ? { ...prev, answers: prev.answers.map((a) => (a.id === answer.id ? answer : a)) } : prev));
  const decide = useMutation({
    mutationFn: ({ answer, body }: { answer: AnswerOut; body: AnswerDecisionIn }) => screeningAgentApi.decide(answer.id, body),
    onMutate: ({ answer }) => setBusyId(answer.id),
    onSuccess: (answer) => {
      patchAnswer(answer);
      setEditing(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => {
      setBusyId(null);
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const acceptMany = useMutation({
    mutationFn: async (ids: string[]) => {
      setBusyId(ids[0] ?? null);
      for (const id of ids) patchAnswer(await screeningAgentApi.decide(id, { decision: "accept" }));
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => {
      setBusyId(null);
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const complete = useMutation({
    mutationFn: () => (completeFn ? completeFn() : screeningAgentApi.completeReview(target)),
    onSuccess: (out) => {
      queryClient.setQueryData(key, out);
      toast.success("Review complete.");
      void queryClient.invalidateQueries({ queryKey: screeningAgentKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      onCompleted?.();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (review.isPending) return <GridSkeleton rows={4} />;
  if (review.isError) {
    if (isApiError(review.error) && review.error.status === 404) return <Body1 className={styles.muted}>No answers yet.</Body1>;
    return <ErrorBar title="Could not load the answers." message={errorMessage(review.error)} />;
  }
  return (
    <>
      <AnswerReviewView
        review={review.data}
        busyId={busyId}
        locked={review.data.status === "reviewed"}
        completing={complete.isPending}
        onDecide={(answer, body) => decide.mutate({ answer, body })}
        onEdit={setEditing}
        onAcceptConfident={(ids) => acceptMany.mutate(ids)}
        onComplete={() => complete.mutate()}
      />
      {editing && (
        <EditAnswerDialog
          key={editing.id}
          answer={editing}
          saving={decide.isPending}
          onClose={() => setEditing(null)}
          onSave={(value) => decide.mutate({ answer: editing, body: { decision: "edit", edited_value: value } })}
        />
      )}
    </>
  );
}

