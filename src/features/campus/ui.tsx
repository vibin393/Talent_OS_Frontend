"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { DRIVE_STATUS_COLORS, DRIVE_STATUS_LABELS, REGISTRATION_STATUS_COLORS, REGISTRATION_STATUS_LABELS } from "./logic";
import type { DriveStatus, RegistrationStatus } from "./types";

export const useCampusStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "flex-end" },
  grid2: {
    display: "grid",
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  card: {
    padding: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  muted: { color: tokens.colorNeutralForeground3 },
  num: { fontVariantNumeric: "tabular-nums" },
  grow: { flex: 1 },
  danger: { color: tokens.colorPaletteRedForeground1 },
  warn: { color: tokens.colorPaletteMarigoldForeground1 },
  section: { marginTop: tokens.spacingVerticalL },
  tableWrap: { overflowX: "auto" },
});

export function DriveStatusBadge({ status }: { status: DriveStatus }) {
  return (
    <Badge appearance="tint" color={DRIVE_STATUS_COLORS[status]}>
      {DRIVE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
  return (
    <Badge appearance="tint" color={REGISTRATION_STATUS_COLORS[status]}>
      {REGISTRATION_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Marker for a human-only (★) action: never automated, always audited. */
export function HumanOnly() {
  return (
    <span aria-label="human-only action" title="Human-only action: recorded in the audit log">
      ★
    </span>
  );
}

/** Dialog that asks for a reason (`min` characters or more) before running `onSubmit`. */
export function ReasonDialog({
  title,
  intro,
  label = "Reason",
  confirmLabel,
  min = 5,
  max = 500,
  onSubmit,
  onClose,
}: {
  title: React.ReactNode;
  intro?: React.ReactNode;
  label?: string;
  confirmLabel: string;
  min?: number;
  max?: number;
  onSubmit: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const styles = useCampusStyles();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooShort = reason.trim().length < min;
  const submit = async () => {
    setTouched(true);
    if (tooShort) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent className={styles.stack}>
            {intro}
            <Field
              label={label}
              required={min > 0}
              hint={min > 0 ? `At least ${min} characters. Recorded in the audit log.` : "Optional. Recorded in the audit log."}
              validationState={touched && tooShort ? "error" : "none"}
              validationMessage={touched && tooShort ? `Enter at least ${min} characters.` : undefined}
            >
              <Textarea value={reason} maxLength={max} resize="vertical" disabled={busy} onChange={(_, d) => setReason(d.value)} />
            </Field>
            {error && (
              <MessageBar intent="error" role="alert">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={() => void submit()}>
              {confirmLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
