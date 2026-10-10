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
  Input,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import {
  EINVOICE_LABELS,
  irnError,
  staleRows,
  STATUS_LABELS,
  statusColor,
} from "./logic";
import { formatMoney } from "./money";
import type { DocStatus, EinvoiceStatus, IrnIn, StaleDiff } from "./types";

export const useBillingStyles = makeStyles({
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalM,
    alignItems: "center",
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
    padding: tokens.spacingHorizontalL,
  },
  amount: {
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  strong: { fontWeight: tokens.fontWeightSemibold },
  danger: { color: tokens.colorPaletteRedForeground1 },
  pdf: {
    width: "100%",
    height: "720px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: tokens.spacingHorizontalL,
  },
  mono: { fontFamily: tokens.fontFamilyMonospace, overflowWrap: "anywhere" },
});

export function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <Badge appearance="tint" color={statusColor(status)}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function EinvoiceBadge({ status }: { status: EinvoiceStatus }) {
  if (status === "not_applicable") return null;
  const color =
    status === "pending_irn"
      ? "warning"
      : status === "irn_registered"
        ? "success"
        : "danger";
  return (
    <Badge appearance="outline" color={color}>
      {EINVOICE_LABELS[status]}
    </Badge>
  );
}

export function Money({
  amount,
  currency,
  strong,
}: {
  amount: string | null | undefined;
  currency: string;
  strong?: boolean;
}) {
  const s = useBillingStyles();
  return (
    <span className={mergeClasses(s.amount, strong && s.strong)}>
      {formatMoney({ amount, currency })}
    </span>
  );
}

/** The `draft_stale` 409: what changed since approval, with "Recompute". */
export function StaleDiffDialog({
  diff,
  onRecompute,
  onClose,
}: {
  diff: StaleDiff | null;
  onRecompute: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const rows = staleRows(diff);
  return (
    <Dialog open={diff !== null} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>The draft is out of date</DialogTitle>
          <DialogContent>
            <MessageBar intent="warning">
              <MessageBarBody>
                Rates, exchange rate or tax changed since this draft was
                approved. Recompute it and review the totals before issuing.
              </MessageBarBody>
            </MessageBar>
            <Table aria-label="Changes since approval" size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Field</TableHeaderCell>
                  <TableHeaderCell>Approved</TableHeaderCell>
                  <TableHeaderCell>Now</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.field}>
                    <TableCell>{r.field}</TableCell>
                    <TableCell>{r.from}</TableCell>
                    <TableCell>{r.to}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
            <Button
              appearance="primary"
              disabled={busy}
              icon={busy ? <Spinner size="tiny" /> : undefined}
              onClick={async () => {
                setBusy(true);
                try {
                  await onRecompute();
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Recompute
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Manual IRN / Ack / signed QR capture (64-hex IRN validated as you type). */
export function IrnDialog({
  open,
  onSubmit,
  onClose,
}: {
  open: boolean;
  onSubmit: (body: IrnIn) => Promise<unknown>;
  onClose: () => void;
}) {
  const s = useBillingStyles();
  const [irn, setIrn] = useState("");
  const [ackNo, setAckNo] = useState("");
  const [ackAt, setAckAt] = useState("");
  const [qr, setQr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const irnMsg = irn ? irnError(irn) : null;
  const valid = !irnError(irn) && ackNo.trim() && ackAt;
  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Record IRN</DialogTitle>
          <DialogContent className={s.stack}>
            {error && (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            <Field
              label="IRN"
              required
              validationMessage={irnMsg ?? undefined}
              validationState={irnMsg ? "error" : "none"}
            >
              <Input
                value={irn}
                onChange={(_, d) => setIrn(d.value.trim())}
                className={s.mono}
              />
            </Field>
            <Field label="Ack number" required>
              <Input value={ackNo} onChange={(_, d) => setAckNo(d.value)} />
            </Field>
            <Field label="Ack date and time" required>
              <Input
                type="datetime-local"
                value={ackAt}
                onChange={(_, d) => setAckAt(d.value)}
              />
            </Field>
            <Field label="Signed QR code">
              <Textarea
                value={qr}
                onChange={(_, d) => setQr(d.value)}
                resize="vertical"
              />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={!valid || busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await onSubmit({
                    irn: irn.toLowerCase(),
                    ack_no: ackNo.trim(),
                    ack_at: new Date(ackAt).toISOString(),
                    signed_qr: qr.trim() || undefined,
                  });
                  onClose();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Could not record the IRN",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save IRN
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
