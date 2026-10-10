"use client";

import { Body1, Input, Field, Link } from "@fluentui/react-components";
import { useState } from "react";
import { CodeInput } from "./code-input";
import { FormAlert } from "./form-alert";
import { useFormStyles } from "./form-styles";
import { isChallengeExpired, isCompleteTotp, mfaErrorMessage, normalizeRecoveryCode } from "./mfa";
import { SubmitButton } from "./submit-button";
import { useMfaVerify } from "./use-login";

/**
 * Second sign-in step after `{mfa_required: true}`: a 6-digit authenticator code (submitted automatically
 * when complete) or, via "Use a recovery code", one of the one-time recovery codes. An expired challenge
 * (5 minutes, or 5 wrong codes) sends the user back to the password step.
 */
export function MfaCodeStep({
  email,
  onVerified,
  onRestart,
}: {
  email: string;
  onVerified: () => void;
  onRestart: (message?: string) => void;
}) {
  const styles = useFormStyles();
  const verify = useMfaVerify();
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(totp?: string) {
    if (verify.isPending) return;
    setError(null);
    const body =
      mode === "totp" ? { code: totp ?? code } : { recovery_code: normalizeRecoveryCode(recovery) };
    try {
      await verify.mutateAsync(body);
      onVerified();
    } catch (e) {
      if (isChallengeExpired(e)) {
        onRestart(mfaErrorMessage(e));
        return;
      }
      setError(mfaErrorMessage(e, { recoveryCode: mode === "recovery" }));
      if (mode === "totp") setCode("");
    }
  }

  const ready = mode === "totp" ? isCompleteTotp(code) : recovery.trim().length > 0;
  const pending = verify.isPending || verify.isSuccess;

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
        {mode === "totp"
          ? `Enter the 6-digit code from the authenticator app for ${email}.`
          : "Enter one of the recovery codes you saved when you set up multi-factor authentication. Each code works once."}
      </Body1>
      <FormAlert message={error} />
      {mode === "totp" ? (
        <CodeInput
          label="Verification code"
          value={code}
          onChange={setCode}
          disabled={pending}
          autoFocus
          onComplete={(c) => void submit(c)}
        />
      ) : (
        <Field label="Recovery code">
          <Input
            value={recovery}
            onChange={(_, d) => setRecovery(d.value)}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={64}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            disabled={pending}
          />
        </Field>
      )}
      <div className={styles.links}>
        <Link
          as="button"
          type="button"
          onClick={() => {
            setError(null);
            setMode(mode === "totp" ? "recovery" : "totp");
          }}
        >
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
