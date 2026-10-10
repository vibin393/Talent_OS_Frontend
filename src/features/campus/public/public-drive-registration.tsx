"use client";

import { Body1, Button, Card, Checkbox, Field, Input, Spinner } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BotChallenge } from "@/features/careers/apply/bot-challenge";
import { linkErrorCopy } from "@/features/public-links/logic";
import { fieldErrors, isApiError } from "@/lib/api/errors";
import { publicCampusApi } from "../api";
import { type Answers, type AnswerValue, cleanAnswers, type Files, formatDate, isE164, isEmail, optionsFor, plainFieldKeys, validateAnswers } from "../logic";
import type { PublicDriveView } from "../types";
import { DynamicField, ErrorLive, Heading, NoticeBox, PublicShell, StateCard, usePublicStyles } from "./public-ui";

function errorCopy(e: unknown) {
  return isApiError(e) ? linkErrorCopy(e.status, e.code) : linkErrorCopy(500, undefined);
}

/** `/campus/r/[token]`: a student registers for a campus drive through their Institution's link. */
export function PublicDriveRegistration({ token }: { token: string }) {
  const styles = usePublicStyles();
  const view = useQuery({
    queryKey: ["public", "campus", "drive", token],
    queryFn: ({ signal }) => publicCampusApi.drive(token, signal),
    retry: (n, e) => n < 1 && (!isApiError(e) || e.status === 0 || e.status >= 500),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const [done, setDone] = useState<"registered" | "already_registered" | null>(null);

  let content: React.ReactNode;
  if (view.isPending) {
    content = (
      <Card className={styles.card}>
        <Spinner label="Loading…" />
      </Card>
    );
  } else if (view.isError) {
    const copy = errorCopy(view.error);
    content = <StateCard tone="error" title={copy.title} body={copy.body} />;
  } else if (done) {
    content = (
      <StateCard
        tone="success"
        title={done === "registered" ? "You are registered" : "You were already registered"}
        body={
          done === "registered"
            ? `${view.data.tenant_name ?? "The recruiter"} received your registration for ${view.data.drive_name}. You will hear about eligibility and next steps by email.`
            : "We found your earlier registration for this drive and kept it. There is nothing more to do."
        }
      />
    );
  } else if (view.data.status === "closed") {
    content = <StateCard tone="error" title="Registration is closed" body={`Registration for ${view.data.drive_name} is no longer open. Contact your placement office for help.`} />;
  } else {
    content = <RegistrationForm token={token} view={view.data} onDone={setDone} onStale={() => void view.refetch()} />;
  }
  return <PublicShell tenant={view.data?.tenant_name}>{content}</PublicShell>;
}

function RegistrationForm({
  token,
  view,
  onDone,
  onStale,
}: {
  token: string;
  view: PublicDriveView;
  onDone: (s: "registered" | "already_registered") => void;
  onStale: () => void;
}) {
  const styles = usePublicStyles();
  const prefill = view.prefill ?? {};
  const [name, setName] = useState(typeof prefill.full_name === "string" ? prefill.full_name : "");
  const [email, setEmail] = useState(typeof prefill.email === "string" ? prefill.email : "");
  const [phone, setPhone] = useState(typeof prefill.phone === "string" ? prefill.phone : "");
  const [answers, setAnswers] = useState<Answers>({});
  const [files, setFiles] = useState<Files>({});
  const [agreed, setAgreed] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [botToken, setBotToken] = useState<string | null>(null);
  const [challengeKey, setChallengeKey] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: string, v: AnswerValue) => {
    setAnswers((a) => {
      const next = { ...a, [key]: v };
      // A new program invalidates a branch that does not belong to it.
      if (key === "program" && typeof a.branch === "string" && !optionsFor({ key: "branch", label: "", type: "select", required: false }, next, view.branches_by_program).includes(a.branch))
        next.branch = "";
      return next;
    });
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateAnswers(view.fields, answers, files, view.branches_by_program);
    if (!name.trim()) found.full_name = "Enter your full name.";
    if (!isEmail(email)) found.email = "Enter a valid email address.";
    if (phone.trim() && !isE164(phone)) found.phone = "Start with + and your country code, for example +919876543210.";
    if (!agreed) found.agreed = "Tick the box to confirm you agree to the notice.";
    setErrors(found);
    const count = Object.keys(found).length;
    if (count) {
      setError(`Please check ${count === 1 ? "1 field" : `${count} fields`} marked below.`);
      document.getElementById(`f-${Object.keys(found)[0]}`)?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const out = await publicCampusApi.register(
        token,
        {
          full_name: name.trim(),
          email: email.trim(),
          phone: phone.replace(/[\s-]/g, "") || null,
          answers: cleanAnswers(view.fields, answers),
          notice_id: view.notice.notice_id,
          agreed: true,
          marketing_opt_in: marketing,
          bot_token: botToken,
        },
        files,
      );
      onDone(out.status);
    } catch (err) {
      if (isApiError(err) && err.status === 422) {
        const fe = plainFieldKeys(fieldErrors(err));
        setErrors(fe);
        setError(Object.keys(fe).length ? "Please check the fields marked below." : err.message);
      } else if (isApiError(err) && err.code === "notice_outdated") {
        setAgreed(false);
        setError("The privacy notice was just updated. Please read it again and tick the box.");
        onStale();
      } else {
        const copy = errorCopy(err);
        setError(isApiError(err) && err.status === 409 ? err.message : `${copy.title}. ${copy.body}`);
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
        <Heading focusKey="register">Register for {view.drive_name}</Heading>
        <Body1>
          {view.tenant_name ?? "The recruiter"} is hiring the {view.batch_year} batch at {view.institution_name}.
          {view.closes_at ? ` Registration closes on ${formatDate(view.closes_at)}.` : ""} Fields marked with an asterisk (*) are
          required.
        </Body1>
        <div id="f-full_name">
          <Field label="Full name" required validationState={errors.full_name ? "error" : "none"} validationMessage={errors.full_name}>
            <Input className={styles.input} value={name} maxLength={200} autoComplete="name" disabled={busy} onChange={(_, d) => setName(d.value)} />
          </Field>
        </div>
        <div id="f-email">
          <Field label="Email" required validationState={errors.email ? "error" : "none"} validationMessage={errors.email}>
            <Input className={styles.input} type="email" value={email} maxLength={320} autoComplete="email" disabled={busy} onChange={(_, d) => setEmail(d.value)} />
          </Field>
        </div>
        <div id="f-phone">
          <Field label="Mobile number" hint="With country code, for example +91 98765 43210" validationState={errors.phone ? "error" : "none"} validationMessage={errors.phone}>
            <Input className={styles.input} type="tel" value={phone} maxLength={40} autoComplete="tel" disabled={busy} onChange={(_, d) => setPhone(d.value)} />
          </Field>
        </div>
        {view.fields.map((f) => (
          <div key={f.key} id={`f-${f.key}`}>
            <DynamicField
              field={f}
              value={answers[f.key]}
              file={files[f.key]}
              options={optionsFor(f, answers, view.branches_by_program)}
              error={errors[f.key] || undefined}
              disabled={busy}
              onChange={(v) => set(f.key, v)}
              onFile={(file) => {
                setFiles((x) => ({ ...x, [f.key]: file }));
                if (errors[f.key]) setErrors((e2) => ({ ...e2, [f.key]: "" }));
              }}
            />
          </div>
        ))}
        <NoticeBox notice={view.notice} />
        <div id="f-agreed">
          <Field validationState={errors.agreed ? "error" : "none"} validationMessage={errors.agreed}>
            <Checkbox
              className={styles.checkbox}
              required
              label="I have read the notice and agree to my details being used for this campus drive *"
              checked={agreed}
              disabled={busy}
              onChange={(_, d) => setAgreed(Boolean(d.checked))}
            />
          </Field>
        </div>
        {view.marketing_notice && (
          <>
            <NoticeBox notice={view.marketing_notice} />
            <Checkbox
              className={styles.checkbox}
              label="Optional: keep me informed about future opportunities"
              checked={marketing}
              disabled={busy}
              onChange={(_, d) => setMarketing(Boolean(d.checked))}
            />
          </>
        )}
        {view.challenge && <BotChallenge key={challengeKey} provider={view.challenge.provider} siteKey={view.challenge.site_key} onToken={setBotToken} />}
        <ErrorLive message={error} />
        <div className={styles.actions}>
          <Button appearance="primary" size="large" type="submit" disabled={busy}>
            {busy ? <Spinner size="tiny" label="Registering…" /> : "Register"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
