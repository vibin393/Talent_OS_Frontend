"use client";

import {
  Button,
  Card,
  Link,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  Text,
  Textarea,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Send20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { AnalyticsAnswerCard } from "./analytics-answer-card";
import { analyticsApi, analyticsKeys, copilotApi } from "./api";
import { LABELS, STARTER_QUESTIONS, answersForRun, askAvailability } from "./logic";
import type { ConversationMessage } from "./types";

const useStyles = makeStyles({
  layout: { display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", gap: tokens.spacingHorizontalL, alignItems: "start" },
  history: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, padding: tokens.spacingHorizontalS },
  historyItem: { justifyContent: "flex-start", textAlign: "left", width: "100%" },
  selected: { backgroundColor: tokens.colorNeutralBackground1Selected },
  main: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, minWidth: 0 },
  thread: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  user: { alignSelf: "flex-end", maxWidth: "80%", padding: tokens.spacingHorizontalM, borderRadius: tokens.borderRadiusLarge, backgroundColor: tokens.colorBrandBackground2 },
  assistant: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, maxWidth: "100%" },
  starters: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  composer: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-end" },
  grow: { flex: "1 1 auto" },
  muted: { color: tokens.colorNeutralForeground3 },
});

function Unavailable({ text }: { text: string }) {
  return (
    <MessageBar intent="info" layout="multiline">
      <MessageBarBody>
        {text}{" "}
        <Link href="/reports/custom/new">{LABELS.buildInstead}</Link>
      </MessageBarBody>
    </MessageBar>
  );
}

function AssistantTurn({ message, answerIds }: { message: ConversationMessage; answerIds: string[] }) {
  const styles = useStyles();
  return (
    <div className={styles.assistant}>
      {message.content.text && <Text>{String(message.content.text)}</Text>}
      {answerIds.map((id) => (
        <AnalyticsAnswerCard key={id} answerId={id} />
      ))}
    </div>
  );
}

/** `/reports/ask` (Epic 64.1): an analytics-mode Copilot conversation (agent `analytics`) with a History list. Uses the
 *  Epic 54 Copilot endpoints directly, so the page works whatever the state of the Copilot panel. */
export function AskPage() {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const canUse = usePermission("copilot:use");
  const status = useQuery({ queryKey: analyticsKeys.copilotStatus(), queryFn: ({ signal }) => copilotApi.status(signal), enabled: canUse, retry: false });
  const availability = askAvailability(canUse, status.data, !!status.error);
  const conversations = useQuery({ queryKey: analyticsKeys.conversations(), queryFn: ({ signal }) => copilotApi.conversations(signal), enabled: availability === "ok" });
  const history = (conversations.data?.items ?? []).filter((c) => c.agent_key === "analytics");
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingRun, setPendingRun] = useState<string | null>(null);
  const [text, setText] = useState("");

  const messages = useQuery({
    queryKey: analyticsKeys.messages(selected ?? ""),
    queryFn: ({ signal }) => copilotApi.messages(selected as string, signal),
    enabled: !!selected && availability === "ok",
    refetchInterval: (q) => (pendingRun && !(q.state.data ?? []).some((m) => m.role === "assistant" && m.run_id === pendingRun) ? 1500 : false),
  });
  const assistantTurns = (messages.data ?? []).filter((m) => m.role === "assistant").length;
  const waiting = !!pendingRun && !(messages.data ?? []).some((m) => m.role === "assistant" && m.run_id === pendingRun);
  const answers = useQuery({
    // re-read the answers whenever a new assistant turn arrives
    queryKey: [...analyticsKeys.byConversation(selected ?? ""), assistantTurns],
    queryFn: ({ signal }) => analyticsApi.list(selected as string, signal),
    enabled: !!selected && availability === "ok",
  });

  const send = useMutation({
    mutationFn: async (question: string) => {
      let id = selected;
      if (!id) {
        id = (await copilotApi.create()).id;
        setSelected(id);
      }
      return { id, turn: await copilotApi.send(id, question) };
    },
    onSuccess: async ({ id, turn }) => {
      setText("");
      setPendingRun(turn.run_id);
      await queryClient.invalidateQueries({ queryKey: analyticsKeys.messages(id) });
      await queryClient.invalidateQueries({ queryKey: analyticsKeys.conversations() });
    },
  });

  const header = <PageHeader title={LABELS.pageTitle} subtitle={LABELS.pageSubtitle} />;
  if (availability === "no_access") return (<>{header}<Unavailable text={LABELS.noAccess} /></>);
  if (availability === "off") return (<>{header}<Unavailable text={LABELS.turnedOff} /></>);
  if (availability === "loading") return (<>{header}<Spinner label="Loading" /></>);

  const ask = (q: string) => {
    const trimmed = q.trim();
    if (trimmed && !send.isPending) send.mutate(trimmed);
  };
  const thread = messages.data ?? [];
  const allAnswers = answers.data?.items ?? [];

  return (
    <>
      {header}
      <div className={styles.layout}>
        <Card className={styles.history}>
          <Subtitle2>{LABELS.history}</Subtitle2>
          <Button icon={<Add20Regular />} appearance="subtle" className={styles.historyItem} onClick={() => setSelected(null)}>
            {LABELS.newQuestion}
          </Button>
          {history.length === 0 && <Text className={styles.muted}>No questions yet.</Text>}
          {history.map((c) => (
            <Button key={c.id} appearance="subtle" className={mergeClasses(styles.historyItem, c.id === selected && styles.selected)} onClick={() => setSelected(c.id)}>
              {c.title ?? "Untitled question"}
            </Button>
          ))}
        </Card>
        <div className={styles.main}>
          {!selected && (
            <div className={styles.starters}>
              {STARTER_QUESTIONS.map((q) => (
                <Button key={q} shape="circular" onClick={() => ask(q)} disabled={send.isPending}>
                  {q}
                </Button>
              ))}
            </div>
          )}
          <div className={styles.thread} aria-live="polite">
            {thread.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className={styles.user}>
                  <Text>{m.redacted ? "Redacted" : String(m.content.text ?? "")}</Text>
                </div>
              ) : m.role === "assistant" ? (
                <AssistantTurn key={m.id} message={m} answerIds={answersForRun(allAnswers, m.run_id).map((a) => a.id)} />
              ) : null,
            )}
            {waiting && <Spinner size="tiny" label="Working on your answer" />}
          </div>
          {send.error && (
            <MessageBar intent="error">
              <MessageBarBody>{errorMessage(send.error)}</MessageBarBody>
            </MessageBar>
          )}
          <div className={styles.composer}>
            <Textarea
              className={styles.grow}
              aria-label="Question"
              placeholder={LABELS.composer}
              value={text}
              maxLength={4000}
              resize="vertical"
              onChange={(_, d) => setText(d.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(text);
                }
              }}
            />
            <Button appearance="primary" icon={<Send20Regular />} disabled={!text.trim() || send.isPending || waiting} onClick={() => ask(text)}>
              Ask
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
