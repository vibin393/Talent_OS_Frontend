"use client";

import { Body1, Button, Card, Link as FluentLink, makeStyles, MessageBar, MessageBarBody, MessageBarTitle, Spinner, Subtitle1, tokens } from "@fluentui/react-components";
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorSummary, type SummaryError } from "@/features/careers/error-summary";
import { QuestionFields } from "@/features/careers/question-fields";
import { answersPayload, questionFieldId, validateAnswers } from "@/features/careers/questions";
import { errorMessage, fieldErrors, isApiError } from "@/lib/api/errors";
import { portalApi, portalKeys } from "@/lib/api/portal-client";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "./ui";

const useStyles = makeStyles({
  notice: {
    maxHeight: "260px",
    overflowY: "auto",
    padding: tokens.spacingHorizontalM,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    overflowWrap: "anywhere",
  },
});

/** AI screening questions sent to the candidate: consent to AI processing first, then the questions. */
export function ScreeningView({ id }: { id: string }) {
  const styles = usePortalStyles();
  const local = useStyles();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: portalKeys.screening(id), queryFn: ({ signal }) => portalApi.screening(id, signal), retry: false });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<SummaryError[]>([]);
  const [focusKey, setFocusKey] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<"submitted" | "declined" | null>(null);

  const consent = useMutation({
    mutationFn: (granted: boolean) => portalApi.screeningConsent(id, { granted, notice_id: granted ? (q.data?.notice?.id ?? null) : null }),
  });
  const submit = useMutation({ mutationFn: (payload: Record<string, unknown>) => portalApi.screeningSubmit(id, payload) });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: portalKeys.screening(id) });
    void queryClient.invalidateQueries({ queryKey: portalKeys.screenings });
  };

  const onConsent = async (granted: boolean) => {
    setServerError(null);
    try {
      await consent.mutateAsync(granted);
      if (!granted) setResult("declined");
      refresh();
    } catch (e) {
      if (isApiError(e) && e.code === "notice_outdated") refresh();
      setServerError(errorMessage(e));
    }
  };

  const onSubmit = async () => {
    if (!q.data) return;
    setServerError(null);
    const errs = validateAnswers(q.data.questions, answers);
    const list = q.data.questions.filter((x) => errs[x.key]).map((x) => ({ id: questionFieldId(x.key), message: `${x.label}: ${errs[x.key]}` }));
    setFieldErr(errs);
    setSummary(list);
    if (list.length) {
      setFocusKey((k) => k + 1);
      return;
    }
    try {
      await submit.mutateAsync(answersPayload(q.data.questions, answers));
      setResult("submitted");
      refresh();
    } catch (e) {
      const fields = fieldErrors(e);
      if (Object.keys(fields).length) {
        setFieldErr(fields);
        setSummary(Object.entries(fields).map(([k, m]) => ({ id: questionFieldId(k), message: m })));
        setFocusKey((k) => k + 1);
      } else setServerError(errorMessage(e));
    }
  };

  const back = (
    <FluentLink href="/portal" style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44 }}>
      <ArrowLeft20Regular aria-hidden /> My applications
    </FluentLink>
  );

  if (result) {
    return (
      <div className={styles.page}>
        {back}
        <MessageBar intent={result === "submitted" ? "success" : "info"} layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>{result === "submitted" ? "Thank you — your answers were sent" : "No problem"}</MessageBarTitle>
            {result === "submitted"
              ? "The hiring team will review them and get back to you."
              : "You chose not to answer these questions with AI processing. The hiring team will follow up with you directly."}
          </MessageBarBody>
        </MessageBar>
      </div>
    );
  }
  if (q.isPending) return <LoadingBlock label="Loading questions" />;
  if (q.isError) {
    if (isApiError(q.error) && q.error.status === 404) {
      return (
        <div className={styles.page}>
          {back}
          <Card className={styles.card}>
            <Subtitle1 as="h1">These questions are no longer open</Subtitle1>
            <Body1>They may already have been answered or have expired.</Body1>
          </Card>
        </div>
      );
    }
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  }
  const s = q.data;
  const open = s.status === "sent";

  return (
    <div className={styles.page}>
      {back}
      <PortalPageHeader title={s.title} subtitle="Screening questions from the hiring team" />
      <InlineError message={serverError} />
      {!open ? (
        <Card className={styles.card}>
          <Body1>These questions are no longer open for answers.</Body1>
        </Card>
      ) : s.consent_required ? (
        <Card className={styles.card} role="region" aria-labelledby="consent-title">
          <Subtitle1 as="h2" id="consent-title">
            {s.notice?.title ?? "Before you start"}
          </Subtitle1>
          <Body1>Your answers are reviewed with the help of AI. Please read how your answers are used before you decide.</Body1>
          {s.notice && (
            <div/* NOSONAR */ className={local.notice} role="region" aria-label={s.notice.title} tabIndex={0} dangerouslySetInnerHTML={{ __html: s.notice.body_html || s.notice.body }} />
          )}
          <div className={styles.actions}>
            <Button appearance="primary" className={styles.button} disabled={consent.isPending} onClick={() => onConsent(true)} icon={consent.isPending ? <Spinner size="tiny" /> : undefined}>
              I agree, show the questions
            </Button>
            <Button className={styles.button} disabled={consent.isPending} onClick={() => onConsent(false)}>
              No thanks
            </Button>
          </div>
        </Card>
      ) : (
        <Card className={styles.card}>
          <ErrorSummary errors={summary} focusKey={focusKey} />
          <QuestionFields
            questions={s.questions}
            drafts={answers}
            errors={fieldErr}
            onChange={(k, v) => {
              setAnswers((a) => ({ ...a, [k]: v }));
              if (fieldErr[k]) setFieldErr((f) => ({ ...f, [k]: "" }));
            }}
            disabled={submit.isPending}
          />
          <div className={styles.actions}>
            <Button appearance="primary" className={styles.button} onClick={onSubmit} disabled={submit.isPending} icon={submit.isPending ? <Spinner size="tiny" /> : undefined}>
              Send my answers
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
