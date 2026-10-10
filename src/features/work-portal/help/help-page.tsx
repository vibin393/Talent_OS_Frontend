"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { errorMessage } from "@/lib/api/errors";
import { type HelpMessage, type HelpThread, workHelpApi, workHelpKeys } from "./api";
import { answerText, assistantFooter, citationChip, counter, MAX_QUESTION } from "./logic";

const useStyles = makeStyles({
  messages: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  you: { alignSelf: "flex-end", maxWidth: "85%", backgroundColor: tokens.colorBrandBackground2, padding: tokens.spacingHorizontalM },
  other: { alignSelf: "flex-start", maxWidth: "85%", padding: tokens.spacingHorizontalM },
  chips: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS, marginTop: tokens.spacingVerticalXS },
  pre: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  muted: { color: tokens.colorNeutralForeground3 },
});

const INTRO =
  "Ask about your onboarding. Answers come from your employer's onboarding material and your own tasks. An AI assistant answers on behalf of your coordinator.";

function Message({ m, coordinator, onFeedback }: { m: HelpMessage; coordinator: string; onFeedback: (id: string, f: "helpful" | "not_helpful" | "incorrect") => void }) {
  const styles = useStyles();
  return (
    <Card className={m.author === "you" ? styles.you : styles.other}>
      <Body1 className={styles.pre}>{answerText(m)}</Body1>
      {m.citations.length > 0 && (
        <div className={styles.chips}>
          {m.citations.map((c) => (
            <Badge key={`${c.kind}:${c.label}`} appearance="outline">
              {citationChip(c)}
            </Badge>
          ))}
        </div>
      )}
      {m.author === "assistant" && <Caption1 className={styles.muted}>{assistantFooter(coordinator)}</Caption1>}
      {(m.author === "assistant" || m.author === "coordinator") &&
        (m.feedback ? (
          <Caption1 className={styles.muted}>Thanks for your feedback.</Caption1>
        ) : (
          <div className={styles.chips}>
            <Caption1>Was this helpful?</Caption1>
            <Button size="small" appearance="subtle" onClick={() => onFeedback(m.id, "helpful")}>
              Yes
            </Button>
            <Button size="small" appearance="subtle" onClick={() => onFeedback(m.id, "not_helpful")}>
              No
            </Button>
            <Button size="small" appearance="subtle" onClick={() => onFeedback(m.id, "incorrect")}>
              Report a wrong answer
            </Button>
          </div>
        ))}
    </Card>
  );
}

export function WorkHelp({ threadId }: { threadId?: string }) {
  const portal = usePortalStyles();
  const styles = useStyles();
  const qc = useQueryClient();
  const router = useRouter();
  const [text, setText] = useState("");
  const state = useQuery({ queryKey: workHelpKeys.state, queryFn: ({ signal }) => workHelpApi.state(signal) });
  const thread = useQuery({
    queryKey: workHelpKeys.thread(threadId ?? ""),
    queryFn: ({ signal }) => workHelpApi.thread(String(threadId), signal),
    enabled: Boolean(threadId),
  });
  const show = (t: HelpThread) => {
    qc.setQueryData(workHelpKeys.thread(t.id), t);
    void qc.invalidateQueries({ queryKey: workHelpKeys.state });
    setText("");
    if (t.id !== threadId) router.push(`/portal/work/help/${t.id}`);
  };
  const consent = useMutation({
    mutationFn: () => workHelpApi.consent(state.data?.notice?.notice_id ?? null),
    onSuccess: (s) => qc.setQueryData(workHelpKeys.state, s),
  });
  const ask = useMutation({ mutationFn: () => (threadId ? workHelpApi.followUp(threadId, text) : workHelpApi.ask(text)), onSuccess: show });
  const handoff = useMutation({ mutationFn: () => workHelpApi.handoff(threadId ?? null), onSuccess: show });
  const feedback = useMutation({
    mutationFn: ({ id, f }: { id: string; f: "helpful" | "not_helpful" | "incorrect" }) => workHelpApi.feedback(id, f),
    onSuccess: show,
  });
  if (state.isPending) return <LoadingBlock label="Loading onboarding help" />;
  if (state.isError) return <ErrorBlock error={state.error} onRetry={() => state.refetch()} />;
  const s = state.data;
  if (!s.available) {
    return (
      <div className={portal.page}>
        <PortalPageHeader title="Onboarding help" />
        <Body1>Onboarding help is available once your onboarding has started.</Body1>
      </div>
    );
  }
  if (s.consent_needed && s.notice) {
    return (
      <div className={portal.page}>
        <PortalPageHeader title="Before you ask" />
        <Card className={portal.card}>
          <Text weight="semibold">{s.notice.title}</Text>
          <Body1 className={styles.pre}>{s.notice.body_md.replace(/\*\*/g, "")}</Body1>
          <InlineError message={consent.isError ? errorMessage(consent.error) : null} />
          <div className={portal.actions}>
            <Button appearance="primary" className={portal.button} disabled={consent.isPending} onClick={() => consent.mutate()}>
              Continue
            </Button>
            <NextLink href="/portal/work">
              <Button className={portal.button}>Not now</Button>
            </NextLink>
          </div>
        </Card>
      </div>
    );
  }
  const t = thread.data;
  return (
    <div className={portal.page}>
      <PortalPageHeader title="Onboarding help" subtitle={INTRO} />
      {!threadId && s.threads.length > 0 && (
        <Card className={portal.card}>
          <Text weight="semibold">Your questions</Text>
          <ul className={portal.list}>
            {s.threads.map((x) => (
              <li key={x.id}>
                <NextLink className={portal.rowTitle} href={`/portal/work/help/${x.id}`}>
                  {x.first_question || "Question"}
                </NextLink>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {threadId && thread.isPending && <LoadingBlock label="Loading your question" />}
      {threadId && thread.isError && <ErrorBlock error={thread.error} onRetry={() => thread.refetch()} />}
      <div className={styles.messages} aria-live="polite">
        {t?.messages.map((m) => (
          <Message key={m.id} m={m} coordinator={t.coordinator_name} onFeedback={(id, f) => feedback.mutate({ id, f })} />
        ))}
      </div>
      {(!t || t.can_reply) && (
        <Card className={portal.card}>
          <Field label="Your question" hint={counter(text)}>
            <Textarea placeholder="Type your question" value={text} maxLength={MAX_QUESTION} rows={3} onChange={(_, d) => setText(d.value)} />
          </Field>
          <InlineError message={ask.isError ? errorMessage(ask.error) : handoff.isError ? errorMessage(handoff.error) : null} />
          <div className={portal.actions}>
            <Button appearance="primary" className={portal.button} disabled={!text.trim() || ask.isPending} onClick={() => ask.mutate()}>
              Ask
            </Button>
            <Button className={portal.button} disabled={handoff.isPending} onClick={() => handoff.mutate()}>
              Talk to my coordinator
            </Button>
          </div>
        </Card>
      )}
      {t && !t.can_reply && (
        <MessageBar>
          <MessageBarBody>This conversation is closed. Ask a new question from Onboarding help.</MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}
