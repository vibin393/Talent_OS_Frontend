"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  tokens,
  typographyStyles,
} from "@fluentui/react-components";
import { CheckmarkCircle48Regular, DismissCircle48Regular, ErrorCircle48Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { BotChallenge } from "@/features/careers/apply/bot-challenge";
import { FileDrop } from "@/features/candidates/file-drop";
import { MarkdownView } from "@/features/privacy/markdown-view";
import { isApiError } from "@/lib/api/errors";
import { publicReferralApi } from "./api";
import { formatDate, publicReferralError, publicReferralScreen, RESUME_ACCEPT, selfSubmitErrors } from "./logic";
import type { PublicReferralView } from "./types";

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingHorizontalXL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    boxSizing: "border-box",
    "@media (max-width: 480px)": { padding: tokens.spacingHorizontalL },
  },
  heading: {
    ...typographyStyles.title2,
    margin: 0,
    overflowWrap: "anywhere",
    ":focus": { outlineStyle: "none" },
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}` },
  },
  muted: { color: tokens.colorNeutralForeground3 },
  notice: {
    maxHeight: "320px",
    overflowY: "auto",
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  checkbox: { minHeight: "44px", alignItems: "center" },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    "& button": { minHeight: "44px", minWidth: "120px" },
    "@media (max-width: 480px)": { flexDirection: "column", "& button": { width: "100%" } },
  },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  input: { minHeight: "44px" },
  state: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: tokens.spacingVerticalM },
  success: { color: tokens.colorPaletteGreenForeground1 },
  danger: { color: tokens.colorPaletteRedForeground1 },
});

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

function StateCard({ title, body, tone }: { title: string; body: string; tone: "success" | "declined" | "error" }) {
  const styles = useStyles();
  return (
    <Card className={styles.card}>
      <div className={styles.state} role={tone === "error" ? "alert" : "status"}>
        {tone === "success" ? (
          <CheckmarkCircle48Regular aria-hidden className={styles.success} />
        ) : tone === "declined" ? (
          <DismissCircle48Regular aria-hidden className={styles.muted} />
        ) : (
          <ErrorCircle48Regular aria-hidden className={styles.danger} />
        )}
        <Heading focusKey={title}>{title}</Heading>
        <Body1>{body}</Body1>
        {tone !== "error" && <Caption1 className={styles.muted}>You can close this page.</Caption1>}
      </div>
    </Card>
  );
}

/** Purpose `referral_link` (`/l/[token]`): the referee accepts / declines the notice (upload channel) or submits
 * their own details (share channel). Nothing is processed before the notice is accepted. Works from 360 px. */
export function PublicReferral({ token }: { token: string }) {
  const view = useQuery({
    queryKey: ["public", "referral", token],
    queryFn: ({ signal }) => publicReferralApi.view(token, signal),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const [outcome, setOutcome] = useState<"accepted" | "declined" | "received" | null>(null);
  const [fatal, setFatal] = useState<unknown>(null);
  const styles = useStyles();

  if (view.isPending) {
    return (
      <Card className={styles.card}>
        <Spinner label="Loading…" />
      </Card>
    );
  }
  if (fatal || view.isError) {
    const e = fatal ?? view.error;
    const copy = publicReferralError(isApiError(e) ? e : null);
    return <StateCard tone="error" title={copy.title} body={copy.body} />;
  }
  const v = view.data;
  const company = v.tenant_name ?? "The company";
  switch (publicReferralScreen(v, outcome)) {
    case "accepted":
      return (
        <StateCard
          tone="success"
          title="Thank you — you accepted the referral"
          body={`${company} will review your profile${v.job_title ? ` for the ${v.job_title} role` : ""} and contact you about next steps.`}
        />
      );
    case "declined":
      return (
        <StateCard
          tone="declined"
          title="You declined the referral"
          body="Your choice was recorded. Your details and resume will not be used, and you will not be contacted about this referral."
        />
      );
    case "received":
      return (
        <StateCard
          tone="success"
          title="Thank you — your details were received"
          body={`${company} will review your profile${v.job_title ? ` for the ${v.job_title} role` : ""} and contact you about next steps.`}
        />
      );
    case "answered":
      return <StateCard tone="declined" title="You have already answered" body="Your answer to this referral was recorded. There is nothing more to do." />;
    case "accept_notice":
      return <AcceptCard token={token} view={v} onDone={setOutcome} onFatal={setFatal} />;
    case "submit_form":
    default:
      return <SubmitCard token={token} view={v} onDone={() => setOutcome("received")} onFatal={setFatal} />;
  }
}

function intro(v: PublicReferralView): string {
  const who = v.referrer_first_name ?? "Someone you know";
  const company = v.tenant_name ?? "a company";
  const role = v.general || !v.job_title ? "for opportunities" : `for the ${v.job_title} role`;
  return `${who} referred you to ${company} ${role}.`;
}

function NoticeBox({ view }: { view: PublicReferralView }) {
  const styles = useStyles();
  const id = useId();
  return (
    <section/* NOSONAR */ className={styles.notice} aria-labelledby={id} tabIndex={0}>
      <Text id={id} weight="semibold" block>
        {view.notice.title}
        {view.notice.version != null ? ` (version ${view.notice.version})` : ""}
      </Text>
      <MarkdownView source={view.notice.body_md} />
    </section>
  );
}

function AcceptCard({
  token,
  view,
  onDone,
  onFatal,
}: {
  token: string;
  view: PublicReferralView;
  onDone: (o: "accepted" | "declined") => void;
  onFatal: (e: unknown) => void;
}) {
  const styles = useStyles();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (kind: "accept" | "decline") => {
    if (kind === "accept" && !agreed) {
      setError("Tick the box to confirm you agree to the notice.");
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      if (kind === "accept") await publicReferralApi.accept(token, view.notice.notice_id);
      else await publicReferralApi.decline(token);
      onDone(kind === "accept" ? "accepted" : "declined");
    } catch (e) {
      const copy = publicReferralError(isApiError(e) ? e : null);
      if (copy.fatal) onFatal(e);
      else setError(`${copy.title}. ${copy.body}`);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card className={styles.card}>
      <Heading focusKey="accept">{view.referee_first_name ? `Hi ${view.referee_first_name}, you were referred` : "You were referred"}</Heading>
      <Body1>
        {intro(view)} Before {view.tenant_name ?? "they"} look at your details, please read the notice below and tell us whether you agree.
        This link is valid until {formatDate(view.expires_at)}.
      </Body1>
      <NoticeBox view={view} />
      <Checkbox
        className={styles.checkbox}
        required
        label="I have read the notice and agree to my details and resume being used for this referral"
        checked={agreed}
        onChange={(_, d) => setAgreed(Boolean(d.checked))}
      />
      <ErrorLive message={error} />
      <div className={styles.actions}>
        <Button appearance="primary" size="large" disabled={!!busy || !agreed} onClick={() => void run("accept")}>
          {busy === "accept" ? <Spinner size="tiny" label="Saving…" /> : "Accept"}
        </Button>
        <Button size="large" disabled={!!busy} onClick={() => void run("decline")}>
          {busy === "decline" ? <Spinner size="tiny" label="Saving…" /> : "Decline"}
        </Button>
      </div>
    </Card>
  );
}

function SubmitCard({
  token,
  view,
  onDone,
  onFatal,
}: {
  token: string;
  view: PublicReferralView;
  onDone: () => void;
  onFatal: (e: unknown) => void;
}) {
  const styles = useStyles();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [botToken, setBotToken] = useState<string | null>(null);
  const [challengeKey, setChallengeKey] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<"name" | "email" | "resume" | "agreed", string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = selfSubmitErrors({ name, email, resume: file, agreed });
    setErrors(found);
    if (Object.keys(found).length) {
      setError("Please check the fields marked below.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await publicReferralApi.submit(token, { name, email, phone, resume: file as File, noticeId: view.notice.notice_id, botToken });
      onDone();
    } catch (err) {
      const copy = publicReferralError(isApiError(err) ? err : null);
      if (copy.fatal) onFatal(err);
      else {
        setError(`${copy.title}. ${copy.body}`);
        if (isApiError(err) && err.code === "challenge_failed") {
          setBotToken(null);
          setChallengeKey((k) => k + 1);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={styles.card}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <Heading focusKey="submit">{view.job_title && !view.general ? `Apply for ${view.job_title}` : "Share your details"}</Heading>
        <Body1>{intro(view)} Add your details and resume below. This link is valid until {formatDate(view.expires_at)}.</Body1>
        <Field label="Full name" required validationState={errors.name ? "error" : "none"} validationMessage={errors.name}>
          <Input className={styles.input} value={name} maxLength={200} autoComplete="name" disabled={busy} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Field label="Email" required validationState={errors.email ? "error" : "none"} validationMessage={errors.email}>
          <Input
            className={styles.input}
            type="email"
            value={email}
            maxLength={320}
            autoComplete="email"
            disabled={busy}
            onChange={(_, d) => setEmail(d.value)}
          />
        </Field>
        <Field label="Phone (optional)">
          <Input className={styles.input} type="tel" value={phone} maxLength={40} autoComplete="tel" disabled={busy} onChange={(_, d) => setPhone(d.value)} />
        </Field>
        <Field label="Resume" required validationState={errors.resume ? "error" : "none"} validationMessage={errors.resume}>
          <FileDrop
            accept={RESUME_ACCEPT}
            title={file ? `Selected: ${file.name}` : "Drop your resume here"}
            hint="PDF or Word (.docx), up to 10 MB."
            buttonLabel={file ? "Choose another file" : "Choose file"}
            disabled={busy}
            onFiles={([f]) => f && setFile(f)}
          />
        </Field>
        <NoticeBox view={view} />
        <Field validationState={errors.agreed ? "error" : "none"} validationMessage={errors.agreed}>
          <Checkbox
            className={styles.checkbox}
            required
            label="I have read the notice and agree to my details and resume being used for this referral"
            checked={agreed}
            onChange={(_, d) => setAgreed(Boolean(d.checked))}
          />
        </Field>
        {view.challenge && (
          <BotChallenge key={challengeKey} provider={view.challenge.provider} siteKey={view.challenge.site_key} onToken={setBotToken} />
        )}
        <ErrorLive message={error} />
        <div className={styles.actions}>
          <Button appearance="primary" size="large" type="submit" disabled={busy}>
            {busy ? <Spinner size="tiny" label="Sending…" /> : "Send my details"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
