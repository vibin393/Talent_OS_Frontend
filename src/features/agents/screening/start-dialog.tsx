"use client";

import {
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Spinner,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { newIdempotencyKey, screeningAgentApi, screeningAgentKeys } from "./api";
import { blockedText, START_CHANNEL_LABELS, START_CHANNEL_ORDER, startErrorText } from "./logic";
import type { StartChannel, StartOptionsOut } from "./types";

const useStyles = makeStyles({
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  option: { display: "flex", flexDirection: "column" },
  reason: { color: tokens.colorNeutralForeground3, paddingInlineStart: "32px", marginTop: `-${tokens.spacingVerticalXS}` },
  questionnaire: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
});

/** Availability of each dialog choice; "Best available" needs at least one reachable channel. */
export function channelChoices(options: StartOptionsOut | undefined): { channel: StartChannel; label: string; disabled: boolean; reason: string | null }[] {
  return START_CHANNEL_ORDER.map((channel) => {
    if (channel === "auto") {
      const any = !!options?.best_channel || !!options?.channels.some((c) => c.available);
      return { channel, label: START_CHANNEL_LABELS.auto, disabled: !any, reason: any ? null : "No channel to reach this candidate" };
    }
    const opt = options?.channels.find((c) => c.channel === channel);
    return {
      channel,
      label: START_CHANNEL_LABELS[channel],
      disabled: !opt?.available,
      reason: opt && !opt.available ? (opt.reason ?? "Not available") : opt ? null : "Not available",
    };
  });
}

/** "Start AI screening" dialog (Epic 57 Part C). */
export function StartScreeningDialog({ applicationId, open, onClose }: { applicationId: string; open: boolean; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<StartChannel>("auto");
  const [error, setError] = useState<string | null>(null);
  // One key per dialog opening: a double click or a retry after a network error starts only one conversation.
  const idempotencyKey = useMemo(() => (open ? newIdempotencyKey() : ""), [open]);
  const options = useQuery({
    queryKey: screeningAgentKeys.startOptions(applicationId),
    queryFn: ({ signal }) => screeningAgentApi.startOptions(applicationId, signal),
    enabled: open,
    staleTime: 0,
  });
  const choices = channelChoices(options.data);
  const blocked = blockedText(options.data?.blocked_reason);
  const selectedDisabled = choices.find((c) => c.channel === channel)?.disabled ?? true;
  const start = useMutation({
    mutationFn: () => screeningAgentApi.start(applicationId, channel, idempotencyKey),
    onSuccess: async () => {
      toast.success("AI screening started.");
      await queryClient.invalidateQueries({ queryKey: screeningAgentKeys.conversations(applicationId) });
      onClose();
    },
    onError: (e) => setError(startErrorText(e)),
  });

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && !start.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Start AI screening</DialogTitle>
          <DialogContent className={styles.content}>
            {options.isPending ? (
              <GridSkeleton rows={4} />
            ) : options.isError ? (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(options.error)}</MessageBarBody>
              </MessageBar>
            ) : (
              <>
                {blocked && (
                  <MessageBar intent="warning">
                    <MessageBarBody>{blocked}</MessageBarBody>
                  </MessageBar>
                )}
                <Field label="Channel">
                  <RadioGroup value={channel} onChange={(_, d) => setChannel(d.value as StartChannel)}>
                    {choices.map((c) => (
                      <div key={c.channel} className={styles.option}>
                        <Radio value={c.channel} label={c.label} disabled={c.disabled} aria-describedby={c.reason ? `start-reason-${c.channel}` : undefined} />
                        {c.reason && (
                          <Caption1 id={`start-reason-${c.channel}`} className={styles.reason}>
                            {c.reason}
                          </Caption1>
                        )}
                      </div>
                    ))}
                  </RadioGroup>
                </Field>
                <div className={styles.questionnaire}>
                  <Text>
                    Questionnaire: {options.data.questionnaire_name ?? "Default"}
                    {options.data.version != null ? ` v${options.data.version}` : ""}
                  </Text>
                  <AppLink href="/admin/pipeline?tab=questionnaires">Change</AppLink>
                </div>
                <MessageBar intent="info" layout="multiline">
                  <MessageBarBody>The candidate will be told they are chatting with an AI assistant acting for you.</MessageBarBody>
                </MessageBar>
              </>
            )}
            <div aria-live="assertive" role="alert">
              {error && (
                <MessageBar intent="error">
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={start.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!options.data || !!blocked || selectedDisabled || start.isPending}
              icon={start.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => {
                setError(null);
                start.mutate();
              }}
            >
              Start
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
