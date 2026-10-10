"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Spinner,
  Text,
  Textarea,
  tokens,
  typographyStyles,
} from "@fluentui/react-components";
import {
  CheckmarkCircle48Regular,
  DismissCircle48Regular,
  ErrorCircle48Regular,
  LockClosed20Regular,
} from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { MarkdownView } from "@/features/privacy/markdown-view";
import { QuestionField } from "@/features/screening/question-field";
import { type Answers, type AnswerValue, cleanAnswers, validateAnswers } from "@/features/screening/validation";
import { isApiError } from "@/lib/api/errors";
import type { FeedbackDecision, PublicLinkView } from "@/lib/api/types";
import { PublicInterviewScorecard } from "@/features/interviews/public-scorecard";
import { PublicOfferResponse } from "@/features/offers/public-offer-response";
import { PublicChannelOptOut } from "@/features/messaging/public-opt-out";
import { PublicEsignPage } from "@/features/esign/public-esign-page";
import { PublicJoiningConfirmation } from "@/features/placements/public-joining";
import { PublicVendorNotice } from "@/features/vendor-portal/public-notice";
import { PublicProviderCheck } from "@/features/bgv/public-provider-check";
import { PublicReference } from "@/features/references/public-reference";
import { PublicSlotPick } from "./slot-pick-page";
import { PublicExtensionConfirmation, PublicOffboardingConfirmation } from "@/features/placement-exit/public-exit-links";
import { PublicClientApproval } from "@/features/client-portal/public-client-approval";
import { PublicImmigrationUpload } from "@/features/immigration/public-immigration-upload";
import { PublicAssessmentAttempt } from "@/features/assessments/taking";
import { PublicReferral } from "@/features/referrals/public-referral";
import { CampusLinkRedirect } from "@/features/campus/public/campus-link-redirect";
import { PublicScreeningChat } from "@/features/agents/screening/public-chat";
import { PublicCaptureAck, PublicRecordingConsent } from "@/features/agents/interview-assistant/public-consent";
import { PublicVoiceConsent } from "@/features/voice/public-consent";
import { publicLinkApi } from "./api";
import {
  CONSENT_PURPOSE_LABELS,
  clearDraft,
  DECISION_LABELS,
  linkErrorCopy,
  loadDraft,
  type PublicScreen,
  saveDraft,
  screenFor,
} from "./logic";

const useStyles = makeStyles({
  page: {
    minHeight: "100svh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    minHeight: "48px",
    paddingInline: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  brand: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase400, overflowWrap: "anywhere" },
  main: {
    flex: 1,
    width: "100%",
    maxWidth: "680px",
    marginInline: "auto",
    boxSizing: "border-box",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalL}`,
    "@media (max-width: 480px)": { padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalM}` },
  },
  card: { padding: tokens.spacingHorizontalXL, gap: tokens.spacingVerticalL, "@media (max-width: 480px)": { padding: tokens.spacingHorizontalL } },
  heading: { ...typographyStyles.title2, margin: 0, ":focus": { outlineStyle: "none" }, ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}` }, overflowWrap: "anywhere" },
  muted: { color: tokens.colorNeutralForeground3 },
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    "& button": { minHeight: "44px", minWidth: "120px" },
    "@media (max-width: 480px)": { flexDirection: "column", "& button": { width: "100%" } },
  },
  notice: {
    maxHeight: "320px",
    overflowY: "auto",
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  state: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: tokens.spacingVerticalM },
  success: { color: tokens.colorPaletteGreenForeground1 },
  danger: { color: tokens.colorPaletteRedForeground1 },
  radios: { "& .fui-Radio": { minHeight: "44px", alignItems: "center" } },
  footer: { textAlign: "center", padding: tokens.spacingVerticalL, color: tokens.colorNeutralForeground3 },
});

/** Heading that takes focus whenever the screen changes (screen readers announce the new state). */
function Heading({ children, focusKey }: { children: React.ReactNode; focusKey: string }) {
  const styles = useStyles();
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [focusKey]);
  return (
    <h1 ref={ref} tabIndex={-1} className={styles.heading}>
      {children}
    </h1>
  );
}

function ErrorLive({ message }: { message: string | null }) {
  // Always rendered so assistive tech picks up the change.
  return (
    <div aria-live="assertive" role="alert">
      {message && (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>{message}</MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}

function actionError(e: unknown): { message: string; fatal: boolean } {
  if (isApiError(e)) {
    const copy = linkErrorCopy(e.status, e.code);
    if (e.status === 410 || e.status === 404) return { message: `${copy.title}. ${copy.body}`, fatal: true };
    if (e.status === 422 || e.status === 409) return { message: e.message || copy.body, fatal: false };
    return { message: `${copy.title}. ${copy.body}`, fatal: false };
  }
  return { message: "Something went wrong. Please try again.", fatal: false };
}

/** `/l/[token]`: public secure-link page rendered by the link's purpose, outside the app shell. */
export function PublicLinkPage({ token }: { token: string }) {
  const styles = useStyles();
  const view = useQuery({
    queryKey: ["public-link", token],
    queryFn: ({ signal }) => publicLinkApi.view(token, signal),
    retry: (count, e) => count < 1 && (!isApiError(e) || e.status === 0 || e.status >= 500),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <LockClosed20Regular aria-hidden />
        <span className={styles.brand}>{view.data?.tenant_name || "Talent OS"}</span>
      </header>
      <main className={styles.main}>
        {view.isPending ? (
          <Card className={styles.card}>
            <Spinner label="Loading…" />
          </Card>
        ) : view.isError ? (
          <ErrorState error={view.error} />
        ) : (
          <LinkContent token={token} view={view.data} />
        )}
      </main>
      <footer className={styles.footer}>
        <Caption1>Secure link · Do not forward this page</Caption1>
      </footer>
    </div>
  );
}

function ErrorState({ error }: { error: unknown }) {
  const styles = useStyles();
  const copy = isApiError(error) ? linkErrorCopy(error.status, error.code) : linkErrorCopy(500, undefined);
  return (
    <Card className={styles.card}>
      <div className={styles.state}>
        <ErrorCircle48Regular aria-hidden className={styles.danger} />
        <Heading focusKey={`error-${copy.title}`}>{copy.title}</Heading>
        <Body1>{copy.body}</Body1>
      </div>
    </Card>
  );
}

function LinkContent({ token, view }: { token: string; view: PublicLinkView }) {
  const [screen, setScreen] = useState<PublicScreen | "done" | "declined" | "error">(() => screenFor(view));
  const [fatal, setFatal] = useState<unknown>(null);
  if (fatal) return <ErrorState error={fatal} />;
  // Epic 7 / 8 purposes render their own feature components.
  if (view.purpose === "interview_scorecard") return <PublicInterviewScorecard token={token} initialView={view} />;
  if (view.purpose === "offer_response") return <PublicOfferResponse token={token} initialView={view} />;
  if (view.purpose === "esign") return <PublicEsignPage token={token} view={view} />;
  if (view.purpose === "channel_opt_out") return <PublicChannelOptOut token={token} view={view} />;
  if (view.purpose === "joining_confirmation") return <PublicJoiningConfirmation token={token} view={view} />;
  if (view.purpose === "vendor_data_notice") return <PublicVendorNotice token={token} view={view} />;
  if (view.purpose === "bgv_provider_check") return <PublicProviderCheck token={token} />;
  if (view.purpose === "reference_check") return <PublicReference token={token} />;
  // Epic 31: purpose strings compared as plain strings (generated union may predate them).
  if ((view.purpose as string) === "extension_confirmation") return <PublicExtensionConfirmation token={token} />;
  if ((view.purpose as string) === "offboarding_confirmation") return <PublicOffboardingConfirmation token={token} />;
  // Epic 18: Client User approval link.
  if ((view.purpose as string) === "client_approval") return <PublicClientApproval token={token} />;
  // Epic 46: immigration document upload (counsel / no-portal candidate).
  if ((view.purpose as string) === "immigration_upload") return <PublicImmigrationUpload token={token} />;
  // Epic 40: candidate takes an assessment (shares taking.tsx with the candidate portal).
  if ((view.purpose as string) === "assessment_attempt") return <PublicAssessmentAttempt token={token} />;
  // Epic 42: referee accepts / declines a referral, or self-submits through a share link.
  if ((view.purpose as string) === "referral_link") return <PublicReferral token={token} />;
  // Epic 57: Screening Agent chat by secure link (same chat component as the portal, no portal chrome).
  if ((view.purpose as string) === "agent_conversation") return <PublicScreeningChat token={token} />;
  // Epic 59: Scheduling Agent self-scheduling page ("Pick a time").
  if ((view.purpose as string) === "slot_pick") return <PublicSlotPick token={token} />;
  // Epic 60: interview recording consent (Candidate) and recording agreement (external interviewer).
  if ((view.purpose as string) === "interview_recording_consent") return <PublicRecordingConsent token={token} />;
  if ((view.purpose as string) === "interview_capture_ack") return <PublicCaptureAck token={token} />;
  // Epic 58: voice screening call / recording consent (Candidate).
  if ((view.purpose as string) === "voice_consent") return <PublicVoiceConsent token={token} />;
  // Epic 43: campus drive registration and recruitment event links have their own public pages.
  if ((view.purpose as string) === "campus_registration" || (view.purpose as string) === "event_checkin")
    return <CampusLinkRedirect purpose={view.purpose as string} token={token} />;
  switch (screen) {
    case "screening_consent":
      return (
        <ConsentCard
          token={token}
          view={view}
          intro={`Before you answer a few questions about the ${view.job_title ?? "role"} role, ${view.tenant_name ?? "the recruiter"} asks for your consent to process your answers with AI assistance.`}
          onDone={(granted) => setScreen(granted ? "screening_questions" : "screening_declined")}
          onFatal={setFatal}
        />
      );
    case "screening_questions":
      return <QuestionsCard token={token} view={view} onDone={() => setScreen("screening_done")} onFatal={setFatal} />;
    case "screening_done":
      return (
        <DoneState
          title="Thank you — your answers were sent"
          body={`${view.tenant_name ?? "The recruiter"} will review your answers and get back to you.`}
        />
      );
    case "screening_declined":
      return (
        <DoneState
          declined
          title="You declined AI-assisted screening"
          body="Your choice was recorded. The recruiter will contact you about other ways to continue."
        />
      );
    case "screening_closed":
      return <DoneState declined title="This screening is closed" body="There is nothing more to do on this page." />;
    case "consent_request":
      return (
        <ConsentCard
          token={token}
          view={view}
          intro={consentIntro(view)}
          onDone={(granted) => setScreen(granted ? "done" : "declined")}
          onFatal={setFatal}
        />
      );
    case "client_feedback":
      return <FeedbackCard token={token} view={view} onDone={() => setScreen("done")} onFatal={setFatal} />;
    case "done":
      return view.purpose === "client_feedback" ? (
        <DoneState title="Thank you — your feedback was recorded" body={`${view.tenant_name ?? "The recruiter"} has been notified.`} />
      ) : (
        <DoneState title="Thank you — your consent was recorded" body="You can withdraw your consent at any time by contacting the sender." />
      );
    case "declined":
      return <DoneState declined title="Your choice was recorded" body="You have not given consent. Nothing more is needed from you." />;
    default:
      return (
        <DoneState
          declined
          title="This page cannot be shown here"
          body="Open the link from the email you received, or contact the sender for help."
        />
      );
  }
}

function consentIntro(view: PublicLinkView): string {
  const who = view.tenant_name ?? "The recruiter";
  const purpose = view.notice?.purpose ? CONSENT_PURPOSE_LABELS[view.notice.purpose] : undefined;
  if (view.client_name) return `${who} would like to share your profile with ${view.client_name}. Please read the notice below and tell us whether you agree.`;
  return `${who} asks for your consent${purpose ? ` to ${purpose}` : ""}. Please read the notice below and tell us whether you agree.`;
}

function DoneState({ title, body, declined }: { title: string; body: string; declined?: boolean }) {
  const styles = useStyles();
  return (
    <Card className={styles.card}>
      <div className={styles.state} role="status">
        {declined ? (
          <DismissCircle48Regular aria-hidden className={styles.muted} />
        ) : (
          <CheckmarkCircle48Regular aria-hidden className={styles.success} />
        )}
        <Heading focusKey={title}>{title}</Heading>
        <Body1>{body}</Body1>
        <Caption1 className={styles.muted}>You can close this page.</Caption1>
      </div>
    </Card>
  );
}

function ConsentCard({
  token,
  view,
  intro,
  onDone,
  onFatal,
}: {
  token: string;
  view: PublicLinkView;
  intro: string;
  onDone: (granted: boolean) => void;
  onFatal: (e: unknown) => void;
}) {
  const styles = useStyles();
  const [busy, setBusy] = useState<"agree" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const noticeId = useId();

  const respond = async (granted: boolean) => {
    setBusy(granted ? "agree" : "decline");
    setError(null);
    try {
      await publicLinkApi.consent(token, granted, view.notice?.id ?? null);
      onDone(granted);
    } catch (e) {
      const { message, fatal } = actionError(e);
      if (fatal) onFatal(e);
      else setError(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className={styles.card}>
      <div className={styles.stack}>
        <Heading focusKey="consent">{view.notice?.title ?? "Your consent"}</Heading>
        <Body1>{intro}</Body1>
        {view.notice ? (
          <section className={styles.notice} aria-labelledby={noticeId} tabIndex={0}>
            <Text id={noticeId} weight="semibold" block>
              Privacy notice (version {view.notice.version})
            </Text>
            <MarkdownView source={view.notice.body_md} />
          </section>
        ) : (
          <Body1 className={styles.muted}>The privacy notice is not available. You can still decline.</Body1>
        )}
        <ErrorLive message={error} />
        <div className={styles.actions}>
          <Button appearance="primary" size="large" disabled={!!busy} onClick={() => respond(true)}>
            {busy === "agree" ? <Spinner size="tiny" label="Saving…" /> : "I agree"}
          </Button>
          <Button size="large" disabled={!!busy} onClick={() => respond(false)}>
            {busy === "decline" ? <Spinner size="tiny" label="Saving…" /> : "I do not agree"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function QuestionsCard({
  token,
  view,
  onDone,
  onFatal,
}: {
  token: string;
  view: PublicLinkView;
  onDone: () => void;
  onFatal: (e: unknown) => void;
}) {
  const styles = useStyles();
  const questions = view.questions ?? [];
  const [answers, setAnswers] = useState<Answers>(() => loadDraft(token) as Answers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: string, value: AnswerValue) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    saveDraft(token, next);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateAnswers(questions, answers, true);
    setErrors(found);
    const count = Object.keys(found).length;
    if (count) {
      setError(`Please answer ${count === 1 ? "1 question" : `${count} questions`} marked below.`);
      document.getElementById(`q-${Object.keys(found)[0]}`)?.querySelector<HTMLElement>("input, textarea, button")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await publicLinkApi.submit(token, cleanAnswers(questions, answers));
      clearDraft(token);
      onDone();
    } catch (err) {
      if (isApiError(err) && err.status === 422 && err.details.fields && typeof err.details.fields === "object") {
        const fields = err.details.fields as Record<string, string>;
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k.replace(/^answers\./, ""), String(v)])));
        setError("Please check the answers marked below.");
      } else {
        const { message, fatal } = actionError(err);
        if (fatal) onFatal(err);
        else setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={styles.card}>
      <form className={styles.stack} onSubmit={submit} noValidate>
        <Heading focusKey="questions">{view.job_title ? `Questions for the ${view.job_title} role` : "A few questions"}</Heading>
        <Body1>
          Please answer the questions below. Questions marked with an asterisk (*) are required. Your answers are
          saved in this browser tab until you send them.
        </Body1>
        {questions.map((q) => (
          <div key={q.key} id={`q-${q.key}`}>
            <QuestionField question={q} value={answers[q.key]} onChange={(v) => set(q.key, v)} error={errors[q.key] || undefined} large disabled={busy} />
          </div>
        ))}
        <ErrorLive message={error} />
        <div className={styles.actions}>
          <Button appearance="primary" size="large" type="submit" disabled={busy}>
            {busy ? <Spinner size="tiny" label="Sending…" /> : "Send answers"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function FeedbackCard({
  token,
  view,
  onDone,
  onFatal,
}: {
  token: string;
  view: PublicLinkView;
  onDone: () => void;
  onFatal: (e: unknown) => void;
}) {
  const styles = useStyles();
  const decisions = (view.decisions?.length ? view.decisions : ["interested", "on_hold", "rejected"]) as FeedbackDecision[];
  const [decision, setDecision] = useState<FeedbackDecision | "">(view.decision ?? "");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const candidate = view.candidate_first_name || "the candidate";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision) {
      setError("Choose your decision.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await publicLinkApi.feedback(token, decision, comment.trim() || null);
      onDone();
    } catch (err) {
      const { message, fatal } = actionError(err);
      if (fatal) onFatal(err);
      else setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={styles.card}>
      <form className={styles.stack} onSubmit={submit} noValidate>
        <Heading focusKey="feedback">Your feedback on {candidate}</Heading>
        <Body1>
          {view.tenant_name ?? "We"} submitted {candidate}
          {view.job_title ? ` for the ${view.job_title} role` : ""}. Confirm your decision below — nothing is recorded
          until you select Confirm.
        </Body1>
        <Field label="Decision" required>
          <RadioGroup className={styles.radios} value={decision} onChange={(_, d) => setDecision(d.value as FeedbackDecision)} disabled={busy}>
            {decisions.map((d) => (
              <Radio key={d} value={d} label={DECISION_LABELS[d] ?? d} />
            ))}
          </RadioGroup>
        </Field>
        <Field label="Comment (optional)" hint="Shared with the recruiter only.">
          <Textarea value={comment} onChange={(_, d) => setComment(d.value)} maxLength={4000} resize="vertical" disabled={busy} />
        </Field>
        <ErrorLive message={error} />
        <div className={styles.actions}>
          <Button appearance="primary" size="large" type="submit" disabled={busy}>
            {busy ? <Spinner size="tiny" label="Saving…" /> : "Confirm"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
