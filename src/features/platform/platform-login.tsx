"use client";

import { Body1, Field, Input, Link } from "@fluentui/react-components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CodeInput } from "@/features/auth/code-input";
import { FormAlert } from "@/features/auth/form-alert";
import { useFormStyles } from "@/features/auth/form-styles";
import { isChallengeExpired, isCompleteTotp, mfaErrorMessage, normalizeRecoveryCode } from "@/features/auth/mfa";
import { SubmitButton } from "@/features/auth/submit-button";
import { TextField } from "@/features/auth/text-field";
import { platformApi, platformKeys } from "@/lib/api/platform-client";
import type { MfaRequiredOut, OperatorOut } from "@/lib/api/types";
import { platformErrorMessage } from "./errors";
import { safePlatformNext } from "./guard";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email").pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

function isChallenge(r: OperatorOut | MfaRequiredOut): r is MfaRequiredOut {
  return (r as MfaRequiredOut).mfa_required === true && !("email" in r);
}

/** Operator sign-in (`/api/v1/platform/auth/*`, `tos_platform` cookie) with the TOTP step (story 1.4). */
export function PlatformLoginForm({ next }: { next?: string }) {
  const styles = useFormStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [challengeFor, setChallengeFor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  const finish = (op: OperatorOut) => {
    setDone(true);
    queryClient.setQueryData(platformKeys.me, op);
    router.replace(safePlatformNext(next));
  };

  if (challengeFor) {
    return (
      <PlatformMfaStep
        email={challengeFor}
        onVerified={finish}
        onRestart={(message) => {
          setChallengeFor(null);
          form.resetField("password");
          setFormError(message ?? null);
        }}
      />
    );
  }

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        setFormError(null);
        try {
          const result = await platformApi.login(values);
          if (isChallenge(result)) setChallengeFor(values.email);
          else finish(result);
        } catch (e) {
          form.resetField("password");
          setFormError(platformErrorMessage(e));
        }
      })}
    >
      <FormAlert message={formError} />
      <TextField control={form.control} name="email" label="Email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} />
      <TextField control={form.control} name="password" label="Password" type="password" autoComplete="current-password" />
      <SubmitButton pending={form.formState.isSubmitting || done}>Sign in</SubmitButton>
    </form>
  );
}

function PlatformMfaStep({
  email,
  onVerified,
  onRestart,
}: {
  email: string;
  onVerified: (op: OperatorOut) => void;
  onRestart: (message?: string) => void;
}) {
  const styles = useFormStyles();
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(totp?: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const op = await platformApi.mfaVerify(mode === "totp" ? { code: totp ?? code } : { recovery_code: normalizeRecoveryCode(recovery) });
      onVerified(op);
    } catch (e) {
      setPending(false);
      if (isChallengeExpired(e)) {
        onRestart(mfaErrorMessage(e));
        return;
      }
      setError(mfaErrorMessage(e, { recoveryCode: mode === "recovery" }));
      if (mode === "totp") setCode("");
    }
  }

  const ready = mode === "totp" ? isCompleteTotp(code) : recovery.trim().length > 0;
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void submit();
      }}
    >
      <Body1 className={styles.muted}>
        {mode === "totp" ? `Enter the 6-digit code from the authenticator app for ${email}.` : "Enter one of your recovery codes."}
      </Body1>
      <FormAlert message={error} />
      {mode === "totp" ? (
        <CodeInput label="Verification code" value={code} onChange={setCode} disabled={pending} autoFocus onComplete={(c) => void submit(c)} />
      ) : (
        <Field label="Recovery code">
          <Input value={recovery} onChange={(_, d) => setRecovery(d.value)} autoFocus autoComplete="off" spellCheck={false} maxLength={64} disabled={pending} />
        </Field>
      )}
      <div className={styles.links}>
        <Link as="button" type="button" onClick={() => setMode(mode === "totp" ? "recovery" : "totp")}>
          {mode === "totp" ? "Use a recovery code" : "Use your authenticator app"}
        </Link>
        <Link as="button" type="button" onClick={() => onRestart()}>
          Sign in with a different account
        </Link>
      </div>
      <SubmitButton pending={pending} disabled={pending || !ready}>
        Verify
      </SubmitButton>
    </form>
  );
}
