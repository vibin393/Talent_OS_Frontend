"use client";

import {
  Badge,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import {
  ASSESSMENT_STATUS_COLORS,
  ASSESSMENT_STATUS_LABELS,
  codeLines,
  INVITATION_STATUS_COLORS,
  INVITATION_STATUS_LABELS,
  parseList,
} from "./logic";
import type { AssessmentStatus, InvitationStatus } from "./types";

export const useAsmStyles = makeStyles({
  surface: { maxWidth: "640px", width: "100%" },
  wide: { maxWidth: "880px", width: "100%" },
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  tight: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  row: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: tokens.spacingHorizontalM },
  rowCenter: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  grow: { flex: 1, minWidth: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
  mono: { fontFamily: tokens.fontFamilyMonospace },
  headerRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: tokens.spacingHorizontalM },
  narrow: { width: "120px" },
  code: {
    margin: 0,
    padding: tokens.spacingHorizontalS,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    overflowX: "auto",
    whiteSpace: "pre",
  },
  lineNo: { display: "inline-block", minWidth: "3ch", marginRight: tokens.spacingHorizontalS, color: tokens.colorNeutralForeground3, textAlign: "right", userSelect: "none" },
});

export function AssessmentStatusBadge({ status }: { status: AssessmentStatus }) {
  return (
    <Badge appearance="tint" color={ASSESSMENT_STATUS_COLORS[status] ?? "informative"}>
      {ASSESSMENT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function InvitationStatusBadge({ status, size }: { status: InvitationStatus; size?: "small" | "medium" }) {
  return (
    <Badge appearance="tint" size={size} color={INVITATION_STATUS_COLORS[status] ?? "informative"}>
      {INVITATION_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

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
  return { error, busy, run, setError };
}

export function DialogShell({
  title,
  onClose,
  children,
  actions,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions: React.ReactNode;
  wide?: boolean;
}) {
  const styles = useAsmStyles();
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className={wide ? styles.wide : styles.surface}>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>{children}</DialogContent>
          <DialogActions>{actions}</DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Read-only numbered code listing. */
export function CodeBlock({ code, label }: { code: string | null | undefined; label?: string }) {
  const styles = useAsmStyles();
  const lines = codeLines(code);
  if (!lines.length) return null;
  return (
    <pre/* NOSONAR */ className={styles.code} aria-label={label ?? "Code"} tabIndex={0}>
      {lines.map((l, i) => (
        <div key={i}>
          <span className={styles.lineNo} aria-hidden>
            {i + 1}
          </span>
          {l || " "}
        </div>
      ))}
    </pre>
  );
}

/** Comma-separated list input (tags, skill keys) that commits on blur. */
export function ListInput({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value: readonly string[];
  onChange: (v: string[]) => void;
  hint?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <Field label={label} hint={hint ?? "Separate with commas"}>
      <Input
        value={text ?? value.join(", ")}
        placeholder={placeholder}
        onChange={(_, d) => setText(d.value)}
        onBlur={() => {
          if (text !== null) onChange(parseList(text));
          setText(null);
        }}
      />
    </Field>
  );
}
