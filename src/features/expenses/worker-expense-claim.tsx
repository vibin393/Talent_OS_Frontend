"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Link as FluentLink,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowLeft20Regular, ArrowUndo20Regular, Delete20Regular, Edit20Regular, Send20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { errorMessage } from "@/lib/api/errors";
import { workerExpensesApi } from "./api";
import { ExpenseLineDialog } from "./expense-line-dialog";
import {
  categoryLabel,
  expenseErrorMessage,
  flagLabel,
  formatDate,
  justificationLineIds,
  LINE_STATUS_LABELS,
  lineStatusColor,
  linesMissingJustification,
  statusColor,
  statusLabel,
} from "./format";
import { formatMoney, sumMoney } from "./money";
import type { WorkerLine } from "./types";
import { useMyExpenseSettings } from "./use-expense-claims";
import { useMyExpenseClaim } from "./use-expense-claim";

const useStyles = makeStyles({
  line: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalS} 0`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
  },
  lineHead: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: tokens.spacingHorizontalS, alignItems: "baseline" },
  missing: { borderLeft: `3px solid ${tokens.colorPaletteRedBorder2}`, paddingLeft: tokens.spacingHorizontalS },
  amount: { fontVariantNumeric: "tabular-nums" },
  comment: { color: tokens.colorPaletteRedForeground1 },
  total: { display: "flex", justifyContent: "space-between", fontVariantNumeric: "tabular-nums" },
});

/** `/portal/work/expenses/[id]`: one claim — lines, add / edit / delete, submit with summary, recall. Mobile-first. */
export function WorkerExpenseClaim({ id }: { id: string }) {
  const portal = usePortalStyles();
  const styles = useStyles();
  const c = useMyExpenseClaim(id);
  const settings = useMyExpenseSettings();
  const [editing, setEditing] = useState<WorkerLine | "new" | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [deleting, setDeleting] = useState<WorkerLine | null>(null);
  if (c.query.isPending) return <LoadingBlock label="Loading claim" />;
  if (c.query.isError) return <ErrorBlock error={c.query.error} onRetry={() => c.query.refetch()} />;
  const claim = c.query.data;
  const missing = new Set([...linesMissingJustification(claim.lines), ...justificationLineIds(c.submit.error)]);
  const s = settings.data;

  return (
    <div className={portal.page}>
      <FluentLink href="/portal/work/expenses" style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44 }}>
        <ArrowLeft20Regular aria-hidden /> My expenses
      </FluentLink>
      <PortalPageHeader
        title={claim.title || claim.human_id}
        subtitle={[claim.client_name, claim.role_title, claim.human_id].filter(Boolean).join(" · ")}
      />
      <Card className={portal.card}>
        <div className={portal.actions}>
          <Badge appearance="tint" color={statusColor(claim.status)}>
            {statusLabel(claim.status)}
          </Badge>
          <Text weight="semibold">Claimed {formatMoney(claim.total_claimed, claim.currency)}</Text>
          {claim.total_approved !== null && <Caption1>Approved {formatMoney(claim.total_approved, claim.currency)}</Caption1>}
        </div>
        {claim.rejection_comment && (
          <MessageBar intent="warning" layout="multiline">
            <MessageBarBody>
              Rejected: {claim.rejection_comment}
              {claim.editable ? " Edit the expenses and submit again." : ""}
            </MessageBarBody>
          </MessageBar>
        )}
        <div className={portal.actions}>
          {claim.editable && (
            <Button className={portal.button} icon={<Add20Regular />} onClick={() => setEditing("new")}>
              Add expense
            </Button>
          )}
          {claim.editable && (
            <Button
              appearance="primary"
              className={portal.button}
              icon={<Send20Regular />}
              disabled={claim.lines.length === 0}
              onClick={() => {
                c.submit.reset();
                setConfirmSubmit(true);
              }}
            >
              Submit
            </Button>
          )}
          {claim.can_recall && (
            <Button
              className={portal.button}
              icon={c.recall.isPending ? <Spinner size="tiny" /> : <ArrowUndo20Regular />}
              disabled={c.recall.isPending}
              onClick={() => c.recall.mutate()}
            >
              Recall
            </Button>
          )}
        </div>
        <InlineError message={c.recall.isError ? errorMessage(c.recall.error) : null} />
        <InlineError message={c.submit.isError && !confirmSubmit ? expenseErrorMessage(c.submit.error, errorMessage) : null} />
        <InlineError message={c.deleteLine.isError ? errorMessage(c.deleteLine.error) : null} />
      </Card>

      <Card className={portal.card}>
        <Text weight="semibold">Expenses</Text>
        {claim.lines.length === 0 ? (
          <Body1 className={portal.empty}>No expenses yet. Add your first expense with its receipt.</Body1>
        ) : (
          <ul className={portal.list}>
            {claim.lines.map((l) => (
              <li key={l.id} className={missing.has(l.id) ? `${styles.line} ${styles.missing}` : styles.line}>
                <div className={styles.lineHead}>
                  <Text weight="semibold">
                    {categoryLabel(l.category)} · {formatDate(l.expense_date)}
                  </Text>
                  <Text weight="semibold" className={styles.amount}>
                    {formatMoney(l.amount_claim_ccy, claim.currency)}
                  </Text>
                </div>
                {l.description && <Caption1>{l.description}</Caption1>}
                <Caption1>
                  {[
                    l.category === "mileage" && l.km ? `${l.km} km` : null,
                    l.currency !== claim.currency ? `${formatMoney(l.amount, l.currency)} at ${l.fx_rate ?? "—"}` : null,
                    l.billable ? "Billable" : null,
                    !l.reimbursable ? "Company paid" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Caption1>
                <div className={portal.actions}>
                  {claim.status !== "draft" && (
                    <Badge appearance="tint" color={lineStatusColor(l.line_status)}>
                      {LINE_STATUS_LABELS[l.line_status] ?? l.line_status}
                    </Badge>
                  )}
                  {l.flags.map((f) => (
                    <Badge key={f} appearance="tint" color="warning">
                      {flagLabel(f)}
                    </Badge>
                  ))}
                  {l.receipt_file_id ? (
                    <FluentLink href={workerExpensesApi.receiptUrl(l.receipt_file_id)} target="_blank" rel="noopener noreferrer">
                      {l.receipt_name ?? "Receipt"}
                    </FluentLink>
                  ) : (
                    <Caption1>No receipt</Caption1>
                  )}
                </div>
                {l.justification && <Caption1>Justification: {l.justification}</Caption1>}
                {missing.has(l.id) && <Caption1 className={styles.comment}>Add a justification for this flagged expense.</Caption1>}
                {l.decision_comment && <Caption1 className={styles.comment}>Comment: {l.decision_comment}</Caption1>}
                {claim.editable && (
                  <div className={portal.actions}>
                    <Button className={portal.button} appearance="subtle" icon={<Edit20Regular />} onClick={() => setEditing(l)}>
                      Edit
                    </Button>
                    <Button className={portal.button} appearance="subtle" icon={<Delete20Regular />} onClick={() => setDeleting(l)}>
                      Delete
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <ExpenseLineDialog
          title={editing === "new" ? "Add expense" : "Edit expense"}
          claimId={claim.id}
          claimCurrency={claim.currency}
          minDate={claim.placement_start}
          maxDate={claim.placement_end}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          preview={(body) => workerExpensesApi.previewLine(claim.id, body)}
          save={(body) => c.saveLine.mutateAsync({ lineId: editing === "new" ? null : editing.id, body })}
          upload={(file) => c.upload.mutateAsync(file)}
          readReceipt={s?.ai_receipt_read_enabled ? (fileId) => c.readReceipt.mutateAsync(fileId) : undefined}
          receiptUrl={workerExpensesApi.receiptUrl}
          maxReceiptMb={s?.max_receipt_mb}
          allowedTypes={s?.allowed_receipt_types}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(_, d) => !d.open && setDeleting(null)} modalType="alert">
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete expense?</DialogTitle>
            <DialogContent>
              {deleting && `${categoryLabel(deleting.category)} on ${formatDate(deleting.expense_date)} — ${formatMoney(deleting.amount_claim_ccy, claim.currency)}`}
            </DialogContent>
            <DialogActions>
              <Button className={portal.button} onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                className={portal.button}
                disabled={c.deleteLine.isPending}
                onClick={() => {
                  if (deleting) c.deleteLine.mutate(deleting.id);
                  setDeleting(null);
                }}
              >
                Delete
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={confirmSubmit} onOpenChange={(_, d) => !d.open && !c.submit.isPending && setConfirmSubmit(false)} modalType="alert">
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Submit claim</DialogTitle>
            <DialogContent className={portal.form}>
              <Body1>
                {claim.lines.length} expense{claim.lines.length === 1 ? "" : "s"} will be sent for approval.
              </Body1>
              <div className={styles.total}>
                <Text>Total</Text>
                <Text weight="semibold">{formatMoney(sumMoney(claim.lines.map((l) => l.amount_claim_ccy)), claim.currency)}</Text>
              </div>
              <div className={styles.total}>
                <Text>Billable to client</Text>
                <Text>{formatMoney(sumMoney(claim.lines.filter((l) => l.billable).map((l) => l.amount_claim_ccy)), claim.currency)}</Text>
              </div>
              {missing.size > 0 && (
                <MessageBar intent="warning" layout="multiline">
                  <MessageBarBody>
                    {missing.size} flagged expense{missing.size === 1 ? " needs" : "s need"} a justification before you can submit.
                  </MessageBarBody>
                </MessageBar>
              )}
              <InlineError message={c.submit.isError ? expenseErrorMessage(c.submit.error, errorMessage) : null} />
            </DialogContent>
            <DialogActions>
              <Button className={portal.button} disabled={c.submit.isPending} onClick={() => setConfirmSubmit(false)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                className={portal.button}
                disabled={c.submit.isPending || missing.size > 0}
                icon={c.submit.isPending ? <Spinner size="tiny" /> : undefined}
                onClick={async () => {
                  try {
                    await c.submit.mutateAsync();
                    setConfirmSubmit(false);
                  } catch {
                    // shown in the dialog
                  }
                }}
              >
                Submit
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
