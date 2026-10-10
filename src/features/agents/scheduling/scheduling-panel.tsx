"use client";

import { Badge, Body1, Button, Caption1, Card, makeStyles, MessageBar, MessageBarBody, Subtitle2, Text, tokens } from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AiBadge } from "@/components/ai/ai-badge";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { InterviewPanelProps } from "@/features/interviews/interview-panels";
import type { ApplicationPanelProps } from "@/features/pipeline/application-panels";
import { errorMessage } from "@/lib/api/errors";
import { schedulingApi, schedulingKeys } from "./api";
import { HistoryTimeline } from "./history-timeline";
import { isOpen, STATUS_BADGES } from "./logic";
import { SlotList } from "./slot-list";
import type { RequestOut } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM, minWidth: 0 },
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
  grow: { flex: 1 },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
});

/** Application drawer panel "Scheduling" (registered as `agent_scheduling`): the latest request of the application. */
export function ApplicationSchedulingPanel({ applicationId }: ApplicationPanelProps) {
  const list = useQuery({
    queryKey: schedulingKeys.forApplication(applicationId),
    queryFn: ({ signal }) => schedulingApi.forApplication(applicationId, signal),
  });
  return <SchedulingCard title="Scheduling" query={list} />;
}

/** Interview drawer panel "Scheduling history" (registered as `scheduling`). */
export function InterviewSchedulingPanel({ interviewId }: InterviewPanelProps) {
  const list = useQuery({
    queryKey: schedulingKeys.forInterview(interviewId),
    queryFn: ({ signal }) => schedulingApi.forInterview(interviewId, signal),
  });
  return <SchedulingCard title="Scheduling history" query={list} hideWhenEmpty />;
}

function SchedulingCard({
  title,
  query,
  hideWhenEmpty,
}: {
  title: string;
  query: { data?: RequestOut[]; isPending: boolean; isError: boolean; error: unknown };
  hideWhenEmpty?: boolean;
}) {
  const styles = useStyles();
  const latest = query.data?.[0];
  if (hideWhenEmpty && !query.isPending && !latest) return null;
  return (
    <Card className={styles.root} aria-labelledby="agent-scheduling-title">
      <div className={styles.head}>
        <Subtitle2 as="h3" id="agent-scheduling-title">
          {title}
        </Subtitle2>
        <AiBadge agentName="Scheduling Agent" />
        {latest && (
          <Badge appearance="tint" color={STATUS_BADGES[latest.status].color}>
            {STATUS_BADGES[latest.status].label}
          </Badge>
        )}
      </div>
      {query.isPending ? (
        <GridSkeleton rows={3} />
      ) : query.isError ? (
        <ErrorBar title="Could not load scheduling." message={errorMessage(query.error)} />
      ) : !latest ? (
        <Body1 className={styles.muted}>No scheduling request yet. Use &quot;Let the agent schedule&quot; on a stage of the Interviews tab.</Body1>
      ) : (
        <RequestDetails key={latest.id} request={latest} />
      )}
    </Card>
  );
}

function RequestDetails({ request }: { request: RequestOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canSchedule = usePermission("interview:schedule");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const detail = useQuery({ queryKey: schedulingKeys.request(request.id), queryFn: ({ signal }) => schedulingApi.get(request.id, signal) });
  const cancel = useMutation({
    mutationFn: () => schedulingApi.cancel(request.id),
    onSuccess: async () => {
      toast.success("Scheduling request cancelled.");
      await queryClient.invalidateQueries({ queryKey: schedulingKeys.all });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const d = detail.data;
  const offers = d?.offers ?? [];
  const current = [...offers].reverse().find((o) => o.status !== "superseded" && o.status !== "draft") ?? offers[offers.length - 1];
  const unknown = (d?.participants ?? []).filter((p) => !p.calendar_connected).map((p) => p.name ?? "An interviewer");

  return (
    <>
      <div className={styles.row}>
        <Text>
          Round {request.round} of {request.max_rounds}
        </Text>
        <Caption1 className={styles.muted}>
          {request.human_id} · {request.stage_name ?? "Interview"}
          {request.kind === "reschedule" ? " · reschedule" : ""}
        </Caption1>
        <span className={styles.grow} />
        {canSchedule && isOpen(request.status) && (
          <Button appearance="subtle" disabled={cancel.isPending} onClick={() => setConfirmCancel(true)}>
            Cancel request
          </Button>
        )}
        {request.current_run_id && <AppLink href={`/ai/runs/${request.current_run_id}`}>View run</AppLink>}
      </div>
      {unknown.length > 0 && isOpen(request.status) && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>Availability unconfirmed: {unknown.join(", ")}</MessageBarBody>
        </MessageBar>
      )}
      {request.status === "handed_off" && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>The Scheduling Agent handed this request to you{request.handoff_reason ? ` (${request.handoff_reason.replace(/_/g, " ")})` : ""}. A task was created.</MessageBarBody>
        </MessageBar>
      )}
      {detail.isError ? (
        <ErrorBar title="Could not load the request." message={errorMessage(detail.error)} />
      ) : detail.isPending ? (
        <GridSkeleton rows={2} />
      ) : (
        <>
          {current && (
            <div className={styles.section}>
              <Subtitle2 as="h4">{current.partial ? "Best partial options" : "Offered times"}</Subtitle2>
              <SlotList offer={current} candidateTimezone={request.candidate_timezone} />
              {current.counter_windows && current.counter_windows.length > 0 && (
                <Caption1 className={styles.muted}>The candidate suggested {current.counter_windows.length} other time(s).</Caption1>
              )}
            </div>
          )}
          <div className={styles.section}>
            <Subtitle2 as="h4">History</Subtitle2>
            <HistoryTimeline events={d?.history ?? []} />
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel request"
        confirmLabel="Cancel request"
        onConfirm={() => cancel.mutateAsync()}
        onClose={() => setConfirmCancel(false)}
      >
        Cancel this scheduling request? The candidate&apos;s link stops working and the agent stops.
      </ConfirmDialog>
    </>
  );
}
