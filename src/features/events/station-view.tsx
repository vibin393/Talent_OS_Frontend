"use client";

import { Badge, Body1, Button, makeStyles, MessageBar, MessageBarBody, Spinner, Text, Title1, Title2, tokens } from "@fluentui/react-components";
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { ScorecardForm } from "@/features/interviews/scorecard-form";
import { draftFromScorecard, kitFromSnapshot, toScorecardBody } from "@/features/interviews/scorecard";
import { useMyScorecard, useSaveScorecard } from "@/features/interviews/use-scorecards";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { eventKeys, eventPaths, eventsApi } from "./api";
import { boardView, currentEntry, QUEUE_STATUS_LABELS } from "./logic";
import type { QueueEntryOut, QueueOut } from "./types";
import { useEventPermissions, useRefreshLive } from "./use-events";
import { useEtagPoll } from "./use-poll";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "960px" },
  panel: { padding: tokens.spacingHorizontalXL, backgroundColor: tokens.colorNeutralBackground1, borderRadius: tokens.borderRadiusLarge, boxShadow: tokens.shadow8, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  actions: { display: "grid", gap: tokens.spacingHorizontalM, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" },
  big: { minHeight: "56px", fontSize: tokens.fontSizeBase500 },
  name: { fontSize: tokens.fontSizeHero800, lineHeight: tokens.lineHeightHero800, fontWeight: tokens.fontWeightSemibold, overflowWrap: "anywhere" },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** `/campus/events/[id]/station/[stationId]`: an interviewer's station (Call next, Start, quick scorecard, Complete / Skip / Left). */
export function StationView({ eventId, stationId }: { eventId: string; stationId: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const refresh = useRefreshLive(eventId);
  const { canManage } = useEventPermissions();
  const live = useEtagPoll<QueueOut>(eventKeys.live(eventId, "queue"), eventPaths.queue(eventId), { enabled: canManage });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (!canManage) return <NoAccess what="interviewer stations" />;
  if (live.isPending) return <GridSkeleton />;
  if (live.isError && !live.data) return <ErrorBar title="Could not load the queue." message={errorMessage(live.error)} />;
  const q = live.data;
  const station = q.stations.find((s) => s.id === stationId);
  if (!station) return <ErrorBar title="Station not found." message="It may have been removed. Go back to the event to pick another station." />;
  const entry = currentEntry(q, station);
  const waiting = boardView(q).waiting.filter((e) => !station.demand_id || !e.demand_id || e.demand_id === station.demand_id).length;

  const act = async (key: string, fn: () => Promise<QueueEntryOut | null>, done: string) => {
    setBusy(key);
    setNotice(null);
    try {
      const out = await fn();
      if (key === "call" && !out) setNotice("Nobody is waiting for this station right now.");
      else toast.success(done);
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.root}>
      <AppLink href={`/campus/events/${eventId}`}>
        <ArrowLeft20Regular aria-hidden style={{ verticalAlign: "middle" }} /> Event
      </AppLink>
      <Title1 as="h1">
        {station.label}{" "}
        <Badge appearance="tint" color={station.status === "open" ? "success" : "warning"}>
          {station.status}
        </Badge>
      </Title1>
      <Text className={styles.muted}>
        {waiting} waiting for this station · about {q.median_minutes} min per interview
      </Text>
      <section className={styles.panel} aria-live="polite" aria-labelledby="current">
        <Title2 as="h2" id="current">
          {entry ? QUEUE_STATUS_LABELS[entry.status] : "Ready"}
        </Title2>
        {entry ? (
          <>
            <span className={styles.name}>{entry.candidate_name ?? "Candidate"}</span>
            <Body1>
              Queue #{entry.position}
              {entry.demand_title ? ` · ${entry.demand_title}` : ""}
              {entry.status === "called" && entry.notify_result ? ` · Notified: ${entry.notify_result}` : ""}
            </Body1>
            <div className={styles.actions}>
              {entry.status === "called" && (
                <Button appearance="primary" className={styles.big} disabled={!!busy} onClick={() => void act("start", () => eventsApi.start(eventId, entry.id), "Interview started")}>
                  {busy === "start" ? <Spinner size="tiny" /> : "Start"}
                </Button>
              )}
              {entry.status === "in_interview" && (
                <Button appearance="primary" className={styles.big} disabled={!!busy} onClick={() => void act("complete", () => eventsApi.complete(eventId, entry.id), "Interview completed")}>
                  {busy === "complete" ? <Spinner size="tiny" /> : "Complete"}
                </Button>
              )}
              <Button className={styles.big} disabled={!!busy} onClick={() => void act("skip", () => eventsApi.skip(eventId, entry.id), "Skipped")}>
                Skip
              </Button>
              <Button className={styles.big} disabled={!!busy} onClick={() => void act("left", () => eventsApi.left(eventId, entry.id), "Marked as left")}>
                Left
              </Button>
              {entry.status === "called" && (
                <Button className={styles.big} disabled={!!busy} onClick={() => void act("requeue", () => eventsApi.requeue(eventId, entry.id), "Back in the queue")}>
                  Back to queue
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <Body1>Call the next candidate when you are ready.</Body1>
            <Button
              appearance="primary"
              className={styles.big}
              disabled={!!busy || station.status !== "open" || q.status !== "live"}
              onClick={() => void act("call", () => eventsApi.callNext(eventId, station.id), "Candidate called")}
            >
              {busy === "call" ? <Spinner size="tiny" /> : "Call next"}
            </Button>
            {station.status !== "open" && <Text className={styles.muted}>The station is {station.status}. Open it from the event page.</Text>}
          </>
        )}
        {notice && (
          <MessageBar intent="info">
            <MessageBarBody>{notice}</MessageBarBody>
          </MessageBar>
        )}
      </section>
      {entry?.status === "in_interview" && entry.interview_id && <QuickScorecard key={entry.interview_id} interviewId={entry.interview_id} />}
    </div>
  );
}

/** The P1 scorecard form (FR-41) for the running interview. */
function QuickScorecard({ interviewId }: { interviewId: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const mine = useMyScorecard(interviewId);
  const save = useSaveScorecard(interviewId);
  const [error, setError] = useState<string | null>(null);
  if (mine.isPending) return <Spinner label="Loading scorecard…" />;
  if (mine.isError)
    return (
      <MessageBar intent="info">
        <MessageBarBody>
          {isApiError(mine.error) && (mine.error.status === 404 || mine.error.status === 403)
            ? "You are not an interviewer on this interview, so there is no scorecard for you."
            : errorMessage(mine.error)}
        </MessageBarBody>
      </MessageBar>
    );
  const card = mine.data;
  const kit = kitFromSnapshot(card.kit);
  const submitted = card.status === "submitted";
  return (
    <section className={styles.panel} aria-label="Scorecard">
      <Title2 as="h2">Scorecard</Title2>
      <ScorecardForm
        key={`${card.status}-${card.submitted_at ?? ""}`}
        kit={kit}
        initial={draftFromScorecard(card, kit)}
        readOnly={submitted}
        error={error}
        onSaveDraft={async (draft) => {
          setError(null);
          try {
            await save.mutateAsync({ body: toScorecardBody(draft), submit: false });
            toast.success("Draft saved");
          } catch (e) {
            setError(errorMessage(e));
            throw e;
          }
        }}
        onSubmit={async (draft) => {
          setError(null);
          try {
            await save.mutateAsync({ body: toScorecardBody(draft), submit: true });
            toast.success("Scorecard submitted");
          } catch (e) {
            setError(errorMessage(e));
            throw e;
          }
        }}
      />
    </section>
  );
}
