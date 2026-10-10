"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  SpinButton,
  Spinner,
  Text,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Sparkle20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAppToast } from "@/components/toast";
import { useMe } from "@/features/auth/use-me";
import { PeoplePicker } from "@/features/interviews/pickers";
import type { Person } from "@/features/interviews/schedule-form";
import { errorMessage } from "@/lib/api/errors";
import { newIdempotencyKey, schedulingApi, schedulingKeys } from "./api";
import { MODE_LABELS } from "./logic";
import type { InterviewMode } from "./types";

const useStyles = makeStyles({
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

/** "Let the agent schedule" next to "Schedule" on a stage of the Application's Interviews tab. */
export function LetAgentScheduleButton({ applicationId, stageId, stageName }: { applicationId: string; stageId: string; stageName: string }) {
  const [open, setOpen] = useState(false);
  const options = useQuery({
    queryKey: schedulingKeys.options(applicationId, stageId),
    queryFn: ({ signal }) => schedulingApi.options(applicationId, stageId, signal),
    retry: false,
    staleTime: 30_000,
  });
  const off = !options.data?.agent_on;
  const button = (
    <Button size="small" icon={<Sparkle20Regular />} disabled={off} onClick={() => setOpen(true)}>
      Let the agent schedule
    </Button>
  );
  return (
    <>
      {off ? (
        <Tooltip content="The Scheduling Agent is off" relationship="description">
          <span>{button}</span>
        </Tooltip>
      ) : (
        button
      )}
      {open && <StartSchedulingDialog applicationId={applicationId} stageId={stageId} stageName={stageName} onClose={() => setOpen(false)} />}
    </>
  );
}

const MODES: InterviewMode[] = ["video", "phone", "in_person"];

/** Dialog "Let the agent schedule · {stage}" (Epic 59 Part C). */
export function StartSchedulingDialog({
  applicationId,
  stageId,
  stageName,
  onClose,
}: {
  applicationId: string;
  stageId: string;
  stageName: string;
  onClose: () => void;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const idempotencyKey = useMemo(() => newIdempotencyKey(), []);
  const options = useQuery({
    queryKey: schedulingKeys.options(applicationId, stageId),
    queryFn: ({ signal }) => schedulingApi.options(applicationId, stageId, signal),
  });
  const [people, setPeople] = useState<Person[] | null>(null);
  const interviewers = people ?? (me ? [{ id: me.user.id, name: me.user.name }] : []);
  const [duration, setDuration] = useState<number | null>(null);
  const [mode, setMode] = useState<InterviewMode>("video");
  const [error, setError] = useState<string | null>(null);
  const minutes = duration ?? options.data?.duration_minutes ?? 60;
  const start = useMutation({
    mutationFn: () =>
      schedulingApi.start(
        applicationId,
        { stage_id: stageId, participant_user_ids: interviewers.map((p) => p.id), duration_minutes: minutes, mode },
        idempotencyKey,
      ),
    onSuccess: async () => {
      toast.success("The Scheduling Agent is finding times.");
      await queryClient.invalidateQueries({ queryKey: schedulingKeys.all });
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const invalid = interviewers.length === 0;

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Let the agent schedule · {stageName}</DialogTitle>
          <DialogContent className={styles.content}>
            <PeoplePicker label="Interviewers" value={interviewers} onChange={setPeople} validationMessage={invalid ? "Choose at least one interviewer." : undefined} />
            <Field label="Duration" hint="Minutes">
              <SpinButton
                value={minutes}
                min={15}
                max={480}
                step={15}
                onChange={(_, d) => {
                  const n = d.value ?? (d.displayValue !== undefined ? Number(d.displayValue) : minutes);
                  if (Number.isFinite(n)) setDuration(Math.min(480, Math.max(15, Number(n))));
                }}
              />
            </Field>
            <Field label="Mode">
              <Dropdown value={MODE_LABELS[mode]} selectedOptions={[mode]} onOptionSelect={(_, d) => d.optionValue && setMode(d.optionValue as InterviewMode)}>
                {MODES.map((m) => (
                  <Option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Text>Candidate timezone: {options.data?.candidate_timezone ?? "…"}</Text>
            <MessageBar intent="info" layout="multiline">
              <MessageBarBody>
                The agent offers times from interviewers&apos; free/busy and books when the candidate picks one. It never reads calendar details.
              </MessageBarBody>
            </MessageBar>
            {error && (
              <MessageBar intent="error" layout="multiline">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              disabled={invalid || start.isPending || !options.data?.agent_on}
              icon={start.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={() => {
                setError(null);
                start.mutate();
              }}
            >
              Start
            </Button>
            <Button onClick={onClose} disabled={start.isPending}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
