"use client";

import {
  Button,
  Caption1,
  Checkbox,
  Field,
  Input,
  Link,
  MessageBar,
  MessageBarBody,
  Title2,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { devApi } from "./api";
import { fragmentToken } from "./logic";

const TERMS_VERSION = "2026-10";

const useStyles = makeStyles({
  form: { maxWidth: "420px", display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  codes: { fontFamily: "Consolas, monospace", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" },
});

export function SignUpForm() {
  const s = useStyles();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (done) {
    return (
      <MessageBar intent="success">
        <MessageBarBody>Check your email — we sent a link to verify your address.</MessageBarBody>
      </MessageBar>
    );
  }
  return (
    <form
      className={s.form}
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await devApi.signup({ email, name, password, accept_terms_version: TERMS_VERSION });
          setDone(true);
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <Title2 as="h1">Create your developer account</Title2>
      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      ) : null}
      <Field label="Full name" required>
        <Input value={name} onChange={(_, d) => setName(d.value)} />
      </Field>
      <Field label="Work email" required>
        <Input type="email" value={email} onChange={(_, d) => setEmail(d.value)} />
      </Field>
      <Field label="Password" required hint="At least 12 characters; avoid common words.">
        <Input type="password" value={password} onChange={(_, d) => setPassword(d.value)} />
      </Field>
      <Checkbox
        checked={agree}
        onChange={(_, d) => setAgree(Boolean(d.checked))}
        label={
          <>
            I agree to the Talent OS <Link href="/developers/docs/partner-requirements">Developer Terms</Link> and{" "}
            <Link href="/privacy">Privacy Notice</Link>
          </>
        }
      />
      <Button appearance="primary" type="submit" disabled={!agree || !email || !password || !name}>
        Create account
      </Button>
    </form>
  );
}

type Step = "password" | "mfa" | "enroll" | "codes";

export function SignInForm() {
  const s = useStyles();
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [enroll, setEnroll] = useState<{ otpauth_uri: string; secret_display: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className={s.form}>
      <Title2 as="h1">Sign in to Talent OS for Developers</Title2>
      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      ) : null}
      {step === "password" ? (
        <form
          className={s.form}
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const out = await devApi.login(email, password);
              if (out.step === "enroll_required") {
                setEnroll(await devApi.enrollStart());
                setStep("enroll");
              } else setStep("mfa");
            });
          }}
        >
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(_, d) => setEmail(d.value)} />
          </Field>
          <Field label="Password" required>
            <Input type="password" value={password} onChange={(_, d) => setPassword(d.value)} />
          </Field>
          <Button appearance="primary" type="submit">
            Sign in
          </Button>
          <Caption1>
            <Link href="/developers/reset-password">Forgot password?</Link> ·{" "}
            <Link href="/developers/sign-up">Create an account</Link>
          </Caption1>
        </form>
      ) : null}
      {step === "mfa" ? (
        <form
          className={s.form}
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await devApi.mfaVerify(useRecovery ? { recovery_code: code } : { code });
              router.push("/developers/workspace");
            });
          }}
        >
          <Field label={useRecovery ? "Recovery code" : "Enter the 6-digit code from your authenticator app"}>
            <Input value={code} onChange={(_, d) => setCode(d.value)} autoComplete="one-time-code" />
          </Field>
          <Button appearance="primary" type="submit">
            Verify
          </Button>
          <Link as="button" onClick={() => setUseRecovery(!useRecovery)}>
            {useRecovery ? "Use your authenticator app" : "Use a recovery code instead"}
          </Link>
        </form>
      ) : null}
      {step === "enroll" && enroll ? (
        <form
          className={s.form}
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const out = await devApi.enrollConfirm(code);
              setCodes(out.recovery_codes);
              setStep("codes");
            });
          }}
        >
          <Title2 as="h2">Protect your account with two-step verification</Title2>
          <Caption1>Add this account to your authenticator app ({enroll.otpauth_uri.split("?")[0]}).</Caption1>
          <Caption1>Can&apos;t scan? Enter this key: {enroll.secret_display}</Caption1>
          <Field label="Code from your app">
            <Input value={code} onChange={(_, d) => setCode(d.value)} autoComplete="one-time-code" />
          </Field>
          <Button appearance="primary" type="submit">
            Turn on
          </Button>
        </form>
      ) : null}
      {step === "codes" ? (
        <div className={s.form}>
          <Title2 as="h2">Save your recovery codes</Title2>
          <div className={s.codes}>
            {codes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <Button onClick={() => void navigator.clipboard?.writeText(codes.join("\n"))}>Copy</Button>
          <Checkbox checked={saved} onChange={(_, d) => setSaved(Boolean(d.checked))} label="I've saved these codes" />
          <Button appearance="primary" disabled={!saved} onClick={() => router.push("/developers/workspace")}>
            Done
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Consumes a `#t=` one-time token (email verification, invitation, sandbox handoff). */
export function TokenAction({ kind }: { kind: "verify" | "invitation" | "handoff" }) {
  const router = useRouter();
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    const t = fragmentToken(window.location.hash);
    window.history.replaceState(null, "", window.location.pathname);
    if (!t) {
      setState({ ok: false, text: "This link is invalid or has expired." });
      return;
    }
    const go = async () => {
      try {
        if (kind === "verify") {
          await devApi.verifyEmail(t);
          setState({ ok: true, text: "Your email is verified. You can sign in now." });
        } else if (kind === "invitation") {
          await devApi.acceptInvitation(t);
          router.push("/developers/workspace");
        } else {
          const out = await devApi.handoff(t);
          window.location.assign(out.redirect);
        }
      } catch (err) {
        setState({ ok: false, text: errorMessage(err) });
      }
    };
    void go();
  }, [kind, router]);
  if (!state) return <Caption1>Just a moment…</Caption1>;
  return (
    <MessageBar intent={state.ok ? "success" : "error"}>
      <MessageBarBody>
        {state.text} {state.ok ? <Link href="/developers/sign-in">Sign in</Link> : null}
      </MessageBarBody>
    </MessageBar>
  );
}
