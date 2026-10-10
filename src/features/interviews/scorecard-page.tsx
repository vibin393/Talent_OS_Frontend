"use client";

import { Body1, Card, CardHeader, makeStyles, MessageBar, MessageBarBody, Subtitle2, tokens } from "@fluentui/react-components";
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { interviewAssistantApi, interviewAssistantKeys } from "@/features/agents/interview-assistant/api";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useNowMs } from "@/lib/time/use-now";
import { browserTimeZone, formatInZone } from "@/lib/time/zones";
import { interviewError } from "./errors";
import { ScorecardForm } from "./scorecard-form";
import { ScorecardList } from "./scorecard-list";
import { draftFromScorecard, kitFromSnapshot, toScorecardBody } from "./scorecard";
import { useInterview } from "./use-interviews";
import { useMyScorecard, useSaveScorecard } from "./use-scorecards";

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  section: { marginTop: tokens.spacingVerticalXXL, maxWidth: "860px", display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

/** `/interviews/[id]/scorecard`: the signed-in interviewer's scorecard, then the (unblinded) team scorecards. */
export function ScorecardPage({ interviewId }: { interviewId: string }) {
  const styles = useStyles();
  const toast = useAppToast();
  const tz = browserTimeZone();
  const interview = useInterview(interviewId);
  const mine = useMyScorecard(interviewId);
  const save = useSaveScorecard(interviewId);
  const [error, setError] = useState<string | null>(null);
  const now = useNowMs();
  // Epic 60: the Interview Assistant's private draft for me (404 -> none).
  const aiDraft = useQuery({
    queryKey: interviewAssistantKeys.draft(interviewId),
    queryFn: async ({ signal }) => {
      try {
        return await interviewAssistantApi.draft(interviewId, signal);
      } catch (e) {
        if (isApiError(e) && (e.status === 404 || e.status === 403)) return null;
        throw e;
      }
    },
  });

  const back = (
    <div className={styles.back}>
      <AppLink href="/interviews">
        <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> My interviews
      </AppLink>
    </div>
  );

  if (interview.isPending || mine.isPending) {
    return (
      <>
        {back}
        <GridSkeleton rows={6} />
      </>
    );
  }
  if (interview.isError) {
    return (
      <>
        {back}
        {isApiError(interview.error) && interview.error.status === 404 ? (
          <Card style={{ maxWidth: 560 }}>
            <CardHeader header={<Subtitle2 as="h1">Interview not found</Subtitle2>} description={<Body1>It does not exist or you are not a participant.</Body1>} />
          </Card>
        ) : (
          <ErrorBar title="Could not load this interview." message={errorMessage(interview.error)} />
        )}
      </>
    );
  }
  const i = interview.data;
  const title = `Scorecard · ${i.candidate_name ?? "Candidate"}`;
  const subtitle = `${i.stage_name}${i.demand_title ? ` · ${i.demand_title}` : ""} · ${formatInZone(i.starts_at, tz, { withYear: true })}`;

  if (mine.isError) {
    return (
      <>
        {back}
        <PageHeader title={title} subtitle={subtitle} />
        <MessageBar intent="info" layout="multiline">
          <MessageBarBody>
            {isApiError(mine.error) && (mine.error.status === 404 || mine.error.status === 403)
              ? "You are not a required interviewer on this interview, so there is no scorecard for you."
              : interviewError(mine.error)}
          </MessageBarBody>
        </MessageBar>
        <section className={styles.section}>
          <Subtitle2 as="h2">Team scorecards</Subtitle2>
          <ScorecardList interviewId={interviewId} />
        </section>
      </>
    );
  }

  const card = mine.data;
  const kit = kitFromSnapshot(card.kit);
  const submitted = card.status === "submitted";
  const notStarted = Date.parse(i.starts_at) > now;

  return (
    <>
      {back}
      <PageHeader title={title} subtitle={subtitle} />
      {i.status === "cancelled" && (
        <MessageBar intent="warning">
          <MessageBarBody>This interview was cancelled{i.cancelled_reason ? `: ${i.cancelled_reason}` : "."}</MessageBarBody>
        </MessageBar>
      )}
      {submitted && (
        <MessageBar intent="success" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBarBody>You submitted this scorecard. It can no longer be edited.</MessageBarBody>
        </MessageBar>
      )}
      {!submitted && notStarted && (
        <MessageBar intent="info" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBarBody>You can save a draft now; submitting opens when the interview starts ({formatInZone(i.starts_at, tz)}).</MessageBarBody>
        </MessageBar>
      )}
      <ScorecardForm
        key={`${card.status}-${card.submitted_at ?? ""}-${aiDraft.data?.id ?? ""}`}
        kit={kit}
        initial={draftFromScorecard(card, kit)}
        readOnly={submitted || i.status === "cancelled"}
        aiDraft={
          aiDraft.data && aiDraft.data.status !== "superseded"
            ? {
                ratings: aiDraft.data.ratings,
                showByDefault: aiDraft.data.show_suggestions_by_default,
                onShown: () => void interviewAssistantApi.draftOpened(interviewId).catch(() => undefined),
              }
            : null
        }
        error={error}
        onSaveDraft={async (draft) => {
          setError(null);
          try {
            await save.mutateAsync({ body: toScorecardBody(draft), submit: false });
            toast.success("Draft saved");
          } catch (e) {
            setError(interviewError(e));
            throw e;
          }
        }}
        onSubmit={async (draft) => {
          setError(null);
          try {
            await save.mutateAsync({ body: toScorecardBody(draft), submit: true });
            toast.success("Scorecard submitted");
          } catch (e) {
            setError(interviewError(e));
            throw e;
          }
        }}
      />
      <section className={styles.section}>
        <Subtitle2 as="h2">Team scorecards</Subtitle2>
        <ScorecardList interviewId={interviewId} />
      </section>
    </>
  );
}
