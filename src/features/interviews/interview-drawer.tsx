"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Link,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Spinner,
  Subtitle2,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowDownload20Regular,
  CalendarEdit20Regular,
  CalendarCancel20Regular,
  ClipboardTextEdit20Regular,
  MoreHorizontal20Regular,
} from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { DetailsDrawer, ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { usePermission } from "@/features/auth/use-permission";
import { downloadApiFile } from "@/lib/api/download";
import { errorMessage } from "@/lib/api/errors";
import { useNowMs } from "@/lib/time/use-now";
import { browserTimeZone, formatInZone } from "@/lib/time/zones";
import { interviewsApi } from "./api";
import { interviewError } from "./errors";
import { formatDuration, MODE_LABELS, myParticipant, needsMyScorecard, STATUS_LABELS } from "./format";
import { ScheduleDialog } from "./schedule-dialog";
import { ScorecardList } from "./scorecard-list";
import type { InterviewOut, ParticipantKind } from "./types";
import { useCancelInterview, useInterviewStatusAction } from "./use-interviews";
import { interviewPanels } from "./interview-panels";
import { RequestRescheduleDialog } from "@/features/agents/scheduling/request-reschedule-dialog";
import "@/features/agents/scheduling/register";
import "@/features/agents/interview-assistant/register";
import { InterviewSyncBanner } from "@/features/calendar-sync/interview-sync-banner";

const useStyles = makeStyles({
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalL },
  section: { marginTop: tokens.spacingVerticalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  people: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  person: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "baseline" },
  muted: { color: tokens.colorNeutralForeground3 },
  pre: { whiteSpace: "pre-wrap" },
});

const KIND: Record<ParticipantKind, string> = {
  interviewer_internal: "Interviewer",
  interviewer_external: "External interviewer",
  candidate: "Candidate",
  observer: "Observer",
};

/** Cancel an interview with a required reason (the backend sends METHOD:CANCEL to everyone). */
export function CancelInterviewDialog({ interview, onClose }: { interview: InterviewOut; onClose: () => void }) {
  const toast = useAppToast();
  const cancel = useCancelInterview();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const submit = async () => {
    if (!reason.trim()) return setFieldError("Add a reason; it is included in the cancellation.");
    try {
      await cancel.mutateAsync({ id: interview.id, reason: reason.trim() });
      toast.success(`Cancelled ${interview.human_id}. Cancellations were sent.`);
      onClose();
    } catch (e) {
      setError(interviewError(e));
    }
  };
  return (
    <Dialog open modalType="alert" onOpenChange={(_, d) => !d.open && !cancel.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Cancel interview?</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            <Body1>
              {interview.candidate_name ?? "The candidate"} and every interviewer receive a cancellation for {interview.stage_name} on {interview.display_time}.
            </Body1>
            <ErrorBar message={error} />
            <Field label="Reason" required validationState={fieldError ? "error" : "none"} validationMessage={fieldError}>
              <Textarea
                value={reason}
                maxLength={2000}
                onChange={(_, d) => {
                  setReason(d.value);
                  setFieldError(null);
                }}
              />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={cancel.isPending} icon={cancel.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
              Cancel interview
            </Button>
            <Button disabled={cancel.isPending} onClick={onClose}>
              Keep
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Interview details panel: time in each zone, participants, link, actions (reschedule, cancel, no-show, .ics) and scorecards. */
export function InterviewDrawer({ interview, onClose }: { interview: InterviewOut; onClose: () => void }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const router = useRouter();
  const toast = useAppToast();
  const { data: me } = useMe();
  const canSchedule = usePermission("interview:schedule");
  const statusAction = useInterviewStatusAction();
  const now = useNowMs();
  const [dialog, setDialog] = useState<"reschedule" | "cancel" | "request_reschedule" | null>(null);
  const tz = browserTimeZone();
  const i = interview;
  const mine = myParticipant(i, me?.user.id);
  const owesScorecard = needsMyScorecard(i, me?.user.id, now);
  const scheduled = i.status === "scheduled";
  const started = Date.parse(i.starts_at) <= now;
  const extraPanels = interviewPanels((perm) => !!me?.permissions && perm in me.permissions);
  const isParticipant = !!mine || i.organizer_user_id === me?.user.id;

  const markStatus = async (action: "no_show" | "complete") => {
    try {
      await statusAction.mutateAsync({ id: i.id, action });
      toast.success(action === "no_show" ? "Marked as no-show" : "Marked as completed");
      onClose();
    } catch (e) {
      toast.error(interviewError(e));
    }
  };

  return (
    <>
      <DetailsDrawer
        open={!dialog}
        size="medium"
        onClose={onClose}
        title={
          <span>
            {i.candidate_name ?? "Candidate"} · {i.stage_name}{" "}
            <Badge appearance="tint" color={STATUS_LABELS[i.status].color}>
              {STATUS_LABELS[i.status].label}
            </Badge>
          </span>
        }
      >
        <div className={styles.actions}>
          {(owesScorecard || mine?.scorecard_required) && (
            <Button appearance={owesScorecard ? "primary" : "secondary"} icon={<ClipboardTextEdit20Regular />} onClick={() => router.push(`/interviews/${i.id}/scorecard`)}>
              {mine?.scorecard_status === "submitted" ? "View my scorecard" : "Submit scorecard"}
            </Button>
          )}
          {canSchedule && scheduled && (
            <>
              <Button icon={<CalendarEdit20Regular />} onClick={() => setDialog("reschedule")}>
                Reschedule
              </Button>
              <Button icon={<CalendarCancel20Regular />} onClick={() => setDialog("cancel")}>
                Cancel
              </Button>
            </>
          )}
          {isParticipant && scheduled && !started && (
            <Button icon={<CalendarEdit20Regular />} onClick={() => setDialog("request_reschedule")}>
              Request reschedule
            </Button>
          )}
          <Button
            icon={<ArrowDownload20Regular />}
            onClick={() => downloadApiFile(interviewsApi.icsUrl(i.id, mine?.id), "invite.ics").catch((e) => toast.error(errorMessage(e)))}
          >
            Add to calendar
          </Button>
          {canSchedule && scheduled && started && (
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button aria-label="More actions" icon={<MoreHorizontal20Regular />} />
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem onClick={() => markStatus("complete")}>Mark as completed</MenuItem>
                  <MenuItem onClick={() => markStatus("no_show")}>Mark as no-show</MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          )}
        </div>

        {scheduled && (
          <InterviewSyncBanner
            interviewId={i.id}
            startsAt={i.starts_at}
            onReschedule={canSchedule ? () => setDialog("reschedule") : undefined}
            onCancel={canSchedule ? () => setDialog("cancel") : undefined}
          />
        )}
        <dl className={admin.detailList}>
          <dt>When</dt>
          <dd>
            {formatInZone(i.starts_at, tz, { withYear: true })} · {formatDuration(i.duration_minutes)}
            {i.timezone !== tz && (
              <Caption1 as="p" className={styles.muted} style={{ margin: 0 }}>
                Organiser: {i.display_time}
              </Caption1>
            )}
          </dd>
          <dt>Interview</dt>
          <dd>
            {i.human_id}
            {i.round > 1 ? ` · round ${i.round}` : ""}
          </dd>
          {i.demand_title && (
            <>
              <dt>Demand</dt>
              <dd>{i.demand_title}</dd>
            </>
          )}
          <dt>Mode</dt>
          <dd>{MODE_LABELS[i.mode]}</dd>
          {i.meeting_url && (
            <>
              <dt>Meeting</dt>
              <dd>
                <Link href={i.meeting_url} target="_blank" rel="noopener noreferrer">
                  {i.meeting_url}
                </Link>
              </dd>
            </>
          )}
          {i.location && (
            <>
              <dt>Location</dt>
              <dd>{i.location}</dd>
            </>
          )}
          <dt>Invitations</dt>
          <dd>{i.provider === "none" ? "Calendar file by email" : `${i.provider === "google" ? "Google" : "Microsoft"} calendar`}</dd>
          {i.cancelled_reason && (
            <>
              <dt>Cancelled</dt>
              <dd>{i.cancelled_reason}</dd>
            </>
          )}
        </dl>

        {i.notes && (
          <div className={styles.section}>
            <Subtitle2 as="h3">Notes for interviewers</Subtitle2>
            <Body1 className={styles.pre}>{i.notes}</Body1>
          </div>
        )}

        <div className={styles.section}>
          <Subtitle2 as="h3">Participants</Subtitle2>
          <ul className={styles.people}>
            {i.participants.map((p) => (
              <li key={p.id} className={styles.person}>
                <strong>{p.name || p.email}</strong>
                <Caption1 className={styles.muted}>
                  {KIND[p.kind]} · {p.local_time}
                  {p.response_status !== "needs_action" ? ` · ${p.response_status}` : ""}
                </Caption1>
                {p.scorecard_required && (
                  <Badge size="small" appearance="outline" color={p.scorecard_status === "submitted" ? "success" : "informative"}>
                    {p.scorecard_status === "submitted" ? "Scorecard in" : "Scorecard due"}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </div>

        {extraPanels.map((p) => (
          <div key={p.key} className={styles.section}>
            <p.component interviewId={i.id} applicationId={i.application_id} status={i.status} />
          </div>
        ))}

        {i.scorecards_required > 0 && (
          <div className={styles.section}>
            <Subtitle2 as="h3">
              Scorecards ({i.scorecards_submitted}/{i.scorecards_required})
            </Subtitle2>
            <ScorecardList interviewId={i.id} />
          </div>
        )}
      </DetailsDrawer>
      {dialog === "reschedule" && <ScheduleDialog target={{ kind: "reschedule", interview: i }} onClose={() => setDialog(null)} onDone={onClose} />}
      {dialog === "request_reschedule" && <RequestRescheduleDialog interviewId={i.id} onClose={() => setDialog(null)} />}
      {dialog === "cancel" && (
        <CancelInterviewDialog
          interview={i}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
    </>
  );
}
