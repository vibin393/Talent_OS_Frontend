"use client";

import { Body1, Button, Card, makeStyles, Spinner, Text, Title3, tokens } from "@fluentui/react-components";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { CodeInput } from "@/features/auth/code-input";
import { FormAlert } from "@/features/auth/form-alert";
import { formatSecret, isCompleteTotp, mfaErrorMessage } from "@/features/auth/mfa";
import { RecoveryCodes } from "@/features/auth/mfa-setup";
import { platformApi } from "@/lib/api/platform-client";
import type { MfaEnrollOut, OperatorOut } from "@/lib/api/types";

const useStyles = makeStyles({
  page: { display: "flex", justifyContent: "center", padding: tokens.spacingVerticalXXXL },
  card: { width: "100%", maxWidth: "560px", padding: tokens.spacingHorizontalXXL, gap: tokens.spacingVerticalL },
  qrRow: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXL, alignItems: "center" },
  qr: { width: "180px", height: "180px", padding: tokens.spacingHorizontalS, backgroundColor: "#ffffff", borderRadius: tokens.borderRadiusMedium },
  secret: { fontFamily: tokens.fontFamilyMonospace, overflowWrap: "anywhere" },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

/** Operators must enrol an authenticator before using the console (403 `mfa_enrollment_required`). */
export function PlatformMfaEnroll({ operator, onDone }: { operator: OperatorOut; onDone: () => void }) {
  const styles = useStyles();
  const [enrollment, setEnrollment] = useState<MfaEnrollOut | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enrollment) return;
    let alive = true;
    QRCode.toDataURL(enrollment.otpauth_uri, { margin: 0, width: 360 })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [enrollment]);

  const begin = async () => {
    setBusy(true);
    setError(null);
    try {
      setEnrollment(await platformApi.mfaEnroll());
    } catch (e) {
      setError(mfaErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const confirm = async (c = code) => {
    if (busy || !isCompleteTotp(c)) return;
    setBusy(true);
    setError(null);
    try {
      setCodes((await platformApi.mfaConfirm(c)).recovery_codes);
    } catch (e) {
      setError(mfaErrorMessage(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <Title3 as="h1">Set up multi-factor authentication</Title3>
        {codes ? (
          <RecoveryCodes codes={codes} email={operator.email} workspace="platform" onDone={onDone} doneLabel="Continue to the console" />
        ) : (
          <>
            <Body1>Platform operators must use an authenticator app. Add one to continue, {operator.name}.</Body1>
            <FormAlert message={error} />
            {!enrollment ? (
              <div className={styles.actions}>
                <Button appearance="primary" onClick={begin} disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined}>
                  Set up authenticator app
                </Button>
              </div>
            ) : (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void confirm();
                }}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div className={styles.qrRow}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- data: URL generated in the browser */}
                  {qr && <img src={qr} alt="QR code for your authenticator app" className={styles.qr} />}
                  <div>
                    <Text size={200}>Setup key</Text>
                    <br />
                    <code className={styles.secret}>{formatSecret(enrollment.secret)}</code>
                  </div>
                </div>
                <CodeInput label="Code from your app" value={code} onChange={setCode} disabled={busy} autoFocus onComplete={(c) => void confirm(c)} />
                <div className={styles.actions}>
                  <Button appearance="primary" type="submit" disabled={busy || !isCompleteTotp(code)}>
                    Verify and turn on
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
