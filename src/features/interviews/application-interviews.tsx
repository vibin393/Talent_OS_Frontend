"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
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
  MessageBarActions,
  MessageBarBody,
  Option,
  Spinner,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { CalendarAdd20Regular, CheckmarkCircle20Regular, Dismiss20Regular, Pause20Regular, PersonAvailable20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { useNowMs } from "@/lib/time/use-now";
import { browserTimeZone, formatInZone } from "@/lib/time/zones";
import { interviewError } from "./errors";
import { KIND_LABELS, recommendationLabel, RECOMMENDATIONS, STATUS_LABELS } from "./format";
import { InterviewDrawer } from "./interview-drawer";
import { ScheduleDialog } from "./schedule-dialog";
import { LetAgentScheduleButton } from "@/features/agents/scheduling/start-dialog";
import type { InterviewOut, StageOutcomeIn, StageSummaryOut } from "./types";
import { useInterviewSummary, useRecordOutcome, useRejectReasons, useSelectApplication } from "./use-interviews";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  stage: { padding: tokens.spacingHorizontalM, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  interviews: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  interview: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    border: "none",
    textAlign: "start",
    cursor: "pointer",
    width: "100%",
    ":hover": { backgroundColor: tokens.colorNeutralBackground2Hover },
  },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

const OUTCOME_BADGE = {
  advance: { label: "Advanced", color: "success" },
  hold: { label: "On hold", color: "warning" },
  reject: { label: "Rejected", color: "danger" },
} as const;

function RejectDialog({
  stage,
  onConfirm,
  onClose,
}: {
  stage: StageSummaryOut;
  onConfirm: (reasonCode: string | null, comment: string) => Promise<void>;
  onClose: () => void;
}) {
  const reasons = useRejectReasons(true);
  const [code, setCode] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const options = (reasons.data ?? []).filter((r) => !r.archived_at);
  return (
    <Dialog open modalType="alert" onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Reject after {stage.stage.name}?</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            <Body1>The application moves to Rejected and the candidate&apos;s other scheduled interviews are cancelled.</Body1>
            <Field label="Reason" hint="Defaults to “Rejected after interview”.">
              <Dropdown
                placeholder={reasons.isPending ? "Loading…" : "Rejected after interview"}
                value={options.find((r) => r.code === code)?.label ?? ""}
                selectedOptions={code ? [code] : []}
                onOptionSelect={(_, d) => setCode(d.optionValue ?? null)}
              >
                {options.map((r) => (
                  <Option key={r.id} value={r.code}>
                    {r.label}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Comment">
              <Textarea value={comment} maxLength={4000} onChange={(_, d) => setComment(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              disabled={busy}
              icon={busy ? <Spinner size="tiny" /> : undefined}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm(code, comment);
                  onClose();
                } catch {
                  // reported by the caller
                } finally {
                  setBusy(false);
                }
              }}
            >
              Reject
            </Button>
            <Button disabled={busy} onClick={onClose}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/**
 * The application drawer's "Interviews" tab (Epic 6 drawer, Epic 7 content): per plan stage its interviews,
 * scorecard counts (blinded until yours is in), outcome buttons Advance / Hold / Reject, and "Move to
 * Selected" once the final stage is advanced.
 */
export function ApplicationInterviews({
  applicationId,
  demandId,
  candidateName,
  candidateTimezone,
}: {
  applicationId: string;
  demandId: string;
  candidateName: string;
  candidateTimezone?: string | null;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const tz = browserTimeZone();
  const canSchedule = usePermission("interview:schedule");
  const canOutcome = usePermission("interview:outcome");
  const summary = useInterviewSummary(applicationId);
  const now = useNowMs();
  const record = useRecordOutcome(applicationId);
  const select = useSelectApplication(applicationId);
  const [scheduleStage, setScheduleStage] = useState<string | null | undefined>(undefined);
  const [rejecting, setRejecting] = useState<StageSummaryOut | null>(null);
  const [openInterview, setOpenInterview] = useState<InterviewOut | null>(null);
  const [nextPrompt, setNextPrompt] = useState<{ stageId: string; name: string } | null>(null);

  if (summary.isPending) return <GridSkeleton rows={4} />;
  if (summary.isError) return <ErrorBar title="Could not load interviews." message={errorMessage(summary.error)} />;
  const stages = summary.data.stages;

  const outcome = async (stage: StageSummaryOut, body: Omit<StageOutcomeIn, "stage_id">) => {
    try {
      const r = await record.mutateAsync({ stage_id: stage.stage.id, ...body });
      if (body.outcome === "advance") {
        const idx = stages.findIndex((s) => s.stage.id === stage.stage.id);
        const next = stages[idx + 1];
        if (r.can_select) toast.success("Advanced on the final stage. You can now move the candidate to Selected.");
        else if (next) {
          toast.success(`Advanced past ${stage.stage.name}.`);
          setNextPrompt({ stageId: next.stage.id, name: next.stage.name });
        } else toast.success(`Advanced past ${stage.stage.name}.`);
      } else if (body.outcome === "hold") toast.success(`${stage.stage.name}: on hold`);
      else toast.success("Application rejected");
    } catch (e) {
      toast.error(interviewError(e));
      throw e;
    }
  };


  return (
    <div className={styles.root}>
      {summary.data.can_select && canOutcome && (
        <MessageBar intent="success" layout="multiline">
          <MessageBarBody>The candidate was advanced on the final interview stage.</MessageBarBody>
          <MessageBarActions>
            <Button
              appearance="primary"
              icon={select.isPending ? <Spinner size="tiny" /> : <PersonAvailable20Regular />}
              disabled={select.isPending}
              onClick={() =>
                select.mutate(undefined, {
                  onSuccess: () => toast.success(`${candidateName} moved to Selected`),
                  onError: (e) => toast.error(interviewError(e)),
                })
              }
            >
              Move to Selected
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}
      {nextPrompt && canSchedule && (
        <MessageBar intent="info">
          <MessageBarBody>Schedule the next stage: {nextPrompt.name}?</MessageBarBody>
          <MessageBarActions
            containerAction={<Button appearance="transparent" aria-label="Dismiss" icon={<Dismiss20Regular />} onClick={() => setNextPrompt(null)} />}
          >
            <Button
              onClick={() => {
                setScheduleStage(nextPrompt.stageId);
                setNextPrompt(null);
              }}
            >
              Schedule
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}
      {stages.length === 0 && <Body1 className={styles.muted}>This demand has no interview plan yet. Add stages on the demand&apos;s Interviews tab.</Body1>}
      {stages.map((s) => {
        const started = s.interviews.some((i) => Date.parse(i.starts_at) <= now && i.status !== "cancelled");
        const latest = s.latest_outcome;
        const recs = s.recommendations;
        return (
          <Card key={s.stage.id} className={styles.stage} appearance="outline">
            <CardHeader
              header={
                <Text weight="semibold">
                  {s.stage.position}. {s.stage.name}
                  {s.stage.is_final ? " (final)" : ""}
                </Text>
              }
              description={<Caption1 className={styles.muted}>{KIND_LABELS[s.stage.kind]}{s.stage.kit_name ? ` · ${s.stage.kit_name}` : ""}</Caption1>}
              action={
                latest ? (
                  <Badge appearance="filled" color={OUTCOME_BADGE[latest.outcome].color}>
                    {OUTCOME_BADGE[latest.outcome].label}
                  </Badge>
                ) : undefined
              }
            />
            {s.interviews.length > 0 ? (
              <ul className={styles.interviews}>
                {s.interviews.map((i) => (
                  <li key={i.id}>
                    <button type="button" className={styles.interview} onClick={() => setOpenInterview(i)}>
                      <Text>{formatInZone(i.starts_at, tz)}</Text>
                      <Badge size="small" appearance="tint" color={STATUS_LABELS[i.status].color}>
                        {STATUS_LABELS[i.status].label}
                      </Badge>
                      {i.scorecards_required > 0 && (
                        <Caption1 className={styles.muted}>
                          Scorecards {i.scorecards_submitted}/{i.scorecards_required}
                        </Caption1>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Caption1 className={styles.muted}>No interviews in this stage yet.</Caption1>
            )}
            {s.scorecards_required > 0 && (
              <Caption1>
                {s.hidden
                  ? `${s.scorecards_submitted} of ${s.scorecards_required} submitted — submit yours to view`
                  : recs
                    ? RECOMMENDATIONS.filter((r) => recs[r.value])
                        .map((r) => `${recs[r.value]} × ${recommendationLabel(r.value)}`)
                        .join(" · ") || `${s.scorecards_submitted} of ${s.scorecards_required} submitted`
                    : `${s.scorecards_submitted} of ${s.scorecards_required} submitted`}
              </Caption1>
            )}
            {latest?.comment && <Caption1 className={styles.muted}>“{latest.comment}”</Caption1>}
            <div className={styles.actions}>
              {canSchedule && (
                <Button size="small" icon={<CalendarAdd20Regular />} onClick={() => setScheduleStage(s.stage.id)}>
                  Schedule
                </Button>
              )}
              {canSchedule && <LetAgentScheduleButton applicationId={applicationId} stageId={s.stage.id} stageName={s.stage.name} />}
              {canOutcome && (
                <>
                  <Button
                    size="small"
                    icon={<CheckmarkCircle20Regular />}
                    disabled={!started || record.isPending}
                    title={started ? undefined : "Available once an interview in this stage has started"}
                    onClick={() => outcome(s, { outcome: "advance" }).catch(() => undefined)}
                  >
                    Advance
                  </Button>
                  <Button size="small" icon={<Pause20Regular />} disabled={!started || record.isPending} onClick={() => outcome(s, { outcome: "hold" }).catch(() => undefined)}>
                    Hold
                  </Button>
                  <Button size="small" icon={<Dismiss20Regular />} disabled={!started || record.isPending} onClick={() => setRejecting(s)}>
                    Reject
                  </Button>
                </>
              )}
            </div>
          </Card>
        );
      })}

      {scheduleStage !== undefined && (
        <ScheduleDialog
          target={{ kind: "create", applicationId, demandId, candidateName, candidateTimezone, stageId: scheduleStage }}
          onClose={() => setScheduleStage(undefined)}
        />
      )}
      {rejecting && (
        <RejectDialog
          stage={rejecting}
          onClose={() => setRejecting(null)}
          onConfirm={(code, comment) => outcome(rejecting, { outcome: "reject", reason_code: code, comment: comment.trim() || null })}
        />
      )}
      {openInterview && <InterviewDrawer interview={openInterview} onClose={() => setOpenInterview(null)} />}
    </div>
  );
}
