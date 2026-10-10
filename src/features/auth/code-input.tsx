"use client";

import { Field, Input, makeStyles, tokens } from "@fluentui/react-components";
import { normalizeTotpInput, TOTP_LENGTH } from "./mfa";

const useStyles = makeStyles({
  input: {
    maxWidth: "220px",
    "& input": {
      fontFamily: tokens.fontFamilyMonospace,
      fontSize: tokens.fontSizeBase500,
      letterSpacing: "0.3em",
    },
  },
});

/** 6-digit authenticator code field (numeric keyboard, one-time-code autofill, digits only). */
export function CodeInput({
  label = "Code",
  value,
  onChange,
  error,
  hint,
  disabled,
  autoFocus,
  onComplete,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Called when the sixth digit is entered. */
  onComplete?: (code: string) => void;
}) {
  const styles = useStyles();
  return (
    <Field label={label} hint={hint} validationState={error ? "error" : "none"} validationMessage={error ?? undefined}>
      <Input
        className={styles.input}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={TOTP_LENGTH + 2}
        placeholder="000000"
        onChange={(_, d) => {
          const next = normalizeTotpInput(d.value);
          onChange(next);
          if (next.length === TOTP_LENGTH && next !== value) onComplete?.(next);
        }}
      />
    </Field>
  );
}
