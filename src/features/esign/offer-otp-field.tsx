"use client";

import { Button, Caption1, Field, Input, makeStyles, Spinner, tokens } from "@fluentui/react-components";
import { Mail20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { formatDateTime } from "@/features/admin/ui";
import type { OtpSentOut } from "@/features/documents/types";
import { ceremonyError, normalizeOtp, otpSentMessage } from "./ceremony-logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  touch: { minHeight: "44px", alignSelf: "flex-start" },
  input: { minHeight: "44px", maxWidth: "200px", letterSpacing: "0.3em", fontVariantNumeric: "tabular-nums" },
});

/** "Send code" + 6-digit input for offer acceptance when the tenant requires an emailed code. */
export function OfferOtpField({
  value,
  onChange,
  send,
  error,
  disabled,
}: {
  value: string;
  onChange: (otp: string) => void;
  send: () => Promise<OtpSentOut>;
  error?: string | null;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const [sent, setSent] = useState<OtpSentOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const message = error ?? sendError;
  return (
    <div className={styles.root}>
      <Button className={styles.touch} icon={busy ? <Spinner size="tiny" /> : <Mail20Regular />} disabled={busy || disabled} onClick={async () => {
        setBusy(true);
        setSendError(null);
        try {
          setSent(await send());
        } catch (e) {
          setSendError(ceremonyError(e).message);
        } finally {
          setBusy(false);
        }
      }}>
        {sent ? "Send a new code" : "Send code"}
      </Button>
      <div aria-live="polite">
        {sent && (
          <Caption1>
            {otpSentMessage(sent)} It expires at {formatDateTime(sent.expires_at)}.
          </Caption1>
        )}
      </div>
      <Field label="6-digit code from the email" required validationState={message ? "error" : "none"} validationMessage={message ?? undefined}>
        <Input
          className={styles.input}
          value={value}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          disabled={disabled}
          onChange={(_, d) => onChange(normalizeOtp(d.value))}
        />
      </Field>
    </div>
  );
}
