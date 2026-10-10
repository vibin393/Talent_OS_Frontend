"use client";

import { Body1, Button, Field, Image, Input, Link, MessageBar, MessageBarBody, Text } from "@fluentui/react-components";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { FormAlert } from "@/features/auth/form-alert";
import { useFormStyles } from "@/features/auth/form-styles";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { PortalAuthOut, PortalMfaIn } from "@/lib/api/types";

/**
 * Second factor of the Client / Vendor Portal sign-in: a TOTP code (or a recovery code) for enrolled users,
 * or authenticator enrolment (QR + secret, then the first code) when TOTP is mandatory. After enrolment the
 * recovery codes are shown once before continuing.
 */
export function PortalMfaStep({
  auth,
  verify,
  onSignedIn,
  onRestart,
}: {
  auth: PortalAuthOut;
  verify: (body: PortalMfaIn) => Promise<PortalAuthOut>;
  onSignedIn: () => void;
  onRestart: () => void;
}) {
  const styles = useFormStyles();
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const enrolling = auth.status === "mfa_enrollment_required" && auth.enrollment;

  useEffect(() => {
    if (!auth.enrollment) return;
    let alive = true;
    QRCode.toDataURL(auth.enrollment.otpauth_uri, { margin: 0, width: 220, errorCorrectionLevel: "M" })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [auth.enrollment]);

  if (codes) {
    return (
      <div className={styles.form}>
        <MessageBar intent="success">
          <MessageBarBody>Authenticator set up. Save these recovery codes now — they are shown only once.</MessageBarBody>
        </MessageBar>
        <Text font="monospace">{codes.join("  ")}</Text>
        <Button appearance="primary" onClick={onSignedIn}>
          Continue
        </Button>
      </div>
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await verify(useRecovery ? { recovery_code: recovery.trim() } : { code: code.trim() });
      if (result.recovery_codes.length) setCodes(result.recovery_codes);
      else onSignedIn();
    } catch (e) {
      if (isApiError(e) && e.code === "mfa_challenge_expired") {
        onRestart();
        return;
      }
      setError(isApiError(e) && e.code === "invalid_code" ? "The code is invalid or was already used." : errorMessage(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.form}>
      <FormAlert message={error} />
      {enrolling && auth.enrollment ? (
        <>
          <Body1>Scan this QR code with an authenticator app (Microsoft Authenticator, Google Authenticator), then enter the 6-digit code.</Body1>
          {qr && <Image src={qr} alt="Authenticator QR code" width={220} height={220} />}
          <Field label="Or enter this key">
            <Input readOnly value={auth.enrollment.secret} />
          </Field>
        </>
      ) : (
        <Body1>Enter the 6-digit code from your authenticator app.</Body1>
      )}
      {useRecovery ? (
        <Field label="Recovery code">
          <Input value={recovery} onChange={(_, d) => setRecovery(d.value)} autoComplete="one-time-code" />
        </Field>
      ) : (
        <Field label="Code">
          <Input
            value={code}
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            onChange={(_, d) => setCode(d.value.replace(/\D/g, ""))}
          />
        </Field>
      )}
      <Button appearance="primary" disabled={busy || (useRecovery ? !recovery.trim() : code.length !== 6)} onClick={submit}>
        Verify
      </Button>
      {!enrolling && (
        <div className={styles.links}>
          <Link as="button" type="button" onClick={() => setUseRecovery((v) => !v)}>
            {useRecovery ? "Use an authenticator code" : "Use a recovery code"}
          </Link>
        </div>
      )}
    </div>
  );
}
