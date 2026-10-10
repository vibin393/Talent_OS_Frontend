"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Pause20Regular, PersonArrowLeft20Regular, Play20Regular, Sparkle20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { usePermission } from "@/features/auth/use-permission";
import type { ApplicationPanelProps } from "@/features/pipeline/application-panels";
import { errorMessage } from "@/lib/api/errors";
import { AnswerReview } from "./answer-review";
import { screeningAgentApi, screeningAgentKeys } from "./api";
import { ConversationView, useConversation } from "./conversation-view";
import { availableActions, CHANNEL_LABELS, type ConversationAction, hasReview, isOpen, statusBadge } from "./logic";
import { StartScreeningDialog } from "./start-dialog";
import type { ConversationOut } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM, minWidth: 0 },
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  actions: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
  grow: { flex: 1 },
});

const ACTION_LABELS: Record<ConversationAction, string> = { pause: "Pause", resume: "Resume", "take-over": "Take over", cancel: "Cancel" };
const ACTION_DONE: Record<ConversationAction, string> = {
  pause: "Conversation paused.",
  resume: "Conversation resumed.",
  "take-over": "You took over the conversation.",
  cancel: "Conversation cancelled.",
};

/** Application drawer panel "AI screening" (registered as `agent_screening`). */
export function ConversationPanel({ applicationId }: ApplicationPanelProps) {
  const styles = useStyles();
  const canConduct = usePermission("screening:conduct");
  const [starting, setStarting] = useState(false);
  const list = useQuery({
    queryKey: screeningAgentKeys.conversations(applicationId),
    queryFn: ({ signal }) => screeningAgentApi.conversations(applicationId, signal),
  });
  const latest = list.data?.[0];
  const canStart = canConduct && (!latest || (!isOpen(latest.status) && latest.status !== "taken_over"));

  return (
    <Card className={styles.root} aria-labelledby="agent-screening-title">
      <div className={styles.head}>
        <Subtitle2 as="h3" id="agent-screening-title">
          AI screening
        </Subtitle2>
        <AiBadge agentName="Screening Agent" ownerName={latest?.owner_name} />
        {latest && <StatusBadge conversation={latest} />}
        <span className={styles.grow} />
        {canStart && (
          <Button appearance={latest ? "secondary" : "primary"} icon={<Sparkle20Regular />} onClick={() => setStarting(true)}>
            Start AI screening
          </Button>
        )}
      </div>
      {list.isPending ? (
        <GridSkeleton rows={3} />
      ) : list.isError ? (
        <ErrorBar title="Could not load AI screening." message={errorMessage(list.error)} />
      ) : !latest ? (
        <Body1 className={styles.muted}>No AI screening yet. The Screening Agent asks the approved questions and prepares the answers for your review.</Body1>
      ) : (
        <ConversationDetails key={latest.id} summary={latest} canConduct={canConduct} />
      )}
      {starting && <StartScreeningDialog applicationId={applicationId} open onClose={() => setStarting(false)} />}
    </Card>
  );
}

function StatusBadge({ conversation }: { conversation: Pick<ConversationOut, "status" | "last_outbound_at" | "consented_at"> }) {
  const b = statusBadge(conversation);
  return (
    <Badge appearance="tint" color={b.color}>
      {b.label}
    </Badge>
  );
}

function ConversationDetails({ summary, canConduct }: { summary: ConversationOut; canConduct: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [confirmTakeOver, setConfirmTakeOver] = useState(false);
  const detail = useConversation(summary.id, true);
  const c = detail.data ?? { ...summary, turns: [] };
  const actions = availableActions(c.status, canConduct);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: screeningAgentKeys.conversations(summary.application_id) }),
      queryClient.invalidateQueries({ queryKey: screeningAgentKeys.conversation(summary.id) }),
    ]);
  const act = useMutation({
    mutationFn: (action: ConversationAction) => screeningAgentApi.action(summary.id, action),
    onSuccess: async (_, action) => {
      toast.success(ACTION_DONE[action]);
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <div className={styles.actions}>
        <Text>
          {c.answered_count}/{c.required_count} answered
        </Text>
        <Caption1 className={styles.muted}>
          {c.human_id} · {CHANNEL_LABELS[c.channel] ?? c.channel}
          {c.questionnaire_label ? ` · ${c.questionnaire_label}` : ""}
        </Caption1>
        <span className={styles.grow} />
        {actions.includes("pause") && (
          <Button icon={<Pause20Regular />} disabled={act.isPending} onClick={() => act.mutate("pause")}>
            {ACTION_LABELS.pause}
          </Button>
        )}
        {actions.includes("resume") && (
          <Button icon={<Play20Regular />} disabled={act.isPending} onClick={() => act.mutate("resume")}>
            {ACTION_LABELS.resume}
          </Button>
        )}
        {actions.includes("take-over") && (
          <Button icon={<PersonArrowLeft20Regular />} disabled={act.isPending} onClick={() => setConfirmTakeOver(true)}>
            {ACTION_LABELS["take-over"]}
          </Button>
        )}
        {actions.includes("cancel") && (
          <Button appearance="subtle" disabled={act.isPending} onClick={() => act.mutate("cancel")}>
            {ACTION_LABELS.cancel}
          </Button>
        )}
        {c.current_run_id && <AppLink href={`/ai/runs/${c.current_run_id}`}>View run</AppLink>}
      </div>
      {c.status === "consent_refused" && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>The candidate declined AI screening. Start manual screening below.</MessageBarBody>
        </MessageBar>
      )}
      {c.status === "handed_off" && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>The conversation was handed to you{c.handoff_reason ? ` (${c.handoff_reason.replace(/_/g, " ")})` : ""}. A task was created.</MessageBarBody>
        </MessageBar>
      )}
      {detail.isError ? (
        <ErrorBar title="Could not load the conversation." message={errorMessage(detail.error)} />
      ) : detail.isPending ? (
        <GridSkeleton rows={3} />
      ) : (
        <ConversationView conversation={c} canConduct={canConduct} userName={me?.user.name ?? "you"} />
      )}
      {hasReview(c.status) && canConduct && <AnswerReview conversationId={c.id} onCompleted={() => void refresh()} />}
      <ConfirmDialog
        open={confirmTakeOver}
        title="Take over"
        confirmLabel="Take over"
        onConfirm={() => act.mutateAsync("take-over")}
        onClose={() => setConfirmTakeOver(false)}
      >
        Take over this conversation? The AI assistant stops and your messages are sent as you.
      </ConfirmDialog>
    </>
  );
}
