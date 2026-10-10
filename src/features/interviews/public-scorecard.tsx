"use client";

import { Body1, Caption1, Card, CardHeader, makeStyles, MessageBar, MessageBarBody, Spinner, Subtitle1, Title3, tokens } from "@fluentui/react-components";
import { CheckmarkCircle48Regular, Clock48Regular, ErrorCircle48Regular } from "@fluentui/react-icons";
import { useEffect, useRef, useState } from "react";
import { ApiError, isApiError } from "@/lib/api/errors";
import { browserTimeZone, formatInZone } from "@/lib/time/zones";
import { type PublicLinkView, publicScorecardApi, publicScorecardState } from "./public-api";
import { ScorecardForm } from "./scorecard-form";
import { draftFromScorecard, kitFromSnapshot, toScorecardBody } from "./scorecard";
import type { PublicScorecardView } from "./types";

const useStyles = makeStyles({
  root: { width: "100%", display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  status: { maxWidth: "560px", padding: tokens.spacingHorizontalL },
  muted: { color: tokens.colorNeutralForeground3 },
});

function StatusCard({ icon, title, children }: { icon: React.ReactElement; title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <Card className={styles.status}>
      <CardHeader image={icon} header={<Subtitle1 as="h1">{title}</Subtitle1>} description={<Body1>{children}</Body1>} />
    </Card>
  );
}

/**
 * Secure-link page for an external interviewer's scorecard (purpose `interview_scorecard`). Rendered by the
 * Epic 6 `/l/[token]` page (which provides the page chrome and width). States: not started yet (time in the browser's zone), the form, submitted, and
 * 404 / 410 / 429 errors. No other scorecards are ever shown here.
 */
export function PublicInterviewScorecard({ token, initialView }: { token: string; initialView?: PublicLinkView | null }) {
  const styles = useStyles();
  const [link, setLink] = useState<PublicLinkView | null>(initialView ?? null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const heading = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLElement>(null);
  const tz = browserTimeZone();

  useEffect(() => {
    if (initialView) return;
    let alive = true;
    publicScorecardApi
      .view(token)
      .then((v) => alive && setLink(v))
      .catch((e) => alive && setLoadError(e));
    return () => {
      alive = false;
    };
  }, [token, initialView]);

  const view: PublicScorecardView | null = link?.scorecard ?? null;
  const fatalSubmit = isApiError(submitError) && [404, 410, 429].includes(submitError.status) ? submitError : null;
  const state = done ? { kind: "submitted" as const, view } : publicScorecardState(view, loadError ?? fatalSubmit ?? (link && !view ? new ApiError(404, "not_found", "") : null));
  const kind = state.kind;
  const firstKind = useRef(kind);

  // Move focus to the page heading / status whenever the state changes after the first render (WCAG 2.4.3).
  useEffect(() => {
    if (kind === firstKind.current) return;
    firstKind.current = kind;
    (heading.current ?? statusRef.current)?.focus();
  }, [kind]);

  const header = view && (
    <div ref={heading} tabIndex={-1}>
      <Caption1 className={styles.muted}>{link?.tenant_name ?? "Interview scorecard"}</Caption1>
      <Title3 as="h1" style={{ display: "block" }}>
        {view.stage_name} interview · {view.candidate_display_name}
      </Title3>
      <Body1 as="p" style={{ margin: 0 }}>
        {view.demand_title ? `${view.demand_title} · ` : ""}
        {formatInZone(view.starts_at, tz, { withYear: true })}
      </Body1>
    </div>
  );

  return (
    <section className={styles.root} aria-live="polite" aria-label="Interview scorecard" ref={statusRef} tabIndex={-1}>
      {state.kind === "loading" && <Spinner label="Loading scorecard…" />}
      {state.kind === "not_found" && (
        <StatusCard icon={<ErrorCircle48Regular aria-hidden />} title="Link not found">
          This scorecard link is not valid. Check that you copied the whole link from the invitation email.
        </StatusCard>
      )}
      {state.kind === "used" && (
        <StatusCard icon={<CheckmarkCircle48Regular aria-hidden />} title="Scorecard already submitted">
          This link was already used to submit a scorecard. Thank you for your feedback.
        </StatusCard>
      )}
      {state.kind === "expired" && (
        <StatusCard icon={<Clock48Regular aria-hidden />} title="This link has expired">
          The window for this scorecard has closed. Contact the recruiter who invited you if you still want to share feedback.
        </StatusCard>
      )}
      {state.kind === "rate_limited" && (
        <StatusCard icon={<Clock48Regular aria-hidden />} title="Too many attempts">
          Please wait a few minutes and try again.
        </StatusCard>
      )}
      {state.kind === "error" && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{state.message}</MessageBarBody>
        </MessageBar>
      )}
      {state.kind === "not_started" && (
        <>
          {header}
          <StatusCard icon={<Clock48Regular aria-hidden />} title="The interview has not started yet">
            The scorecard opens when the interview starts: {formatInZone(state.view.starts_at, tz, { withYear: true })} ({tz.replace(/_/g, " ")}). Keep this link and come
            back afterwards.
          </StatusCard>
        </>
      )}
      {state.kind === "submitted" && (
        <>
          {header}
          <StatusCard icon={<CheckmarkCircle48Regular aria-hidden />} title="Thank you — your scorecard was submitted">
            The hiring team can now see your feedback. You can close this page.
          </StatusCard>
        </>
      )}
      {state.kind === "form" && (
        <>
          {header}
          <PublicForm
            view={state.view}
            error={submitError && !fatalSubmit ? (isApiError(submitError) ? submitError.message : "Something went wrong. Please try again.") : null}
            onSubmit={async (body) => {
              setSubmitError(null);
              try {
                await publicScorecardApi.submit(token, body);
                setDone(true);
              } catch (e) {
                setSubmitError(e);
                throw e;
              }
            }}
          />
        </>
      )}
    </section>
  );
}

function PublicForm({
  view,
  error,
  onSubmit,
}: {
  view: PublicScorecardView;
  error: string | null;
  onSubmit: (body: Parameters<typeof publicScorecardApi.submit>[1]) => Promise<void>;
}) {
  const kit = kitFromSnapshot({ rating_scale: view.rating_scale, competencies: view.competencies, questions: view.questions });
  return (
    <ScorecardForm
      kit={kit}
      initial={draftFromScorecard(null, kit)}
      error={error}
      publicMode
      onSubmit={async (draft) => {
        const body = toScorecardBody(draft);
        await onSubmit({ ratings: body.ratings ?? [], answers: body.answers ?? [], recommendation: draft.recommendation!, summary: body.summary ?? null });
      }}
    />
  );
}
