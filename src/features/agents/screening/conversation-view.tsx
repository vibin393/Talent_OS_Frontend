"use client";

import {
  Body1,
  Button,
  Caption1,
  Field,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Spinner,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Send20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { useAppToast } from "@/components/toast";
import { formatDateTime } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { screeningAgentApi, screeningAgentKeys } from "./api";
import { canRecruiterMessage, CHAT_LOG_A11Y, citationSources, isOpen, lastSeq, MAX_MESSAGE, mergeSnapshot, mergeTurns, POLL_MS, whatsappWindowClosed } from "./logic";
import type { ConversationDetailOut, TurnOut } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, minWidth: 0 },
  log: {
    listStyleType: "none",
    margin: 0,
    padding: tokens.spacingHorizontalS,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    maxHeight: "420px",
    overflowY: "auto",
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}` },
  },
  bubble: {
    maxWidth: "85%",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusLarge,
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  },
  assistant: { alignSelf: "flex-start", backgroundColor: tokens.colorNeutralBackground1, border: `${tokens.strokeWidthThin} solid ${tokens.colorBrandStroke2}` },
  candidate: { alignSelf: "flex-end", backgroundColor: tokens.colorNeutralBackground1, border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  recruiter: { alignSelf: "flex-start", backgroundColor: tokens.colorBrandBackground2 },
  system: { alignSelf: "center", maxWidth: "100%", textAlign: "center", color: tokens.colorNeutralForeground3, backgroundColor: "transparent" },
  meta: { display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: tokens.spacingHorizontalXS, color: tokens.colorNeutralForeground3 },
  source: { color: tokens.colorNeutralForeground3 },
  composer: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  actions: { display: "flex", justifyContent: "flex-end" },
});

const AUTHOR_LABELS: Record<TurnOut["author"], string> = { agent: "AI assistant", candidate: "Candidate", recruiter: "Recruiter", system: "System" };

/** Recruiter-side transcript: bubbles per author; grounded answers show their sources. */
export function ConversationTranscript({ turns, ownerName }: { turns: readonly TurnOut[]; ownerName?: string | null }) {
  const styles = useStyles();
  const ref = useRef<HTMLOListElement>(null);
  const last = lastSeq(turns);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last]);
  return (
    <ol ref={ref} className={styles.log} {...CHAT_LOG_A11Y} aria-label="Conversation" tabIndex={0}>
      {turns.length === 0 && (
        <li className={mergeClasses(styles.bubble, styles.system)}>
          <Caption1>No messages yet.</Caption1>
        </li>
      )}
      {turns.map((t) => {
        const sources = t.kind === "grounded_answer" ? citationSources(t.citations) : [];
        return (
          <li key={t.seq} id={`screening-turn-${t.seq}`} className={mergeClasses(styles.bubble, styles[t.author === "agent" ? "assistant" : t.author])}>
            <Caption1 className={styles.meta}>
              <span>{t.author === "recruiter" && ownerName ? ownerName : AUTHOR_LABELS[t.author]}</span>
              {t.author === "agent" && <AiBadge agentName="Screening Agent" ownerName={ownerName} />}
              <span aria-hidden>·</span>
              <time dateTime={t.created_at}>{formatDateTime(t.created_at)}</time>
              <span aria-hidden>·</span>
              <span>#{t.seq}</span>
            </Caption1>
            <Body1>{t.body}</Body1>
            {sources.length > 0 && <Caption1 className={styles.source}>Source: {sources.join(", ")}</Caption1>}
          </li>
        );
      })}
    </ol>
  );
}

/** Live conversation (polls every 5 s while it can still change; `after_seq` pages are merged by seq). */
export function useConversation(id: string, live: boolean) {
  const queryClient = useQueryClient();
  const key = screeningAgentKeys.conversation(id);
  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const previous = queryClient.getQueryData<ConversationDetailOut>(key);
      const next = await screeningAgentApi.conversation(id, lastSeq(previous?.turns), signal);
      return mergeSnapshot(previous, next);
    },
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return live && (!status || isOpen(status) || status === "taken_over") ? POLL_MS : false;
    },
  });
}

/** Transcript plus the recruiter composer (only after "Take over"). */
export function ConversationView({
  conversation,
  canConduct,
  userName,
}: {
  conversation: ConversationDetailOut;
  canConduct: boolean;
  userName: string;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const windowClosed = whatsappWindowClosed(conversation);
  const send = useMutation({
    mutationFn: (body: string) => screeningAgentApi.sendMessage(conversation.id, body),
    onSuccess: (turn) => {
      setDraft("");
      queryClient.setQueryData<ConversationDetailOut>(screeningAgentKeys.conversation(conversation.id), (prev) =>
        prev ? { ...prev, turns: mergeTurns(prev.turns, [turn]) } : prev,
      );
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className={styles.root}>
      <ConversationTranscript turns={conversation.turns} ownerName={conversation.owner_name} />
      {canRecruiterMessage(conversation, canConduct) && (
        <div className={styles.composer}>
          {windowClosed ? (
            <MessageBar intent="warning">
              <MessageBarBody>WhatsApp only allows template messages now</MessageBarBody>
            </MessageBar>
          ) : (
            <>
              <Field label={`Message as ${userName}`}>
                <Textarea value={draft} maxLength={MAX_MESSAGE} resize="vertical" onChange={(_, d) => setDraft(d.value)} />
              </Field>
              <div className={styles.actions}>
                <Button
                  appearance="primary"
                  icon={send.isPending ? <Spinner size="tiny" /> : <Send20Regular />}
                  disabled={!draft.trim() || send.isPending}
                  onClick={() => send.mutate(draft.trim())}
                >
                  Send
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
