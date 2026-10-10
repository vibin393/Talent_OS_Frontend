"use client";

/**
 * A Copilot conversation (Epic 54 B2/B3/B6): messages, the live streamed answer, the empty state with starters and the
 * composer. Shared by the side panel and the full page.
 */
import { Body1, Button, makeStyles, MessageBar, MessageBarBody, Subtitle1, tokens } from "@fluentui/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { forwardRef, useMemo, useState } from "react";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { copilotApi, copilotKeys, useMessages } from "./api";
import type { AssistantView } from "./assistant-message";
import { Composer } from "./composer";
import { COPY, rateLimitMessage, STARTERS } from "./copy";
import { MessageList } from "./message-list";
import type { CopilotStatus, PageContext } from "./types";
import { type StreamTarget, useCopilotStream } from "./use-copilot-stream";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", minHeight: 0, flex: 1, gap: tokens.spacingVerticalM },
  scroll: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, paddingBlock: tokens.spacingVerticalS },
  empty: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, paddingBlock: tokens.spacingVerticalL },
  starters: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: tokens.spacingVerticalXS },
  starter: { textAlign: "start", height: "auto", whiteSpace: "normal" },
  footer: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

export interface ConversationViewProps {
  conversationId: string | null;
  mode: string;
  pageContext: PageContext | null;
  status: CopilotStatus;
  onConversation: (id: string) => void;
}

export const ConversationView = forwardRef<HTMLTextAreaElement, ConversationViewProps>(function ConversationView(
  { conversationId, mode, pageContext, status, onConversation },
  composerRef,
) {
  const styles = useStyles();
  const qc = useQueryClient();
  const messages = useMessages(conversationId);
  const [target, setTarget] = useState<StreamTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const finish = () => {
    if (target) void qc.invalidateQueries({ queryKey: copilotKeys.messages(target.conversationId) });
    void qc.invalidateQueries({ queryKey: copilotKeys.status });
    void qc.invalidateQueries({ queryKey: copilotKeys.conversations() });
    setTarget(null);
  };
  const stream = useCopilotStream(target, { onDone: finish });

  const ask = useMutation({
    mutationFn: async (text: string) => {
      let id = conversationId;
      if (!id) {
        const conv = await copilotApi.createConversation({ agent_key: mode, page_context: pageContext });
        id = conv.id;
        onConversation(id);
      }
      const turn = await copilotApi.ask(id, text, pageContext);
      return { id, turn };
    },
    onMutate: () => setNotice(null),
    onSuccess: ({ id, turn }) => {
      void qc.invalidateQueries({ queryKey: copilotKeys.messages(id) });
      if (turn.run_id && turn.stream_url) {
        setTarget({ runId: turn.run_id, streamUrl: turn.stream_url, conversationId: id, afterSeq: turn.message.seq });
      }
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "copilot_rate_limited") {
        setNotice(rateLimitMessage(Number(e.details.limit ?? status.questions_per_hour), Number(e.details.retry_after_s ?? 3600)));
      } else if (isApiError(e) && e.code === "copilot_unavailable") {
        void qc.invalidateQueries({ queryKey: copilotKeys.status });
      } else {
        setNotice(errorMessage(e));
      }
    },
  });

  const live: AssistantView | null = useMemo(
    () =>
      target
        ? {
            text: stream.text,
            status: stream.status,
            reasonCode: stream.reasonCode,
            refs: [],
            tools: stream.tools,
            drafts: stream.drafts,
            cards: [],
            runId: target.runId,
            streaming: !stream.done,
          }
        : null,
    [target, stream],
  );
  const streaming = ask.isPending || (target !== null && !stream.done);
  const items = messages.data ?? [];
  const recordPage = Boolean(pageContext?.entity_id);
  const candidatePage = pageContext?.entity_type === "candidate";

  return (
    <div className={styles.root}>
      <div className={styles.scroll}>
        {items.length === 0 && !live ? (
          <div className={styles.empty}>
            <Subtitle1 as="h2">{COPY.emptyTitle}</Subtitle1>
            <Body1>{COPY.emptyText}</Body1>
            <div className={styles.starters}>
              {[STARTERS.sla, STARTERS.followUp, ...(recordPage && candidatePage ? [STARTERS.summarise] : []), STARTERS.task].map((s) => (
                <Button key={s} appearance="subtle" className={styles.starter} disabled={streaming} onClick={() => ask.mutate(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <MessageList messages={items} live={live} allowComments={status.allow_feedback_comments} />
        )}
        {messages.isError ? (
          <MessageBar intent="error">
            <MessageBarBody>{errorMessage(messages.error)}</MessageBarBody>
          </MessageBar>
        ) : null}
      </div>
      {notice ? (
        <MessageBar intent="warning">
          <MessageBarBody>{notice}</MessageBarBody>
        </MessageBar>
      ) : null}
      <Composer
        ref={composerRef}
        streaming={streaming}
        onSend={(text) => ask.mutate(text)}
        onStop={() => {
          if (target) void copilotApi.cancel(target.runId).catch(() => undefined);
        }}
      />
      <span className={styles.footer}>{COPY.footer}</span>
    </div>
  );
});
