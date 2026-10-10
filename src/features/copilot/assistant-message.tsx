"use client";

/** One Copilot answer (Epic 54 B3): AI badge, safe Markdown, tool chips, draft cards, registered cards, feedback. */
import {
  Button,
  Caption1Strong,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Textarea,
  ToggleButton,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { Copy20Regular, ThumbDislike20Regular, ThumbLike20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { errorMessage } from "@/lib/api/errors";
import { AnswerMarkdown } from "./answer-markdown";
import { copilotApi } from "./api";
import { copilotCard } from "./card-renderers";
import { COPY, turnMessage } from "./copy";
import { DraftCard } from "./draft-card";
import { ToolChips } from "./tool-chips";
import type { CardRef, ToolEntry, TurnStatus } from "./types";
import type { StreamDraft } from "./use-copilot-stream";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  who: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  actions: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXXS },
  popover: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, maxWidth: "320px" },
});

export interface AssistantView {
  text: string;
  status: TurnStatus | null;
  reasonCode: string | null;
  refs: [string, string][];
  tools: (ToolEntry & { pending?: boolean })[];
  drafts: StreamDraft[];
  cards: CardRef[];
  runId: string | null;
  streaming: boolean;
}

export function AssistantMessage({ view, allowComments }: { view: AssistantView; allowComments: boolean }) {
  const styles = useStyles();
  const [rating, setRating] = useState<"helpful" | "unhelpful" | null>(null);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const feedback = useMutation({
    mutationFn: (body: { rating: "helpful" | "unhelpful"; comment?: string | null }) =>
      copilotApi.feedback(view.runId as string, body),
    onSuccess: (out) => {
      setRating(out.rating);
      setOpen(false);
    },
  });
  const failure = turnMessage(view.status, view.reasonCode);
  const done = !view.streaming;
  return (
    <div className={styles.root}>
      <div className={styles.who}>
        <AiBadge agentName="Copilot" />
        <Caption1Strong>Copilot</Caption1Strong>
      </div>
      <ToolChips tools={view.tools} />
      {view.text ? <AnswerMarkdown text={view.text} refs={view.refs} /> : null}
      {failure ? (
        <MessageBar intent={view.status === "cancelled" ? "info" : "warning"}>
          <MessageBarBody>{failure}</MessageBarBody>
        </MessageBar>
      ) : null}
      {view.drafts.map((d) => (
        <DraftCard key={d.proposal_id} proposalId={d.proposal_id} title={d.title} />
      ))}
      {view.cards.map((c) => {
        const Card = copilotCard(c.kind);
        return Card ? <Card key={`${c.kind}:${c.id}`} kind={c.kind} id={c.id} /> : null;
      })}
      {done && view.runId ? (
        <div className={styles.actions}>
          <Tooltip content={COPY.helpful} relationship="label">
            <ToggleButton
              size="small"
              appearance="subtle"
              icon={<ThumbLike20Regular />}
              checked={rating === "helpful"}
              aria-label={COPY.helpful}
              onClick={() => feedback.mutate({ rating: "helpful" })}
            />
          </Tooltip>
          <Popover open={open} onOpenChange={(_, d) => setOpen(d.open)} trapFocus>
            <PopoverTrigger disableButtonEnhancement>
              <Tooltip content={COPY.notHelpful} relationship="label">
                <ToggleButton size="small" appearance="subtle" icon={<ThumbDislike20Regular />} checked={rating === "unhelpful"} aria-label={COPY.notHelpful} />
              </Tooltip>
            </PopoverTrigger>
            <PopoverSurface>
              <div className={styles.popover}>
                {allowComments ? (
                  <Field label={COPY.tellUsMore} hint={COPY.feedbackHint}>
                    <Textarea value={comment} maxLength={1000} onChange={(_, d) => setComment(d.value)} />
                  </Field>
                ) : null}
                {feedback.isError ? (
                  <MessageBar intent="error">
                    <MessageBarBody>{errorMessage(feedback.error)}</MessageBarBody>
                  </MessageBar>
                ) : null}
                <Button
                  appearance="primary"
                  disabled={feedback.isPending}
                  onClick={() => feedback.mutate({ rating: "unhelpful", comment: allowComments ? comment.trim() || null : null })}
                >
                  {COPY.sendFeedback}
                </Button>
              </div>
            </PopoverSurface>
          </Popover>
          <Tooltip content={COPY.copy} relationship="label">
            <Button
              size="small"
              appearance="subtle"
              icon={<Copy20Regular />}
              aria-label={COPY.copy}
              onClick={() => void navigator.clipboard?.writeText(view.text)}
            />
          </Tooltip>
        </div>
      ) : null}
    </div>
  );
}
