"use client";

import {
  Body1,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  ProgressBar,
  Spinner,
  Subtitle2,
  Text,
  Textarea,
  tokens,
  typographyStyles, mergeClasses } from "@fluentui/react-components";
import { ArrowUpload20Regular, CheckmarkCircle24Filled, DocumentText20Regular, Sparkle16Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { errorMessage, fieldErrors, isApiError } from "@/lib/api/errors";
import type { PublicApplyForm, PublicNotice } from "@/lib/api/types";
import { ErrorSummary, type SummaryError } from "../error-summary";
import { careersPath, jobPath, portalSignInPath } from "../format";
import { QuestionFields } from "../question-fields";
import { answerDisplay, answersPayload, questionFieldId, validateAnswers } from "../questions";
import { applyApi } from "./api";
import { BotChallenge } from "./bot-challenge";
import { attributionPayload } from "@/features/campaigns/attribution";
import { boardTagFromSearch } from "@/features/job-boards/logic";
import { ApplyFairnessStep } from "@/features/fairness/apply-self-id-step";
import {
  applyErrorMessage,
  applyPrefill,
  clearDraft,
  consentPayload,
  type ConsentState,
  type DetailKey,
  type Details,
  draftKey,
  EMPTY_DETAILS,
  expiryState,
  acceptedExtensions,
  extensionsLabel,
  FIELD_IDS,
  fileError,
  formatBytes,
  linkList,
  loadDraft,
  noticeFor,
  saveDraft,
  type StepIndex,
  STEPS,
  validateConsent,
  validateDetails,
} from "./model";

const useStyles = makeStyles({
  root: { maxWidth: "640px", margin: "0 auto", display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  steps: {
    listStyleType: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: tokens.spacingHorizontalXS,
  },
  stepItem: {
    height: "6px",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorNeutralStroke2,
  },
  stepDone: { backgroundColor: tokens.colorBrandBackground },
  stepCurrent: { backgroundColor: tokens.colorBrandBackground, outline: `2px solid ${tokens.colorBrandStroke2}`, outlineOffset: "1px" },
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    padding: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  card: { padding: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, "@media (max-width: 480px)": { padding: tokens.spacingHorizontalL } },
  title2: { ...typographyStyles.title2, margin: 0 },
  subtitle1: { ...typographyStyles.subtitle1, margin: 0 },
  heading: { ":focus": { outlineStyle: "none" }, ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}` } },
  eyebrow: { color: tokens.colorNeutralForeground2 },
  notice: {
    maxHeight: "240px",
    overflowY: "auto",
    padding: tokens.spacingHorizontalM,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    overflowWrap: "anywhere",
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}` },
  },
  consent: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  checkbox: { minHeight: "44px", alignItems: "center" },
  actions: { display: "flex", justifyContent: "space-between", gap: tokens.spacingHorizontalM, flexWrap: "wrap-reverse" },
  button: { minHeight: "44px", minWidth: "44px" },
  primary: { minHeight: "44px", flexGrow: 1, maxWidth: "280px", marginLeft: "auto", "@media (max-width: 480px)": { maxWidth: "none" } },
  file: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, overflowWrap: "anywhere" },
  input: { minHeight: "44px" },
  prefillHint: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalXXS },
  review: {
    margin: 0,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    rowGap: tokens.spacingVerticalXS,
    "& dt": { color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS },
    "& dd": { margin: 0, overflowWrap: "anywhere", whiteSpace: "pre-line" },
  },
  reviewHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: tokens.spacingHorizontalS },
  done: { padding: tokens.spacingHorizontalXL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, alignItems: "flex-start" },
  doneIcon: { color: tokens.colorPaletteGreenForeground1 },
});

const PARSE_COPY: Record<string, string> = {
  parsed: "We pre-filled your details from your resume. Please check them on the next step.",
  skipped_consent: "We'll keep your file; please fill in your details.",
};

function NoticeBody({ notice, className }: { notice: PublicNotice; className: string }) {
  return (
    <div
      className={className}
      role="region"
      aria-label={notice.title}
      tabIndex={0}
      // notice bodies are rendered and sanitized by the API
      dangerouslySetInnerHTML={{ __html: notice.body_html || notice.body }}
    />
  );
}

/** Mobile-first, 5-step apply flow: privacy → resume → details → questions → review & submit. */
export function ApplyFlow({ slug, orgName, form }: { slug: string; orgName: string; form: PublicApplyForm }) {
  const styles = useStyles();
  const router = useRouter();
  const key = draftKey(slug, form.posting_id);
  const [step, setStep] = useState<StepIndex>(0);
  // Epic 75 (B2): show a one-line notice when the applicant arrived from the Talent OS Jobs network (`?src=job_network`).
  const [fromJobNetwork] = useState(() =>
    typeof window === "undefined" ? false : new URLSearchParams(window.location.search).get("src") === "job_network",
  );
  const [consent, setConsent] = useState<ConsentState>({ data: false, ai: false });
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeKey, setChallengeKey] = useState(0);
  const [session, setSession] = useState<{ token: string; expiresAt: string } | null>(null);
  const [resume, setResume] = useState<{ name: string; size: number } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [parseStatus, setParseStatus] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [prefilled, setPrefilled] = useState<ReadonlySet<DetailKey>>(new Set());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<SummaryError[]>([]);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [focusKey, setFocusKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  const dataNotice = noticeFor(form, "data_processing");
  const aiNotice = noticeFor(form, "ai_processing");
  const marketingNotice = noticeFor(form, "marketing");
  const questions = form.apply_questions;
  const expiry = expiryState(session?.expiresAt ?? null, now);
  const extensions = acceptedExtensions(form.accepted_types);
  const typesLabel = extensionsLabel(extensions);

  // Move focus to the step heading whenever the step changes (not on first paint).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  // Keep the text draft (never the file or the token) for a reload within this tab.
  useEffect(() => {
    if (session && !done) saveDraft(key, { details, answers });
  }, [key, session, details, answers, done]);

  useEffect(() => {
    if (!session) return;
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, [session]);

  const fail = (list: SummaryError[], fields: Record<string, string> = {}) => {
    setErrors(list);
    setFieldErr(fields);
    setFocusKey((k) => k + 1);
  };
  const clearErrors = () => {
    setErrors([]);
    setFieldErr({});
  };
  const go = (next: StepIndex) => {
    clearErrors();
    setStep(next);
  };

  const apiFail = (e: unknown, fieldId: string) => {
    if (isApiError(e)) {
      if (e.code === "challenge_failed") {
        setChallengeToken(null);
        setChallengeKey((k) => k + 1);
      }
      if (e.code === "notice_outdated") router.refresh();
      if (e.code === "apply_session_expired" || e.code === "apply_session_not_found") setSession(null);
      const fields = fieldErrors(e);
      const message = applyErrorMessage(e.code, e.status, errorMessage(e));
      const perField = Object.entries(fields).map(([k, m]) => ({ id: FIELD_IDS[k as keyof typeof FIELD_IDS] ?? questionFieldId(k), message: m }));
      fail(perField.length ? perField : [{ id: fieldId, message }], fields);
      return;
    }
    fail([{ id: fieldId, message: "Something went wrong. Please try again." }]);
  };

  // ---------------------------------------------------------------- step handlers
  async function continuePrivacy() {
    if (session) return go(1);
    const errs = validateConsent(form, consent, challengeToken);
    if (Object.keys(errs).length) return fail(Object.entries(errs).map(([id, message]) => ({ id, message })), errs);
    setBusy(true);
    try {
      const s = await applyApi.createSession(slug, form.posting_id, {
        consents: consentPayload(form, consent),
        challenge_token: challengeToken,
        // Epic 70: job board attribution from the apply link (`?src=naukri&bp=<id>`); unknown tags are ignored.
        ...boardTagFromSearch(typeof window === "undefined" ? "" : window.location.search),
      } as Parameters<typeof applyApi.createSession>[2]);
      setSession({ token: s.apply_token, expiresAt: s.expires_at });
      setNow(Date.now());
      // Restore a text draft from an earlier attempt in this tab (e.g. after a reload).
      const draft = loadDraft(key);
      if (draft) {
        setDetails(draft.details);
        setAnswers(draft.answers);
      }
      go(1);
    } catch (e) {
      apiFail(e, FIELD_IDS.dataConsent);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    if (!session) return;
    const err = fileError(file, form.max_upload_mb, extensions);
    if (err) return fail([{ id: FIELD_IDS.resume, message: err }], { resume: err });
    clearErrors();
    setBusy(true);
    setProgress(0);
    setParseStatus(null);
    try {
      const result = await applyApi.uploadResume(slug, session.token, file, setProgress);
      setResume({ name: file.name, size: file.size });
      setParseStatus(result.parse_status);
      const merged = applyPrefill(details, result.prefill);
      setDetails(merged.details);
      setPrefilled((prev) => new Set([...prev, ...merged.filled]));
    } catch (e) {
      apiFail(e, FIELD_IDS.resume);
    } finally {
      setBusy(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function continueResume() {
    if (!resume) return fail([{ id: FIELD_IDS.resume, message: "Upload your resume to continue" }], { resume: "Upload your resume to continue" });
    go(2);
  }

  function continueDetails() {
    const errs = validateDetails(details, form.requires_phone);
    const list = (Object.keys(errs) as DetailKey[]).map((k) => ({ id: FIELD_IDS[k], message: errs[k] as string }));
    if (list.length) return fail(list, errs as Record<string, string>);
    go(3);
  }

  function continueQuestions() {
    const errs = validateAnswers(questions, answers);
    const list = questions.filter((q) => errs[q.key]).map((q) => ({ id: questionFieldId(q.key), message: `${q.label}: ${errs[q.key]}` }));
    if (list.length) return fail(list, errs);
    go(4);
  }

  async function submit() {
    if (!session) return;
    setBusy(true);
    clearErrors();
    try {
      await applyApi.submit(slug, session.token, {
        full_name: details.full_name.trim(),
        email: details.email.trim(),
        phone: details.phone.trim() || null,
        location: details.location.trim() || null,
        links: linkList(details.links),
        answers: answersPayload(questions, answers),
        marketing_consent_notice_id: marketing && marketingNotice ? marketingNotice.id : null,
        // Epic 39: campaign attribution token from `?tos_ct` (job links in marketing messages).
        ...attributionPayload(),
      });
      clearDraft(key);
      setDone(true);
    } catch (e) {
      apiFail(e, "apply-submit");
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setSession(null);
    setResume(null);
    setParseStatus(null);
    setChallengeToken(null);
    setChallengeKey((k) => k + 1);
    go(0);
  }

  const setDetail = (k: DetailKey, v: string) => {
    setDetails((d) => ({ ...d, [k]: v }));
    if (fieldErr[k]) setFieldErr((f) => ({ ...f, [k]: "" }));
  };

  const detailField = (k: DetailKey, label: string, input: React.ReactNode, opts: { required?: boolean; hint?: string } = {}) => (
    <Field
      label={label}
      required={opts.required}
      validationState={fieldErr[k] ? "error" : "none"}
      validationMessage={fieldErr[k] || undefined}
      hint={
        prefilled.has(k) ? (
          <span className={styles.prefillHint}>
            <Sparkle16Regular aria-hidden /> From your resume — please check
          </span>
        ) : (
          opts.hint
        )
      }
    >
      {input}
    </Field>
  );

  const reviewItems = useMemo(
    () => [
      { label: "Full name", value: details.full_name },
      { label: "Email", value: details.email },
      { label: "Phone", value: details.phone || "Not given" },
      { label: "Location", value: details.location || "Not given" },
      { label: "Links", value: linkList(details.links).join("\n") || "None" },
    ],
    [details],
  );

  if (done) {
    return (
      <div className={styles.root}>
        <Card className={styles.done}>
          <CheckmarkCircle24Filled aria-hidden className={styles.doneIcon} />
          <h1 ref={doneRef} tabIndex={-1} className={mergeClasses(styles.heading, styles.title2)}>
            Application received
          </h1>
          <Body1>Thank you for applying for {form.title}.</Body1>
          <Body1>Check your email for a link to follow your application. The link works once and expires after a while; you can always ask for a new one.</Body1>
          <div className={styles.actions} style={{ width: "100%" }}>
            <Button as="a" href={careersPath(slug)} className={styles.button}>
              Browse more jobs
            </Button>
            <Button as="a" href={portalSignInPath(slug)} appearance="primary" className={styles.button}>
              Go to the candidate portal
            </Button>
          </div>
        </Card>
        {session && <ApplyFairnessStep slug={slug} postingId={form.posting_id} applyToken={session.token} />}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div>
        <Text as="p" className={styles.eyebrow}>
          Applying for{" "}
          <a href={jobPath(slug, form.posting_id)} style={{ color: "inherit" }}>
            {form.title}
          </a>
        </Text>
        <ol className={styles.steps} aria-label="Application progress">
          {STEPS.map((name, i) => (
            <li
              key={name}
              className={mergeClasses(styles.stepItem, i < step ? styles.stepDone : "", i === step ? styles.stepCurrent : "")}
              aria-current={i === step ? "step" : undefined}
            >
              <span className={styles.srOnly}>
                {name}
                {i < step ? " (completed)" : i === step ? " (current step)" : ""}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {expiry === "warning" && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Your session ends soon</MessageBarTitle>
            Submit your application within the next few minutes, or you will need to start again (your typed answers are kept).
          </MessageBarBody>
        </MessageBar>
      )}
      {expiry === "expired" && (
        <MessageBar intent="error" layout="multiline" role="alert">
          <MessageBarBody>
            <MessageBarTitle>Your session has expired</MessageBarTitle>
            For your privacy, unfinished applications are cleared. Start again; your typed answers are kept.
          </MessageBarBody>
          <Button onClick={restart} className={styles.button}>
            Start again
          </Button>
        </MessageBar>
      )}

      <Card className={styles.card}>
        <div>
          <Text as="p" className={styles.eyebrow}>
            Step {step + 1} of {STEPS.length}
          </Text>
          <h1 ref={headingRef} tabIndex={-1} className={mergeClasses(styles.heading, styles.subtitle1)}>
            {STEPS[step]}
          </h1>
        </div>

        <ErrorSummary errors={errors} focusKey={focusKey} />

        {step === 0 && (
          <>
            {fromJobNetwork && (
              <Body1>You found this job on Talent OS Jobs. Your application goes only to {orgName}.</Body1>
            )}
            <Body1>
              Before you share your resume, please read how {orgName} will use your information. Your choices are recorded before anything is uploaded.
            </Body1>
            {!dataNotice ? (
              <MessageBar intent="warning">
                <MessageBarBody>Applications are not open right now. Please try again later.</MessageBarBody>
              </MessageBar>
            ) : (
              <div className={styles.consent}>
                <Subtitle2 as="h2">{dataNotice.title}</Subtitle2>
                <NoticeBody notice={dataNotice} className={styles.notice} />
                <Field required validationState={fieldErr[FIELD_IDS.dataConsent] ? "error" : "none"} validationMessage={fieldErr[FIELD_IDS.dataConsent] || undefined}>
                  <Checkbox
                    id={FIELD_IDS.dataConsent}
                    className={styles.checkbox}
                    checked={consent.data}
                    disabled={!!session}
                    required
                    onChange={(_, d) => setConsent((c) => ({ ...c, data: !!d.checked }))}
                    label={`I agree to ${orgName} processing my personal data to consider my application (required)`}
                  />
                </Field>
              </div>
            )}
            {aiNotice && (
              <div className={styles.consent}>
                <Subtitle2 as="h2">{aiNotice.title}</Subtitle2>
                <NoticeBody notice={aiNotice} className={styles.notice} />
                <Checkbox
                  className={styles.checkbox}
                  checked={consent.ai}
                  disabled={!!session}
                  onChange={(_, d) => setConsent((c) => ({ ...c, ai: !!d.checked }))}
                  label="Use AI to read my resume (optional) — lets us pre-fill from your resume"
                />
              </div>
            )}
            {session ? (
              <MessageBar intent="info">
                <MessageBarBody>Your privacy choices are saved for this application.</MessageBarBody>
              </MessageBar>
            ) : (
              <BotChallenge
                key={challengeKey}
                id={FIELD_IDS.challenge}
                provider={form.challenge.provider}
                siteKey={form.challenge.site_key}
                onToken={setChallengeToken}
                error={fieldErr[FIELD_IDS.challenge] || undefined}
              />
            )}
            <div className={styles.actions}>
              <Button
                appearance="primary"
                className={styles.primary}
                onClick={continuePrivacy}
                disabled={busy || !dataNotice}
                icon={busy ? <Spinner size="tiny" /> : undefined}
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Body1>
              Upload your resume as {typesLabel}, up to {form.max_upload_mb} MB.
              {!consent.ai && " We'll keep your file; please fill in your details on the next step."}
            </Body1>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept={extensions.join(",")}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
            />
            <Field
              label="Resume"
              required
              validationState={fieldErr.resume ? "error" : "none"}
              validationMessage={fieldErr.resume || undefined}
              hint={`${typesLabel} · max ${form.max_upload_mb} MB`}
            >
              <Button
                id={FIELD_IDS.resume}
                icon={<ArrowUpload20Regular />}
                className={styles.button}
                disabled={busy || expiry === "expired"}
                onClick={() => fileRef.current?.click()}
              >
                {resume ? "Replace file" : "Choose file"}
              </Button>
            </Field>
            {progress !== null && (
              <Field label="Uploading" validationState="none" hint={`${Math.round(progress * 100)}%`}>
                <ProgressBar value={progress} max={1} aria-label="Upload progress" />
              </Field>
            )}
            {resume && (
              <div className={styles.file} aria-live="polite">
                <DocumentText20Regular aria-hidden />
                <Text>
                  {resume.name} ({formatBytes(resume.size)}) uploaded
                </Text>
              </div>
            )}
            {parseStatus && (
              <MessageBar intent={parseStatus === "parsed" ? "success" : "info"} layout="multiline">
                <MessageBarBody>{PARSE_COPY[parseStatus] ?? "We couldn't read details from this file. We'll keep it; please fill in your details."}</MessageBarBody>
              </MessageBar>
            )}
            <div className={styles.actions}>
              <Button className={styles.button} onClick={() => go(0)} disabled={busy}>
                Back
              </Button>
              <Button appearance="primary" className={styles.primary} onClick={continueResume} disabled={busy}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {detailField(
              "full_name",
              "Full name",
              <Input id={FIELD_IDS.full_name} className={styles.input} autoComplete="name" value={details.full_name} maxLength={200} onChange={(_, d) => setDetail("full_name", d.value)} />,
              { required: true },
            )}
            {detailField(
              "email",
              "Email",
              <Input id={FIELD_IDS.email} className={styles.input} type="email" autoComplete="email" inputMode="email" value={details.email} onChange={(_, d) => setDetail("email", d.value)} />,
              { required: true, hint: "We'll send your confirmation and portal link here." },
            )}
            {detailField(
              "phone",
              "Phone",
              <Input id={FIELD_IDS.phone} className={styles.input} type="tel" autoComplete="tel" inputMode="tel" value={details.phone} maxLength={40} onChange={(_, d) => setDetail("phone", d.value)} />,
              { required: form.requires_phone, hint: "Include the country code, e.g. +91 98765 43210" },
            )}
            {detailField(
              "location",
              "Location",
              <Input id={FIELD_IDS.location} className={styles.input} autoComplete="address-level2" value={details.location} maxLength={200} onChange={(_, d) => setDetail("location", d.value)} />,
              { hint: "City and country" },
            )}
            {detailField(
              "links",
              "Links",
              <Textarea id={FIELD_IDS.links} value={details.links} resize="vertical" onChange={(_, d) => setDetail("links", d.value)} />,
              { hint: "LinkedIn, portfolio or GitHub — one per line (optional)" },
            )}
            <div className={styles.actions}>
              <Button className={styles.button} onClick={() => go(1)}>
                Back
              </Button>
              <Button appearance="primary" className={styles.primary} onClick={continueDetails}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            {questions.length === 0 ? (
              <Body1>There are no additional questions for this job.</Body1>
            ) : (
              <QuestionFields
                questions={questions}
                drafts={answers}
                errors={fieldErr}
                onChange={(k, v) => {
                  setAnswers((a) => ({ ...a, [k]: v }));
                  if (fieldErr[k]) setFieldErr((f) => ({ ...f, [k]: "" }));
                }}
              />
            )}
            <div className={styles.actions}>
              <Button className={styles.button} onClick={() => go(2)}>
                Back
              </Button>
              <Button appearance="primary" className={styles.primary} onClick={continueQuestions}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <section aria-labelledby="review-details">
              <div className={styles.reviewHead}>
                <Subtitle2 as="h2" id="review-details">
                  Your details
                </Subtitle2>
                <Button appearance="subtle" className={styles.button} onClick={() => go(2)} aria-label="Change your details">
                  Change
                </Button>
              </div>
              <dl className={styles.review}>
                {reviewItems.map((r) => (
                  <div key={r.label}>
                    <dt>{r.label}</dt>
                    <dd>{r.value}</dd>
                  </div>
                ))}
                <div>
                  <dt>Resume</dt>
                  <dd>{resume?.name ?? "—"}</dd>
                </div>
              </dl>
            </section>
            {questions.length > 0 && (
              <section aria-labelledby="review-answers">
                <div className={styles.reviewHead}>
                  <Subtitle2 as="h2" id="review-answers">
                    Your answers
                  </Subtitle2>
                  <Button appearance="subtle" className={styles.button} onClick={() => go(3)} aria-label="Change your answers">
                    Change
                  </Button>
                </div>
                <dl className={styles.review}>
                  {questions.map((q) => (
                    <div key={q.key}>
                      <dt>{q.label}</dt>
                      <dd>{answerDisplay(q, answers[q.key])}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {marketingNotice && (
              <div className={styles.consent}>
                <details>
                  <summary style={{ cursor: "pointer", minHeight: 32 }}>{marketingNotice.title}</summary>
                  <NoticeBody notice={marketingNotice} className={styles.notice} />
                </details>
                <Checkbox
                  className={styles.checkbox}
                  checked={marketing}
                  onChange={(_, d) => setMarketing(!!d.checked)}
                  label={`Send me news about other jobs at ${orgName} (optional)`}
                />
              </div>
            )}
            <div className={styles.actions}>
              <Button className={styles.button} onClick={() => go(3)} disabled={busy}>
                Back
              </Button>
              <Button
                id="apply-submit"
                appearance="primary"
                className={styles.primary}
                onClick={submit}
                disabled={busy || expiry === "expired"}
                icon={busy ? <Spinner size="tiny" /> : undefined}
              >
                Submit application
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
