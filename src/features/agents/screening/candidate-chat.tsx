"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle1,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Person20Regular, Send20Regular, Sparkle16Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { MarkdownView } from "@/features/privacy/markdown-view";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { CandidateChatSource } from "./api";
import { CHAT_LOG_A11Y, candidateChatState, lastSeq, MAX_MESSAGE, mergeSnapshot, POLL_MS } from "./logic";
import type { PortalChatTurn, PortalScreeningChat } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, width: "100%", maxWidth: "760px", minWidth: 0 },
  header: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, minWidth: 0 },
  title: { margin: 0, overflowWrap: "anywhere" },
  muted: { color: tokens.colorNeutralForeground3 },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM, "@media (max-width: 480px)": { padding: tokens.spacingHorizontalM } },
  log: {
    listStyleType: "none",
    margin: 0,
    padding: tokens.spacingHorizontalM,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    maxHeight: "60vh",
    minHeight: "160px",
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
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusXLarge,
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  },
  theirs: { alignSelf: "flex-start", backgroundColor: tokens.colorNeutralBackground1, border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
  mine: { alignSelf: "flex-end", backgroundColor: tokens.colorBrandBackground2, color: tokens.colorNeutralForeground1 },
  author: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalXXS, color: tokens.colorNeutralForeground3 },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    alignItems: "center",
    "& button": { minHeight: "44px" },
    "@media (max-width: 480px)": { flexDirection: "column", alignItems: "stretch", "& button": { width: "100%" } },
  },
  composer: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  empty: { color: tokens.colorNeutralForeground3, textAlign: "center", padding: tokens.spacingVerticalL },
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
});

export type ChatBusy = "consent" | "send" | "handoff" | null;

function authorLabel(turn: PortalChatTurn, recruiter: string): string {
  if (turn.author === "you") return "You";
  if (turn.author === "recruiter") return recruiter;
  return "AI assistant";
}

function sentAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Presentational candidate chat (portal and secure link): header, disclosure/consent, log, composer, stop button. */
export function CandidateChatView({
  chat,
  busy = null,
  error = null,
  onConsent,
  onSend,
  onHandoff,
}: {
  chat: PortalScreeningChat;
  busy?: ChatBusy;
  error?: string | null;
  onConsent: (decision: "agree" | "decline") => void;
  onSend: (body: string) => Promise<boolean>;
  onHandoff: () => void;
}) {
  const styles = useStyles();
  const state = candidateChatState(chat);
  const [draft, setDraft] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const logRef = useRef<HTMLOListElement>(null);
  const answerId = useId();
  const last = lastSeq(chat.turns);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last]);

  const send = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    if (await onSend(body)) setDraft("");
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Subtitle1 as="h1" className={styles.title}>
          {chat.recruiter_name} · AI assistant
        </Subtitle1>
        <Caption1 className={styles.muted}>{chat.title}</Caption1>
      </div>

      {state.showConsent && (
        <Card className={styles.card} aria-labelledby={`${answerId}-consent`}>
          <Text id={`${answerId}-consent`} weight="semibold">
            You are chatting with an AI assistant acting for {chat.recruiter_name}.
          </Text>
          <Body1>
            It will ask a few questions about this role and can answer questions about the job. You can ask for a person at any time.
            Do you agree to continue with the AI assistant?
          </Body1>
          <div className={styles.actions}>
            <Button appearance="primary" disabled={busy !== null} icon={busy === "consent" ? <Spinner size="tiny" /> : undefined} onClick={() => onConsent("agree")}>
              I agree
            </Button>
            <Button disabled={busy !== null} onClick={() => onConsent("decline")}>
              No thanks
            </Button>
            {chat.notice && (
              <Button appearance="transparent" onClick={() => setNoticeOpen(true)}>
                How we use AI
              </Button>
            )}
          </div>
        </Card>
      )}

      <ol ref={logRef} className={styles.log} {...CHAT_LOG_A11Y} aria-label="Chat messages" tabIndex={0}>
        {chat.turns.length === 0 ? (
          <li className={styles.empty}>No messages yet.</li>
        ) : (
          chat.turns.map((t) => (
            <li key={t.seq} className={mergeClasses(styles.bubble, t.author === "you" ? styles.mine : styles.theirs)}>
              <Caption1 className={styles.author}>
                {t.author === "assistant" ? <Sparkle16Regular aria-hidden /> : t.author === "recruiter" ? <Person20Regular aria-hidden /> : null}
                <span>{authorLabel(t, chat.recruiter_name)}</span>
                <span aria-hidden>·</span>
                <time dateTime={t.sent_at}>{sentAt(t.sent_at)}</time>
              </Caption1>
              <Body1>{t.body}</Body1>
            </li>
          ))
        )}
      </ol>

      <div aria-live="assertive" role="alert">
        {error && (
          <MessageBar intent="error" layout="multiline">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}
      </div>

      {state.ended ? (
        <MessageBar intent="info" layout="multiline">
          <MessageBarBody>This chat has ended. {chat.recruiter_name} will follow up.</MessageBarBody>
        </MessageBar>
      ) : (
        <div className={styles.composer}>
          {state.canType && (
            <Field label="Your answer" hint={`${draft.length}/${MAX_MESSAGE}`}>
              <Textarea
                id={`${answerId}-answer`}
                value={draft}
                resize="vertical"
                maxLength={MAX_MESSAGE}
                disabled={busy === "send"}
                onChange={(_, d) => setDraft(d.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
            </Field>
          )}
          {!state.canType && !state.showConsent && chat.status === "paused" && (
            <Caption1 className={styles.muted}>The conversation is paused. You will get a message when it continues.</Caption1>
          )}
          <div className={styles.actions}>
            {state.canType && (
              <Button appearance="primary" icon={busy === "send" ? <Spinner size="tiny" /> : <Send20Regular />} disabled={!draft.trim() || busy !== null} onClick={() => void send()}>
                Send
              </Button>
            )}
            {state.showStop && (
              <Button icon={busy === "handoff" ? <Spinner size="tiny" /> : <Person20Regular />} disabled={busy !== null} onClick={onHandoff}>
                Talk to a person
              </Button>
            )}
          </div>
        </div>
      )}

      {chat.notice && (
        <Dialog open={noticeOpen} onOpenChange={(_, d) => setNoticeOpen(d.open)}>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>{chat.notice.title}</DialogTitle>
              <DialogContent>
                <MarkdownView source={chat.notice.body_md} />
              </DialogContent>
              <DialogActions>
                <Button appearance="primary" onClick={() => setNoticeOpen(false)}>
                  Close
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </div>
  );
}

function chatError(e: unknown): string {
  if (isApiError(e) && e.status === 429) return "You are sending messages too quickly. Wait a moment and try again.";
  if (isApiError(e) && (e.status === 404 || e.status === 410)) return "This chat is no longer available.";
  return errorMessage(e);
}

/**
 * Candidate chat over a transport (portal or secure link): polls every 5 s with `after_seq` and merges turns by seq.
 * `renderLoading` / `renderError` let each surface keep its own chrome.
 */
export function CandidateChat({
  source,
  renderLoading,
  renderError,
}: {
  source: CandidateChatSource;
  renderLoading: () => React.ReactNode;
  renderError: (error: unknown, retry: () => void) => React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: source.key,
    queryFn: async ({ signal }) => {
      const previous = queryClient.getQueryData<PortalScreeningChat>(source.key);
      const next = await source.get(lastSeq(previous?.turns), signal);
      return mergeSnapshot(previous, next);
    },
    refetchInterval: (q) => (q.state.data?.status === "ended" ? false : POLL_MS),
    retry: (count, e) => count < 1 && (!isApiError(e) || e.status === 0 || e.status >= 500),
  });
  const apply = (next: PortalScreeningChat) => {
    setError(null);
    queryClient.setQueryData<PortalScreeningChat>(source.key, (prev) => mergeSnapshot(prev, next));
  };
  const consent = useMutation({
    mutationFn: (decision: "agree" | "decline") => source.consent({ decision, notice_id: query.data?.notice?.notice_id ?? null }),
    onSuccess: apply,
    onError: (e) => setError(chatError(e)),
  });
  const send = useMutation({ mutationFn: source.send, onSuccess: apply, onError: (e) => setError(chatError(e)) });
  const handoff = useMutation({ mutationFn: source.handoff, onSuccess: apply, onError: (e) => setError(chatError(e)) });

  if (query.isPending) return <>{renderLoading()}</>;
  if (query.isError) return <>{renderError(query.error, () => void query.refetch())}</>;
  const busy: ChatBusy = consent.isPending ? "consent" : send.isPending ? "send" : handoff.isPending ? "handoff" : null;
  return (
    <CandidateChatView
      chat={query.data}
      busy={busy}
      error={error}
      onConsent={(d) => consent.mutate(d)}
      onSend={async (body) => {
        try {
          await send.mutateAsync(body);
          return true;
        } catch {
          return false;
        }
      }}
      onHandoff={() => handoff.mutate()}
    />
  );
}
