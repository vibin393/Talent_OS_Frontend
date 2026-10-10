"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
  Dropdown,
  Field,
  makeStyles,
  Option,
  Spinner,
  Subtitle2,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime, GridSkeleton } from "@/features/admin/ui";
import { pipelineApi, pipelineKeys } from "@/features/pipeline/api";
import { OUTCOME_LABELS } from "@/features/pipeline/format";
import { ReasonDialog, type ReasonValues } from "@/features/pipeline/reason-dialog";
import { pipelineError } from "@/features/pipeline/use-actions";
import { useInvalidatePipeline } from "@/features/pipeline/use-pipeline";
import { errorMessage } from "@/lib/api/errors";
import type { ApplicationDetailOut, ScreeningOut, ScreeningOutcome } from "@/lib/api/types";
import { CandidateUpdatesPanel } from "./candidate-updates-panel";
import { QuestionField } from "./question-field";
import { type Answers, type AnswerValue, cleanAnswers, formatAnswer, validateAnswers } from "./validation";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  card: { padding: tokens.spacingHorizontalM },
  answers: {
    display: "grid",
    gridTemplateColumns: "minmax(120px, 40%) 1fr",
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalXS,
    margin: 0,
    "& dt": { color: tokens.colorNeutralForeground3 },
    "& dd": { margin: 0, overflowWrap: "anywhere" },
  },
});

/** Recruiter screening: questionnaire form, notes, Proceed / Hold / Reject and the profile-update offer. */
export function RecruiterScreening({ app, canWrite }: { app: ApplicationDetailOut; canWrite: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const invalidate = useInvalidatePipeline();
  const previous = (app.screenings ?? []).filter((s) => s.kind === "recruiter").sort((a, b) => b.created_at.localeCompare(a.created_at));
  const openDraft = previous.find((s) => s.status === "draft") ?? null;
  const [questionnaireId, setQuestionnaireId] = useState<string | null>(openDraft?.questionnaire_id ?? null);
  const [draft, setDraft] = useState<ScreeningOut | null>(openDraft);
  const [answers, setAnswers] = useState<Answers>(() => (openDraft?.answers as Answers) ?? {});
  const [notes, setNotes] = useState(openDraft?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [moveToShortlisted, setMoveToShortlisted] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [saved, setSaved] = useState<ScreeningOut | null>(null);

  const questionnaires = useQuery({
    queryKey: pipelineKeys.questionnaires(false),
    queryFn: ({ signal }) => pipelineApi.questionnaires(false, signal),
    staleTime: 5 * 60_000,
  });
  const form = useQuery({
    queryKey: pipelineKeys.screeningForm(app.id, questionnaireId),
    queryFn: ({ signal }) => pipelineApi.screeningForm(app.id, questionnaireId, signal),
    enabled: canWrite,
  });
  const questions = draft?.questions?.length ? (draft.questions as ScreeningOut["questions"]) : (form.data?.questions ?? []);
  const qs = questions as unknown as { key: string; label: string; type: string; options?: string[] | null; required?: boolean }[];

  const save = useMutation({
    mutationFn: async (vars: { outcome: ScreeningOutcome | null; reason?: ReasonValues }) => {
      const body = { answers: cleanAnswers(qs, answers), notes: notes.trim() || null };
      let row = draft;
      if (row) {
        row = await pipelineApi.updateScreening(row.id, body);
      } else if (!vars.outcome) {
        row = await pipelineApi.createScreening(app.id, {
          ...body,
          questionnaire_id: form.data?.questionnaire_id ?? questionnaireId,
          move_to_shortlisted: false,
          send_rejection_email: false,
        });
      }
      if (!vars.outcome) return row!;
      const outcome = {
        outcome: vars.outcome,
        reason_code: vars.reason?.reasonCode ?? null,
        note: vars.reason?.note || null,
        move_to_shortlisted: vars.outcome === "proceed" && moveToShortlisted,
        send_rejection_email: vars.reason?.sendRejectionEmail ?? false,
      };
      if (row) return pipelineApi.setOutcome(row.id, outcome);
      return pipelineApi.createScreening(app.id, {
        ...body,
        ...outcome,
        questionnaire_id: form.data?.questionnaire_id ?? questionnaireId,
      });
    },
    onSuccess: (row, vars) => {
      if (vars.outcome) {
        toast.success(`Screening saved: ${OUTCOME_LABELS[vars.outcome]}.`);
        setDraft(null);
        setAnswers({});
        setNotes("");
        setSaved(row);
      } else {
        toast.success("Screening draft saved.");
        setDraft(row);
        if (row.proposed_candidate_updates?.length) setSaved(row);
      }
    },
    onSettled: () => invalidate(app.demand_id),
  });

  const complete = (outcome: ScreeningOutcome) => {
    const found = validateAnswers(qs, answers, true);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error("Answer the required questions first.");
      return;
    }
    if (outcome === "reject") {
      setRejecting(true);
      return;
    }
    save.mutate({ outcome });
  };

  const saveDraft = () => {
    const found = validateAnswers(qs, answers, false);
    setErrors(found);
    if (!Object.keys(found).length) save.mutate({ outcome: null });
  };

  const set = (key: string, v: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [key]: v }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const completed = previous.filter((s) => s.outcome);

  return (
    <div className={styles.root}>
      {saved && (saved.proposed_candidate_updates?.length ?? 0) > 0 && (
        <CandidateUpdatesPanel
          screeningId={saved.id}
          candidateId={app.candidate.id}
          updates={saved.proposed_candidate_updates ?? []}
          onDone={() => setSaved(null)}
        />
      )}
      {canWrite ? (
        <Card className={styles.card}>
          <CardHeader header={<Subtitle2 as="h3">{draft ? "Continue screening" : "Recruiter screening"}</Subtitle2>} />
          <div className={styles.form}>
            {!draft && (questionnaires.data?.length ?? 0) > 1 && (
              <Field label="Questionnaire">
                <Dropdown
                  value={questionnaires.data?.find((q) => q.id === (questionnaireId ?? form.data?.questionnaire_id))?.name ?? ""}
                  selectedOptions={questionnaireId ? [questionnaireId] : []}
                  onOptionSelect={(_, d) => setQuestionnaireId(d.optionValue ?? null)}
                >
                  {questionnaires.data?.map((q) => (
                    <Option key={q.id} value={q.id}>
                      {q.is_default ? `${q.name} (default)` : q.name}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            )}
            {form.isPending && !draft ? (
              <GridSkeleton rows={4} />
            ) : form.isError && !draft ? (
              <ErrorBar title="Could not load the questionnaire." message={errorMessage(form.error)} />
            ) : (
              qs.map((q) => (
                <QuestionField
                  key={q.key}
                  question={q}
                  value={answers[q.key]}
                  onChange={(v) => set(q.key, v)}
                  error={errors[q.key] || undefined}
                  disabled={save.isPending}
                />
              ))
            )}
            <Field label="Notes">
              <Textarea value={notes} onChange={(_, d) => setNotes(d.value)} resize="vertical" maxLength={20000} />
            </Field>
            <Checkbox
              checked={moveToShortlisted}
              onChange={(_, d) => setMoveToShortlisted(!!d.checked)}
              label="On Proceed, also move the candidate to Shortlisted"
            />
            {save.isError && <ErrorBar message={pipelineError(save.error)} />}
            <div className={styles.actions}>
              <Button appearance="primary" disabled={save.isPending} onClick={() => complete("proceed")}>
                Proceed
              </Button>
              <Button disabled={save.isPending} onClick={() => complete("hold")}>
                Hold
              </Button>
              <Button disabled={save.isPending} onClick={() => complete("reject")}>
                Reject…
              </Button>
              <Button appearance="subtle" disabled={save.isPending} onClick={saveDraft}>
                Save draft
              </Button>
              {save.isPending && <Spinner size="tiny" label="Saving…" />}
            </div>
          </div>
        </Card>
      ) : (
        <Body1>You can view screenings but not record them.</Body1>
      )}

      {completed.length > 0 && (
        <section aria-label="Previous recruiter screenings">
          <Subtitle2 as="h3">Previous screenings</Subtitle2>
          {completed.map((s) => (
            <Card key={s.id} className={styles.card} style={{ marginTop: 8 }}>
              <CardHeader
                header={<Body1>{OUTCOME_LABELS[s.outcome ?? ""] ?? s.outcome}</Body1>}
                description={<Caption1>{formatDateTime(s.completed_at ?? s.created_at)}</Caption1>}
              />
              <dl className={styles.answers}>
                {(s.questions as unknown as { key: string; label: string; type: string }[]).map((q) => (
                  <FragmentRow key={q.key} label={q.label} value={formatAnswer(q, s.answers[q.key])} />
                ))}
              </dl>
              {s.notes && <Body1 block>{s.notes}</Body1>}
            </Card>
          ))}
        </section>
      )}

      {rejecting && (
        <ReasonDialog
          kind="reject"
          subject={app.candidate.full_name ?? "candidate"}
          onClose={() => setRejecting(false)}
          onSubmit={(reason) => save.mutateAsync({ outcome: "reject", reason })}
        />
      )}
    </div>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
