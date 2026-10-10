"use client";

import {
  Body1,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  Spinner,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { ErrorBar } from "@/features/admin/ui";
import { isConfirmed } from "./format";

const useStyles = makeStyles({
  content: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  word: { fontFamily: tokens.fontFamilyMonospace, fontWeight: tokens.fontWeightSemibold },
});

type Runner = () => Promise<unknown>;

async function run(action: Runner, setBusy: (b: boolean) => void, setError: (e: string | null) => void, toMessage: (e: unknown) => string) {
  setBusy(true);
  setError(null);
  try {
    await action();
    return true;
  } catch (e) {
    setError(toMessage(e));
    return false;
  } finally {
    setBusy(false);
  }
}

/**
 * Destructive confirmation that stays disabled until the user types `word` exactly (e.g. ANONYMIZE).
 * Errors are shown inside the dialog so the user can retry or cancel.
 */
export function TypedConfirmDialog({
  open,
  title,
  word,
  confirmLabel,
  children,
  onConfirm,
  onClose,
  errorMessage,
}: {
  open: boolean;
  title: string;
  word: string;
  confirmLabel: string;
  children: React.ReactNode;
  onConfirm: (typed: string) => Promise<unknown>;
  onClose: () => void;
  errorMessage: (e: unknown) => string;
}) {
  const styles = useStyles();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    if (busy) return;
    setTyped("");
    setError(null);
    onClose();
  };
  const ok = isConfirmed(typed, word);
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && close()} modalType="alert">
      <DialogSurface>
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (!ok) return;
            if (await run(() => onConfirm(typed.trim()), setBusy, setError, errorMessage)) {
              setTyped("");
              onClose();
            }
          }}
        >
          <DialogBody>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent className={styles.content}>
              <ErrorBar message={error} />
              {children}
              <Field
                label={
                  <>
                    Type <span className={styles.word}>{word}</span> to confirm
                  </>
                }
                required
              >
                <Input value={typed} onChange={(_, d) => setTyped(d.value)} autoComplete="off" spellCheck={false} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" disabled={busy} onClick={close}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                type="submit"
                disabled={!ok || busy}
                icon={busy ? <Spinner size="tiny" /> : undefined}
              >
                {confirmLabel}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}

/** Confirmation that requires a written reason of at least `minLength` characters. */
export function ReasonDialog({
  open,
  title,
  description,
  label = "Reason",
  minLength,
  confirmLabel,
  onConfirm,
  onClose,
  errorMessage,
  extra,
  canConfirm = true,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  label?: string;
  minLength: number;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<unknown>;
  onClose: () => void;
  errorMessage: (e: unknown) => string;
  /** Extra fields rendered below the reason (e.g. a typed slug). */
  extra?: React.ReactNode;
  canConfirm?: boolean;
}) {
  const styles = useStyles();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const short = reason.trim().length < minLength;
  const close = () => {
    if (busy) return;
    setReason("");
    setError(null);
    setTouched(false);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && close()}>
      <DialogSurface>
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setTouched(true);
            if (short || !canConfirm) return;
            if (await run(() => onConfirm(reason.trim()), setBusy, setError, errorMessage)) {
              setReason("");
              setTouched(false);
              onClose();
            }
          }}
        >
          <DialogBody>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent className={styles.content}>
              <ErrorBar message={error} />
              {description && <Body1>{description}</Body1>}
              <Field
                label={label}
                required
                hint={`At least ${minLength} characters.`}
                validationState={touched && short ? "error" : "none"}
                validationMessage={touched && short ? `Enter at least ${minLength} characters.` : undefined}
              >
                <Textarea value={reason} onChange={(_, d) => setReason(d.value)} resize="vertical" rows={3} maxLength={2000} />
              </Field>
              {extra}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" disabled={busy} onClick={close}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                type="submit"
                disabled={busy || !canConfirm}
                icon={busy ? <Spinner size="tiny" /> : undefined}
              >
                {confirmLabel}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
