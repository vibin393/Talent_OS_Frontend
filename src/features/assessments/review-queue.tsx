"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  mergeClasses,
  SpinButton,
  Spinner,
  Subtitle2,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Sparkle20Regular } from "@fluentui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { assessmentsApi } from "./api";
import { isCodeKind, isDecimal, ITEM_KIND_LABELS, responseText, rubricTotal } from "./logic";
import type { AiSuggestionOut, ReviewItemOut } from "./types";
import { CodeBlock, useAsmStyles } from "./ui";
import { assessmentKeys, useAssessmentPermissions, useReviews } from "./use-assessments";

const useStyles = makeStyles({
  list: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1200px" },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  split: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 3fr) minmax(260px, 2fr)",
    gap: tokens.spacingHorizontalXL,
    "@media (max-width: 860px)": { gridTemplateColumns: "1fr" },
  },
  answer: {
    margin: 0,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    maxHeight: "420px",
    overflowY: "auto",
  },
  codeAnswer: { fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200 },
  criterion: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  total: { fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
});

/** `/assessments/reviews`: pending answers side by side with the rubric; AI suggestions are advisory and a human submits. */
export function ReviewQueue() {
  const styles = useStyles();
  const asm = useAsmStyles();
  const { canReview } = useAssessmentPermissions();
  const q = useReviews("pending", canReview);
  const [aiDisabled, setAiDisabled] = useState(false);
  if (!canReview) return <NoAccess what="the assessment review queue" />;
  return (
    <>
      <PageHeader title="Review queue" subtitle={<AppLink href="/assessments">Back to assessments</AppLink>} />
      {q.isPending ? (
        <GridSkeleton rows={4} />
      ) : q.isError ? (
        <ErrorBar title="Could not load the review queue." message={errorMessage(q.error)} />
      ) : q.data.length === 0 ? (
        <Body1 className={asm.muted}>Nothing to review. Answers that need a human score appear here.</Body1>
      ) : (
        <div className={styles.list}>
          {q.data.map((r) => (
            <ReviewCard key={r.answer_id} r={r} aiDisabled={aiDisabled} onAiDisabled={() => setAiDisabled(true)} />
          ))}
        </div>
      )}
    </>
  );
}

function ReviewCard({ r, aiDisabled, onAiDisabled }: { r: ReviewItemOut; aiDisabled: boolean; onAiDisabled: () => void }) {
  const styles = useStyles();
  const asm = useAsmStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const criteria = r.rubric?.criteria ?? [];
  const [marks, setMarks] = useState<Record<string, string>>(() => Object.fromEntries(criteria.map((c) => [c.key, ""])));
  const [direct, setDirect] = useState(r.auto_score ?? "");
  const [note, setNote] = useState("");
  const [ai, setAi] = useState<AiSuggestionOut | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = Number(r.max_points);
  const total = criteria.length ? rubricTotal(marks) : Number(direct);
  const scoreValid = criteria.length
    ? criteria.every((c) => isDecimal(marks[c.key] ?? "") && Number(marks[c.key]) >= 0 && Number(marks[c.key]) <= Number(c.max_points))
    : isDecimal(direct) && Number(direct) >= 0 && Number(direct) <= max;

  const suggest = async () => {
    setAiBusy(true);
    try {
      setAi(await assessmentsApi.aiSuggestion(r.answer_id));
    } catch (e) {
      if (isApiError(e) && e.status === 409 && e.code === "ai_disabled") onAiDisabled();
      else toast.error(errorMessage(e));
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await assessmentsApi.review(r.answer_id, {
        score: String(Math.round(total * 100) / 100),
        ...(criteria.length ? { rubric_marks: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, v.trim()])) } : {}),
        note: note.trim() || null,
      });
      toast.success("Score submitted");
      void qc.invalidateQueries({ queryKey: assessmentKeys.reviews("pending") });
      void qc.invalidateQueries({ queryKey: ["assessments", "candidate-results"] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">{r.candidate_name ?? "Candidate"} · {r.assessment_name}</Subtitle2>}
        description={
          <Caption1 className={asm.muted}>
            Question {r.position} · section {r.section_key} · {ITEM_KIND_LABELS[r.kind] ?? r.kind} · up to {r.max_points} points
            {r.auto_score != null ? ` · auto score ${r.auto_score}${r.auto_confidence != null ? ` (confidence ${r.auto_confidence})` : ""}` : ""}
          </Caption1>
        }
      />
      <div className={styles.split}>
        <div className={asm.stack}>
          <Text weight="semibold">Question</Text>
          <Body1>{r.stem}</Body1>
          <CodeBlock code={r.code} label="Question code" />
          <Text weight="semibold">Candidate answer</Text>
          <pre className={mergeClasses(styles.answer, isCodeKind(r.kind) && styles.codeAnswer)} tabIndex={0} aria-label="Candidate answer">
            {responseText(r.kind, r.response)}
          </pre>
        </div>
        <div className={asm.stack}>
          {criteria.length > 0 ? (
            criteria.map((c) => (
              <div key={c.key} className={styles.criterion}>
                <Field label={`${c.label} (0–${c.max_points})`} hint={c.guidance || undefined}>
                  <SpinButton
                    value={marks[c.key] === "" ? null : Number(marks[c.key])}
                    displayValue={marks[c.key]}
                    min={0}
                    max={Number(c.max_points)}
                    step={0.5}
                    onChange={(_, d) => {
                      const v = d.value ?? (d.displayValue !== undefined ? Number(d.displayValue) : NaN);
                      setMarks((m) => ({ ...m, [c.key]: Number.isFinite(v) ? String(Math.min(Number(c.max_points), Math.max(0, Number(v)))) : "" }));
                    }}
                  />
                </Field>
              </div>
            ))
          ) : (
            <Field label={`Score (0–${r.max_points})`}>
              <Input value={direct} inputMode="decimal" onChange={(_, d) => setDirect(d.value)} />
            </Field>
          )}
          <Text className={styles.total} aria-live="polite">
            Total: {Number.isFinite(total) ? total : "—"} / {r.max_points}
          </Text>
          {!aiDisabled && (
            <div>
              <Button icon={aiBusy ? <Spinner size="tiny" /> : <Sparkle20Regular />} disabled={aiBusy} onClick={() => void suggest()}>
                Get AI suggestion
              </Button>
            </div>
          )}
          {ai && (
            <MessageBar intent="info" layout="multiline">
              <MessageBarBody>
                <MessageBarTitle>AI suggestion — advisory</MessageBarTitle>
                Suggested score {ai.suggested_score} / {r.max_points}. {ai.rationale}
              </MessageBarBody>
            </MessageBar>
          )}
          <Field label="Note (optional)">
            <Textarea value={note} maxLength={2000} rows={2} onChange={(_, d) => setNote(d.value)} />
          </Field>
          <ErrorBar message={error} />
          <div>
            <Button appearance="primary" disabled={busy || !scoreValid} onClick={() => void submit()}>
              Submit score
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
