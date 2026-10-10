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
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { formatDateTime } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { LEAD_STATUS_COLORS, LEAD_STATUS_LABELS, STAGE_COLORS, STAGE_LABELS } from "./format";
import type { LeadStatus, OpportunityStage, ReasonKind, StatusHistoryOut } from "./types";
import { useReasonCodes } from "./use-leads";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" },
  item: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    padding: `${tokens.spacingVerticalS} 0`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  muted: { color: tokens.colorNeutralForeground3 },
});

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge appearance="tint" color={LEAD_STATUS_COLORS[status]}>
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  );
}

export function StageBadge({ stage }: { stage: OpportunityStage }) {
  return (
    <Badge appearance="tint" color={STAGE_COLORS[stage]}>
      {STAGE_LABELS[stage]}
    </Badge>
  );
}

export type ReasonResult = { reason_code: string; note: string | null; competitor: string | null };

/** Reason `Dropdown` + note (+ optional competitor) dialog; the note is required for reason "other". */
export function ReasonDialog({
  open,
  title,
  kind,
  confirmLabel,
  withCompetitor,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  kind: ReasonKind;
  confirmLabel: string;
  withCompetitor?: boolean;
  onConfirm: (r: ReasonResult) => Promise<unknown>;
  onClose: () => void;
}) {
  const styles = useStyles();
  const codes = useReasonCodes(kind);
  const [code, setCode] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = (codes.data ?? []).filter((c) => !c.archived_at);
  const selected = options.find((c) => c.code === code);
  const noteRequired = code === "other";
  const invalid = !code || (noteRequired && !note.trim());

  async function submit() {
    if (invalid || !code) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm({ reason_code: code, note: note.trim() || null, competitor: competitor.trim() || null });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && !busy && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent className={styles.form}>
            {error && (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            <Field label="Reason" required>
              <Dropdown
                placeholder={codes.isPending ? "Loading…" : "Choose a reason"}
                value={selected?.label ?? ""}
                selectedOptions={code ? [code] : []}
                onOptionSelect={(_, d) => setCode(d.optionValue ?? null)}
              >
                {options.map((c) => (
                  <Option key={c.id} value={c.code}>
                    {c.label}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            {withCompetitor && (
              <Field label="Competitor">
                <Input value={competitor} maxLength={200} onChange={(_, d) => setCompetitor(d.value)} />
              </Field>
            )}
            <Field label="Note" required={noteRequired} hint={noteRequired ? "Required when the reason is Other." : undefined}>
              <Textarea value={note} maxLength={2000} resize="vertical" onChange={(_, d) => setNote(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={busy || invalid}
              icon={busy ? <Spinner size="tiny" /> : undefined}
              onClick={submit}
            >
              {confirmLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Status / stage history list. */
export function HistoryList({ items, label }: { items: StatusHistoryOut[]; label: (v: string) => string }) {
  const styles = useStyles();
  if (!items.length) return <Text className={styles.muted}>No history yet.</Text>;
  return (
    <ul className={styles.list}>
      {items.map((h) => (
        <li key={h.id} className={styles.item}>
          <Text weight="semibold">
            {h.from_value ? `${label(h.from_value)} → ${label(h.to_value)}` : label(h.to_value)}
          </Text>
          <Text size={200} className={styles.muted}>
            {formatDateTime(h.at)}
            {h.actor_kind !== "user" ? ` · ${h.actor_kind}` : ""}
            {h.reason_code ? ` · reason: ${h.reason_code}` : ""}
            {h.competitor ? ` · competitor: ${h.competitor}` : ""}
          </Text>
          {h.note && <Text size={200}>{h.note}</Text>}
        </li>
      ))}
    </ul>
  );
}
