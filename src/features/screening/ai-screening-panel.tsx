"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Spinner,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowClockwise20Regular,
  Delete20Regular,
  LinkDismiss20Regular,
  Send20Regular,
  Sparkle20Regular,
} from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { formatDateTime } from "@/features/admin/ui";
import { pipelineApi } from "@/features/pipeline/api";
import { OUTCOME_LABELS, SCREENING_STATUS } from "@/features/pipeline/format";
import { ReasonDialog, type ReasonValues } from "@/features/pipeline/reason-dialog";
import { pipelineError } from "@/features/pipeline/use-actions";
import { useInvalidatePipeline } from "@/features/pipeline/use-pipeline";
import { isApiError } from "@/lib/api/errors";
import type { ApplicationDetailOut, ScreeningOut, ScreeningOutcome } from "@/lib/api/types";
import { formatAnswer, questionKey } from "./validation";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  card: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalS },
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-end", flexWrap: "wrap" },
  grow: { flex: "1 1 240px", minWidth: 0 },
  type: { width: "130px" },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  review: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: tokens.spacingHorizontalL,
    alignItems: "start",
  },
  answers: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    margin: 0,
    "& dt": { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
    "& dd": { margin: 0, overflowWrap: "anywhere" },
  },
  ai: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalS, borderLeft: `3px solid ${tokens.colorBrandStroke1}` },
  muted: { color: tokens.colorNeutralForeground3 },
});

type EditableQuestion = { key: string; label: string; type: "text" | "choice" | "number"; options: string[]; required: boolean };

function toEditable(s: ScreeningOut): EditableQuestion[] {
  return (s.questions as Record<string, unknown>[]).map((q) => ({
    key: String(q.key),
    label: String(q.label ?? ""),
    type: (["text", "choice", "number"].includes(String(q.type)) ? q.type : "text") as EditableQuestion["type"],
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
    required: q.required !== false,
  }));
}

/** AI screening: Generate → edit questions → Send → review answers + AI summary → outcome. */
export function AiScreeningPanel({ app, canWrite }: { app: ApplicationDetailOut; canWrite: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const invalidate = useInvalidatePipeline();
  const aiScreenings = (app.screenings ?? []).filter((s) => s.kind === "ai").sort((a, b) => b.created_at.localeCompare(a.created_at));
  const current = aiScreenings[0] ?? null; // newest first
  const [aiUnavailable, setAiUnavailable] = useState(false);

  const generate = useMutation({
    mutationFn: () => pipelineApi.generateAiScreening(app.id),
    onSuccess: () => toast.success("Questions drafted. Review them before sending."),
    onError: (e) => {
      if (isApiError(e) && e.code === "ai_unavailable") setAiUnavailable(true);
      else toast.error(pipelineError(e));
    },
    onSettled: () => invalidate(app.demand_id),
  });

  if (!current || current.status === "completed") {
    return (
      <div className={styles.root}>
        {aiUnavailable && (
          <MessageBar intent="warning" layout="multiline">
            <MessageBarBody>
              <MessageBarTitle>AI is unavailable right now.</MessageBarTitle>
              Use the recruiter screening questionnaire above instead, or try again later.
            </MessageBarBody>
          </MessageBar>
        )}
        <Card className={styles.card}>
          <CardHeader
            image={<Sparkle20Regular aria-hidden />}
            header={<Subtitle2 as="h3">AI screening</Subtitle2>}
            description="Draft 5–10 questions from the job description (no candidate data is sent to AI), edit them, then email the candidate a secure link."
          />
          {canWrite && (
            <div className={styles.actions}>
              <Button appearance="primary" icon={generate.isPending ? <Spinner size="tiny" /> : <Sparkle20Regular />} disabled={generate.isPending} onClick={() => generate.mutate()}>
                Generate questions
              </Button>
            </div>
          )}
        </Card>
        {current && <ScreeningReview screening={current} app={app} canWrite={false} />}
      </div>
    );
  }
  if (current.status === "draft") return <QuestionEditor key={current.id} screening={current} app={app} canWrite={canWrite} />;
  return <ScreeningReview key={current.id} screening={current} app={app} canWrite={canWrite} />;
}

function StatusBadge({ status }: { status: string }) {
  const s = SCREENING_STATUS[status];
  return (
    <Badge appearance="tint" color={s?.color ?? "informative"}>
      {s?.label ?? status}
    </Badge>
  );
}

function QuestionEditor({ screening, app, canWrite }: { screening: ScreeningOut; app: ApplicationDetailOut; canWrite: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const invalidate = useInvalidatePipeline();
  const [questions, setQuestions] = useState<EditableQuestion[]>(() => toEditable(screening));
  const [dirty, setDirty] = useState(false);

  const update = (i: number, patch: Partial<EditableQuestion>) => {
    setQuestions((prev) => prev.map((q, j) => (j === i ? { ...q, ...patch } : q)));
    setDirty(true);
  };
  const invalid = questions.some((q) => !q.label.trim() || (q.type === "choice" && q.options.filter(Boolean).length < 2));

  const save = useMutation({
    mutationFn: () =>
      pipelineApi.updateScreening(screening.id, {
        questions: questions.map((q) => ({
          key: q.key,
          label: q.label.trim(),
          type: q.type,
          options: q.type === "choice" ? q.options.map((o) => o.trim()).filter(Boolean) : null,
          required: q.required,
        })),
      }),
    onSuccess: () => setDirty(false),
  });
  const send = useMutation({
    mutationFn: async () => {
      if (dirty) await save.mutateAsync();
      return pipelineApi.sendAiScreening(screening.id);
    },
    onSuccess: () => toast.success("Screening link emailed to the candidate."),
    onError: (e) => toast.error(pipelineError(e)),
    onSettled: () => invalidate(app.demand_id),
  });

  return (
    <Card className={styles.card}>
      <CardHeader
        image={<Sparkle20Regular aria-hidden />}
        header={<Subtitle2 as="h3">AI screening questions</Subtitle2>}
        description={
          <span>
            <StatusBadge status={screening.status} />{" "}
            <Badge appearance="outline" color="brand">
              AI-generated
            </Badge>{" "}
            Edit the draft, then send it.
          </span>
        }
      />
      {questions.map((q, i) => (
        <div key={q.key} className={styles.row}>
          <Field label={`Question ${i + 1}`} className={styles.grow} required validationState={q.label.trim() ? "none" : "error"} validationMessage={q.label.trim() ? undefined : "Enter the question"}>
            <Input value={q.label} disabled={!canWrite} onChange={(_, d) => update(i, { label: d.value })} maxLength={500} />
          </Field>
          <Field label="Answer type" className={styles.type}>
            <Dropdown
              value={{ text: "Text", choice: "Choice", number: "Number" }[q.type]}
              selectedOptions={[q.type]}
              disabled={!canWrite}
              onOptionSelect={(_, d) => update(i, { type: (d.optionValue as EditableQuestion["type"]) ?? "text" })}
            >
              <Option value="text">Text</Option>
              <Option value="choice">Choice</Option>
              <Option value="number">Number</Option>
            </Dropdown>
          </Field>
          {q.type === "choice" && (
            <Field label="Options (comma-separated)" className={styles.grow} validationState={q.options.filter(Boolean).length < 2 ? "error" : "none"} validationMessage={q.options.filter(Boolean).length < 2 ? "At least two options" : undefined}>
              <Input
                value={q.options.join(", ")}
                disabled={!canWrite}
                onChange={(_, d) => update(i, { options: d.value.split(",").map((o) => o.trimStart()) })}
              />
            </Field>
          )}
          <Checkbox label="Required" checked={q.required} disabled={!canWrite} onChange={(_, d) => update(i, { required: !!d.checked })} />
          {canWrite && (
            <Button
              appearance="subtle"
              icon={<Delete20Regular />}
              aria-label={`Remove question ${i + 1}`}
              disabled={questions.length <= 1}
              onClick={() => {
                setQuestions((prev) => prev.filter((_, j) => j !== i));
                setDirty(true);
              }}
            />
          )}
        </div>
      ))}
      {canWrite && (
        <div className={styles.actions}>
          <Button
            icon={<Add20Regular />}
            disabled={questions.length >= 60}
            onClick={() => {
              setQuestions((prev) => [
                ...prev,
                { key: questionKey("question", new Set(prev.map((q) => q.key))), label: "", type: "text", options: [], required: true },
              ]);
              setDirty(true);
            }}
          >
            Add question
          </Button>
          <Button disabled={!dirty || invalid || save.isPending} onClick={() => save.mutate(undefined, { onError: (e) => toast.error(pipelineError(e)) })}>
            Save
          </Button>
          <Button appearance="primary" icon={send.isPending ? <Spinner size="tiny" /> : <Send20Regular />} disabled={invalid || send.isPending} onClick={() => send.mutate()}>
            Send to candidate
          </Button>
        </div>
      )}
    </Card>
  );
}

type Summary = {
  structured_answers?: { question_key: string; answer: string }[];
  gaps?: { question_key: string; issue: string }[];
  summary?: string;
  suggested_outcome?: "proceed" | "hold" | null;
};

function ScreeningReview({ screening, app, canWrite }: { screening: ScreeningOut; app: ApplicationDetailOut; canWrite: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const invalidate = useInvalidatePipeline();
  const [moveToShortlisted, setMoveToShortlisted] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const questions = screening.questions as { key: string; label: string; type: string }[];
  const byKey = new Map(questions.map((q) => [q.key, q]));
  const summary = screening.ai_summary as Summary | null;
  const reviewed = !!screening.reviewed_at;
  const answered = ["answered", "reviewed", "completed"].includes(screening.status);

  const done = () => invalidate(app.demand_id);
  const act = useMutation({
    mutationFn: async (action: "review" | "retry" | "resend" | "revoke") => {
      if (action === "review") return pipelineApi.reviewScreening(screening.id);
      if (action === "retry") return pipelineApi.retrySummary(screening.id);
      if (action === "resend") return pipelineApi.sendAiScreening(screening.id);
      if (!screening.secure_link_id) throw new Error("No link");
      return pipelineApi.revokeLink(screening.secure_link_id);
    },
    onSuccess: (_, action) =>
      toast.success(
        { review: "Marked as reviewed.", retry: "Summary requested again.", resend: "A new link was emailed.", revoke: "The link was revoked." }[action],
      ),
    onError: (e) => toast.error(pipelineError(e)),
    onSettled: done,
  });
  const outcome = useMutation({
    mutationFn: (vars: { outcome: ScreeningOutcome; reason?: ReasonValues }) =>
      pipelineApi.setOutcome(screening.id, {
        outcome: vars.outcome,
        reason_code: vars.reason?.reasonCode ?? null,
        note: vars.reason?.note || null,
        move_to_shortlisted: vars.outcome === "proceed" && moveToShortlisted,
        send_rejection_email: vars.reason?.sendRejectionEmail ?? false,
      }),
    onSuccess: (_, vars) => toast.success(`Outcome saved: ${OUTCOME_LABELS[vars.outcome]}.`),
    onError: (e) => toast.error(pipelineError(e)),
    onSettled: done,
  });

  return (
    <div className={styles.root}>
      <Card className={styles.card}>
        <CardHeader
          image={<Sparkle20Regular aria-hidden />}
          header={<Subtitle2 as="h3">AI screening</Subtitle2>}
          description={
            <span>
              <StatusBadge status={screening.status} />
              {screening.status === "sent" && screening.link_expires_at && (
                <Caption1 className={styles.muted}> · Link expires {formatDateTime(screening.link_expires_at)}</Caption1>
              )}
              {screening.answered_at && <Caption1 className={styles.muted}> · Answered {formatDateTime(screening.answered_at)}</Caption1>}
            </span>
          }
        />
        {screening.status === "consent_declined" && (
          <MessageBar intent="warning">
            <MessageBarBody>The candidate declined AI-assisted screening. Use the recruiter questionnaire instead.</MessageBarBody>
          </MessageBar>
        )}
        {canWrite && (screening.status === "sent" || screening.status === "expired") && (
          <div className={styles.actions}>
            <Button icon={<Send20Regular />} disabled={act.isPending} onClick={() => act.mutate("resend")}>
              Resend link
            </Button>
            {screening.status === "sent" && screening.secure_link_id && (
              <Button icon={<LinkDismiss20Regular />} disabled={act.isPending} onClick={() => act.mutate("revoke")}>
                Revoke link
              </Button>
            )}
          </div>
        )}
      </Card>

      {answered && (
        <div className={styles.review}>
          <Card className={styles.card}>
            <CardHeader header={<Subtitle2 as="h4">Candidate answers</Subtitle2>} />
            <dl className={styles.answers}>
              {questions.map((q) => (
                <div key={q.key}>
                  <dt>{q.label}</dt>
                  <dd>{formatAnswer(byKey.get(q.key), screening.answers[q.key])}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className={styles.ai} aria-label="AI-generated summary">
            <CardHeader
              header={<Subtitle2 as="h4">Summary</Subtitle2>}
              action={
                <Badge appearance="filled" color="brand" icon={<Sparkle20Regular />}>
                  AI-generated
                </Badge>
              }
            />
            {screening.summary_status === "pending" && !summary ? (
              <Spinner size="tiny" label="Summarizing the answers…" labelPosition="after" />
            ) : summary ? (
              <>
                <Body1>{summary.summary}</Body1>
                {(summary.gaps ?? []).map((g, i) => (
                  <MessageBar key={i} intent="warning" layout="multiline">
                    <MessageBarBody>
                      <MessageBarTitle>{byKey.get(g.question_key)?.label ?? g.question_key}</MessageBarTitle>
                      {g.issue}
                    </MessageBarBody>
                  </MessageBar>
                ))}
                {summary.suggested_outcome && (
                  <Text size={200} className={styles.muted}>
                    AI suggestion (a hint only — you decide): {OUTCOME_LABELS[summary.suggested_outcome]}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Body1 className={styles.muted}>The AI summary is not available. The answers are shown on the left.</Body1>
                {canWrite && (
                  <Button icon={<ArrowClockwise20Regular />} disabled={act.isPending} onClick={() => act.mutate("retry")}>
                    Retry summary
                  </Button>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {answered && canWrite && screening.status !== "completed" && (
        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h4">Outcome</Subtitle2>} description={reviewed ? `Reviewed ${formatDateTime(screening.reviewed_at)}` : "Review the answers and summary before deciding."} />
          {!reviewed && (
            <div className={styles.actions}>
              <Button appearance="primary" disabled={act.isPending} onClick={() => act.mutate("review")}>
                Mark as reviewed
              </Button>
            </div>
          )}
          <Checkbox checked={moveToShortlisted} disabled={!reviewed} onChange={(_, d) => setMoveToShortlisted(!!d.checked)} label="On Proceed, also move the candidate to Shortlisted" />
          <div className={styles.actions}>
            <Button appearance={reviewed ? "primary" : "secondary"} disabled={!reviewed || outcome.isPending} onClick={() => outcome.mutate({ outcome: "proceed" })}>
              Proceed
            </Button>
            <Button disabled={!reviewed || outcome.isPending} onClick={() => outcome.mutate({ outcome: "hold" })}>
              Hold
            </Button>
            <Button disabled={!reviewed || outcome.isPending} onClick={() => setRejecting(true)}>
              Reject…
            </Button>
          </div>
        </Card>
      )}
      {screening.status === "completed" && screening.outcome && (
        <Body1>
          Outcome: <strong>{OUTCOME_LABELS[screening.outcome]}</strong> ({formatDateTime(screening.completed_at)})
        </Body1>
      )}
      {rejecting && (
        <ReasonDialog
          kind="reject"
          subject={app.candidate.full_name ?? "candidate"}
          onClose={() => setRejecting(false)}
          onSubmit={(reason) => outcome.mutateAsync({ outcome: "reject", reason })}
        />
      )}
    </div>
  );
}
