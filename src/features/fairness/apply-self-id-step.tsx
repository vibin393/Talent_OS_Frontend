"use client";

import { Body1, Card, makeStyles, MessageBar, MessageBarBody, tokens } from "@fluentui/react-components";
import { useState } from "react";
import { SelfIdQuestions } from "@/components/self-id/self-id-questions";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { publicFairnessApi } from "./api";
import { answersPayload, defaultAnswers, visibleDimensions } from "./logic";
import { PublicNoticeBlock } from "./public-notice-block";
import type { SelfIdAnswers } from "./types";
import { usePublicSelfIdForm } from "./use-fairness";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  card: { padding: tokens.spacingHorizontalXL, "@media (max-width: 480px)": { padding: tokens.spacingHorizontalL } },
});

/**
 * Epic 49 additions to the careers apply success step: the LL144 notice block (with "Request an alternative
 * process") and the optional self-identification questions, both tied to the just-submitted application by the
 * in-memory apply token. Nothing here is required; skipping is the default.
 */
export function ApplyFairnessStep({ slug, postingId, applyToken }: { slug: string; postingId: string; applyToken: string }) {
  const styles = useStyles();
  return (
    <div className={styles.stack}>
      <PublicNoticeBlock slug={slug} postingId={postingId} applyToken={applyToken} />
      <ApplySelfId slug={slug} applyToken={applyToken} />
    </div>
  );
}

function ApplySelfId({ slug, applyToken }: { slug: string; applyToken: string }) {
  const styles = useStyles();
  const q = usePublicSelfIdForm(slug);
  const [edited, setEdited] = useState<SelfIdAnswers | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "skipped">("idle");
  const [error, setError] = useState<string | null>(null);
  const form = q.data;
  if (!form || !form.enabled || visibleDimensions(form.dimensions).length === 0) return null;
  const value = edited ?? defaultAnswers(form.dimensions);

  if (state === "skipped") return null;
  if (state === "saved") {
    return (
      <MessageBar intent="success" layout="multiline" role="status">
        <MessageBarBody>Thank you. Your answers were saved separately from your application.</MessageBarBody>
      </MessageBar>
    );
  }

  const submit = async () => {
    if (!form.notice) return;
    setState("busy");
    setError(null);
    try {
      await publicFairnessApi.submitSelfId(slug, applyToken, form.notice.id, answersPayload(form.dimensions, value));
      setState("saved");
    } catch (e) {
      setState("idle");
      if (isApiError(e) && e.status === 409) setState("saved");
      else if (isApiError(e) && e.status === 410) setError("This page has expired. You can answer these questions in the candidate portal instead.");
      else setError(errorMessage(e));
    }
  };

  return (
    <Card className={styles.card}>
      <Body1>Your application is complete. You may also answer these optional questions.</Body1>
      <SelfIdQuestions
        dimensions={form.dimensions}
        notice={form.notice}
        value={value}
        onChange={setEdited}
        onSubmit={submit}
        submitLabel="Submit answers"
        onSkip={() => setState("skipped")}
        skipLabel="Skip"
        busy={state === "busy"}
        error={error}
      />
    </Card>
  );
}
