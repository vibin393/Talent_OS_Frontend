"use client";

import {
  Body1,
  Button,
  Card,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Spinner,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { CheckmarkCircle48Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { publicReferenceApi } from "./api";
import { type AnswerValue, validateReferenceAnswers } from "./logic";

const useStyles = makeStyles({
  card: { maxWidth: "640px", width: "100%", padding: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, boxSizing: "border-box" },
  state: { display: "flex", flexDirection: "column", alignItems: "center", gap: tokens.spacingVerticalM, textAlign: "center" },
  ok: { color: tokens.colorPaletteGreenForeground1 },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  button: { minHeight: "44px" },
});

/** Purpose `reference_check`: the referee questionnaire (GET never mutates), submit once, or decline. */
export function PublicReference({ token }: { token: string }) {
  const styles = useStyles();
  const q = useQuery({ queryKey: ["public", "reference", token], queryFn: () => publicReferenceApi.view(token), retry: false });
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<"submitted" | "declined" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (q.isPending) return <Spinner label="Loading the questionnaire" />;
  if (q.isError) {
    return (
      <Card className={styles.card}>
        <Body1 role="alert">{errorMessage(q.error, "This link is not valid.")}</Body1>
      </Card>
    );
  }
  const view = q.data;
  if (done || view.status !== "sent") {
    return (
      <Card className={styles.card}>
        <div className={styles.state}>
          <CheckmarkCircle48Regular aria-hidden className={styles.ok} />
          <Body1 role="status">
            {done === "declined" ? "Thank you — we have noted that you prefer not to give a reference." : "Thank you — your reference has been received."}
          </Body1>
        </div>
      </Card>
    );
  }
  const act = async (fn: () => Promise<{ status: string }>, outcome: "submitted" | "declined") => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setDone(outcome);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    const errs = validateReferenceAnswers(view.questions, answers);
    setErrors(errs);
    if (Object.keys(errs).length === 0) void act(() => publicReferenceApi.submit(token, answers), "submitted");
  };
  return (
    <Card className={styles.card}>
      <Text as="h1" size={500} weight="semibold">
        Reference for {view.candidate_name ?? "a candidate"}
      </Text>
      <Body1>
        {view.tenant_name ?? "The hiring team"} asked {view.referee_name ?? "you"} for a short reference. Your answers are seen only by the hiring team.
      </Body1>
      {view.questions.map((question) => (
        <Field key={question.key} label={question.text} required={question.required} validationMessage={errors[question.key]}>
          {question.kind === "rating" ? (
            <RadioGroup layout="horizontal" value={String(answers[question.key] ?? "")} onChange={(_, d) => setAnswers((a) => ({ ...a, [question.key]: Number(d.value) }))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Radio key={n} value={String(n)} label={String(n)} />
              ))}
            </RadioGroup>
          ) : question.kind === "yes_no" ? (
            <RadioGroup
              layout="horizontal"
              value={answers[question.key] === undefined ? "" : answers[question.key] ? "yes" : "no"}
              onChange={(_, d) => setAnswers((a) => ({ ...a, [question.key]: d.value === "yes" }))}
            >
              <Radio value="yes" label="Yes" />
              <Radio value="no" label="No" />
            </RadioGroup>
          ) : (
            <Textarea value={String(answers[question.key] ?? "")} onChange={(_, d) => setAnswers((a) => ({ ...a, [question.key]: d.value }))} />
          )}
        </Field>
      ))}
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <div className={styles.actions}>
        <Button appearance="primary" className={styles.button} disabled={busy} onClick={submit}>
          Submit reference
        </Button>
        <Button className={styles.button} disabled={busy} onClick={() => void act(() => publicReferenceApi.decline(token), "declined")}>
          Decline
        </Button>
      </div>
    </Card>
  );
}
