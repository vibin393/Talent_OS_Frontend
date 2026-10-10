"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  Textarea,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { Eye16Regular, EyeOff16Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { maskedNumber } from "./logic";
import type { UnmaskOut } from "./types";

const useStyles = makeStyles({
  masked: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalXS, fontFamily: tokens.fontFamilyMonospace },
  surface: { maxWidth: "640px", width: "100%" },
});

/** Runs an async action with busy / error state; calls `onDone` then `onClose` on success. */
export function useAction(onDone: () => void, onClose: () => void, mapError?: (e: unknown) => string | null) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
      onClose();
    } catch (e) {
      setError(mapError?.(e) ?? errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run };
}

export function DialogShell({
  title,
  onClose,
  children,
  actions,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>{children}</DialogContent>
          <DialogActions>{actions}</DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** A dialog asking for a required free-text reason (reject, waive, withdraw, move back). */
export function ReasonDialog({
  title,
  label,
  confirm,
  onClose,
  onDone,
  action,
  hint,
}: {
  title: string;
  label: string;
  confirm: string;
  onClose: () => void;
  onDone: () => void;
  action: (reason: string) => Promise<unknown>;
  hint?: string;
}) {
  const admin = useAdminStyles();
  const [text, setText] = useState("");
  const { error, busy, run } = useAction(onDone, onClose);
  return (
    <DialogShell
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Back</Button>
          <Button appearance="primary" disabled={busy || !text.trim()} onClick={() => void run(() => action(text.trim()))}>
            {confirm}
          </Button>
        </>
      }
    >
      <div className={admin.form}>
        <Field label={label} required hint={hint}>
          <Textarea value={text} maxLength={2000} onChange={(_, d) => setText(d.value)} />
        </Field>
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}

/**
 * Masked number (`••••1234`) with an Unmask button for holders of `identity:view`. The plaintext comes from the
 * audited unmask endpoint, is kept only in component state and is hidden again on demand.
 */
export function MaskedNumber({
  last4,
  label,
  canUnmask,
  unmask,
}: {
  last4: string | null;
  label: string;
  canUnmask: boolean;
  unmask: () => Promise<UnmaskOut>;
}) {
  const styles = useStyles();
  const [plain, setPlain] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!last4) return <span>—</span>;
  const reveal = async () => {
    setBusy(true);
    setError(null);
    try {
      setPlain((await unmask()).number);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className={styles.masked}>
      <span aria-label={plain ? `${label}: ${plain}` : `${label} ending ${last4}`}>{plain ?? maskedNumber(last4)}</span>
      {canUnmask &&
        (plain ? (
          <Tooltip content={`Hide ${label}`} relationship="label">
            <Button size="small" appearance="subtle" icon={<EyeOff16Regular />} onClick={() => setPlain(null)} />
          </Tooltip>
        ) : (
          <Button size="small" appearance="subtle" icon={<Eye16Regular />} disabled={busy} onClick={() => void reveal()}>
            Unmask
          </Button>
        ))}
      {error && <ErrorBar message={error} />}
    </span>
  );
}
