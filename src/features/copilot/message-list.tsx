"use client";

/**
 * Copilot conversation log (Epic 54 B2): `role="log"` + polite live region. Streamed text is announced per completed
 * sentence through a throttled mirror region (screen readers are not flooded with word deltas).
 */
import { Body1, Caption1, makeStyles, tokens } from "@fluentui/react-components";
import { useEffect, useRef, useState } from "react";
import { type AssistantView, AssistantMessage } from "./assistant-message";
import { completedSentences } from "./markdown";
import { type CopilotMessage, isAssistant, isEvent, isRedacted, type UserContent } from "./types";

const useStyles = makeStyles({
  log: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  user: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusLarge,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  event: { alignSelf: "center", color: tokens.colorNeutralForeground3, textAlign: "center" },
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
});

export function viewOf(msg: CopilotMessage): AssistantView | null {
  const c = msg.content;
  if (!isAssistant(c)) return null;
  return {
    text: c.text,
    status: c.status,
    reasonCode: c.reason_code ?? null,
    refs: c.refs,
    tools: c.tools,
    drafts: c.drafts.map((id) => ({ proposal_id: id, tool_key: "", title: "" })),
    cards: c.cards ?? [],
    runId: msg.run_id,
    streaming: false,
  };
}

export function MessageList({
  messages,
  live,
  allowComments,
}: {
  messages: CopilotMessage[];
  live: AssistantView | null;
  allowComments: boolean;
}) {
  const styles = useStyles();
  const [announced, setAnnounced] = useState("");
  const lastAnnounce = useRef(0);
  const liveText = live?.text ?? "";
  useEffect(() => {
    const sentences = completedSentences(liveText);
    const now = Date.now();
    if (sentences && sentences !== announced && now - lastAnnounce.current > 1500) {
      lastAnnounce.current = now;
      setAnnounced(sentences.slice(-600));
    }
  }, [liveText, announced]);

  return (
    <>
      <div className={styles.log} role="log" aria-live="polite" aria-relevant="additions" aria-label="Copilot conversation">
        {messages.map((m) => {
          if (isRedacted(m.content) || m.redacted) {
            return (
              <Caption1 key={m.id} className={styles.event}>
                This part of the conversation was removed.
              </Caption1>
            );
          }
          if (m.role === "user") {
            return (
              <Body1 key={m.id} className={styles.user}>
                {(m.content as UserContent).text}
              </Body1>
            );
          }
          if (m.role === "event" && isEvent(m.content)) {
            return (
              <Caption1 key={m.id} className={styles.event}>
                {m.content.message}
              </Caption1>
            );
          }
          const view = viewOf(m);
          return view ? <AssistantMessage key={m.id} view={view} allowComments={allowComments} /> : null;
        })}
      </div>
      {live ? (
        <div aria-live="off" aria-busy={live.streaming}>
          <AssistantMessage view={live} allowComments={allowComments} />
        </div>
      ) : null}
      <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announced}
      </div>
    </>
  );
}
