"use client";

import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Link,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowUndo20Regular, Delete20Regular, Edit20Regular, LockClosed16Regular, Send20Regular } from "@fluentui/react-icons";
import NextLink from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { expensesApi } from "./api";
import { DecisionPanel } from "./decision-panel";
import { ExpenseLineDialog } from "./expense-line-dialog";
import { EXPENSE_READ_PERMISSIONS } from "./expense-claims-view";
import {
  categoryLabel,
  expenseErrorMessage,
  flagLabel,
  formatDate,
  LINE_STATUS_LABELS,
  lineStatusColor,
  REBILL_LABELS,
  statusColor,
  statusLabel,
  TAX_MODE_LABELS,
} from "./format";
import { formatMoney } from "./money";
import type { ClaimLineOut } from "./types";
import { useExpenseClaim } from "./use-expense-claim";

const useStyles = makeStyles({
  section: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, marginBottom: tokens.spacingVerticalL },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalL },
  num: { textAlign: "end", fontVariantNumeric: "tabular-nums" },
  scroll: { overflowX: "auto" },
  table: { minWidth: "1000px" },
  comment: { color: tokens.colorNeutralForeground3, fontStyle: "italic" },
});

const dash = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? "—" : v);

/** `/expenses/[id]`: internal claim detail — lines with receipts, flags, re-bill terms, history, decide, reopen, proxy entry. */
export function ExpenseClaimDetail({ id }: { id: string }) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const toast = useAppToast();
  const perms = usePermissions();
  const canRead = hasAnyPermission(perms, EXPENSE_READ_PERMISSIONS);
  const canAdmin = hasAnyPermission(perms, ["expense:admin"]);
  const c = useExpenseClaim(id);
  const [dialog, setDialog] = useState<null | "reopen" | "submit">(null);
  const [editing, setEditing] = useState<ClaimLineOut | "new" | null>(null);
  const [reason, setReason] = useState("");
  if (!canRead) return <NoAccess what="expenses" />;
  if (c.query.isPending) return <GridSkeleton />;
  if (c.query.isError) return <ErrorBar title="Could not load the expense claim." message={errorMessage(c.query.error)} />;
  const claim = c.query.data;
  const proxyEditable = canAdmin && claim.status === "draft";
  const deciding = claim.status === "submitted" || claim.status === "in_approval";

  return (
    <>
      <PageHeader
        title={`${claim.human_id}${claim.title ? ` · ${claim.title}` : ""}`}
        subtitle={[claim.worker_name, claim.client_name].filter(Boolean).join(" · ")}
      />
      <div className={styles.actions}>
        <Badge appearance="tint" color={statusColor(claim.status)} size="large">
          {statusLabel(claim.status)}
        </Badge>
        {claim.is_proxy && <Badge appearance="outline">Proxy</Badge>}
        {claim.locked && (
          <Badge appearance="tint" color="danger" icon={<LockClosed16Regular />}>
            Posted — locked
          </Badge>
        )}
        <span className={admin.grow} />
        {proxyEditable && (
          <Button icon={<Add20Regular />} onClick={() => setEditing("new")}>
            Add expense
          </Button>
        )}
        {proxyEditable && (
          <Button
            appearance="primary"
            icon={<Send20Regular />}
            disabled={claim.lines.length === 0}
            onClick={() => {
              setReason(claim.proxy_reason ?? "");
              c.submit.reset();
              setDialog("submit");
            }}
          >
            Submit for worker
          </Button>
        )}
        {claim.can_reopen && canAdmin && (
          <Button
            icon={<ArrowUndo20Regular />}
            onClick={() => {
              setReason("");
              c.reopen.reset();
              setDialog("reopen");
            }}
          >
            Reopen
          </Button>
        )}
      </div>

      <Card className={styles.section}>
        <dl className={admin.detailList}>
          <dt>Placement</dt>
          <dd>
            <NextLink href={`/placements/${encodeURIComponent(claim.placement_id)}`}>Open placement</NextLink>
          </dd>
          <dt>Claimed</dt>
          <dd>{formatMoney(claim.total_claimed, claim.currency)}</dd>
          <dt>Approved</dt>
          <dd>{formatMoney(claim.total_approved, claim.currency)}</dd>
          <dt>Submitted</dt>
          <dd>{formatDateTime(claim.submitted_at)}</dd>
          {claim.current_step && (
            <>
              <dt>Current step</dt>
              <dd>{claim.current_step}</dd>
            </>
          )}
          {claim.approved_at && (
            <>
              <dt>Approved at</dt>
              <dd>{formatDateTime(claim.approved_at)}</dd>
            </>
          )}
          {claim.reimbursed_at && (
            <>
              <dt>Reimbursed</dt>
              <dd>
                {formatDateTime(claim.reimbursed_at)}
                {claim.payroll_reference ? ` · ${claim.payroll_reference}` : ""}
              </dd>
            </>
          )}
          {claim.stated_at && (
            <>
              <dt>Stated</dt>
              <dd>{formatDateTime(claim.stated_at)}</dd>
            </>
          )}
          {claim.proxy_reason && (
            <>
              <dt>Proxy reason</dt>
              <dd>{claim.proxy_reason}</dd>
            </>
          )}
          {claim.reopen_reason && (
            <>
              <dt>Reopen reason</dt>
              <dd>{claim.reopen_reason}</dd>
            </>
          )}
        </dl>
        {claim.rejection_comment && (
          <MessageBar intent="warning" layout="multiline">
            <MessageBarBody>Rejected: {claim.rejection_comment}</MessageBarBody>
          </MessageBar>
        )}
      </Card>

      <Card className={styles.section}>
        <Subtitle2 as="h2">Expenses</Subtitle2>
        <div className={styles.scroll}>
          <Table aria-label="Expense lines" className={styles.table} size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell>Description</TableHeaderCell>
                <TableHeaderCell className={styles.num}>Amount</TableHeaderCell>
                <TableHeaderCell className={styles.num}>In {claim.currency}</TableHeaderCell>
                <TableHeaderCell>Re-bill</TableHeaderCell>
                <TableHeaderCell className={styles.num}>Markup %</TableHeaderCell>
                <TableHeaderCell className={styles.num}>Bill amount</TableHeaderCell>
                <TableHeaderCell>Flags</TableHeaderCell>
                <TableHeaderCell>Receipt</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                {proxyEditable && <TableHeaderCell>Actions</TableHeaderCell>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {claim.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{formatDate(l.expense_date)}</TableCell>
                  <TableCell>{categoryLabel(l.category)}</TableCell>
                  <TableCell>
                    <span className={admin.cellStack}>
                      <span>{dash(l.description)}</span>
                      {l.category === "mileage" && l.km && <span className={admin.muted}>{l.km} km</span>}
                      {l.justification && <span className={styles.comment}>Justification: {l.justification}</span>}
                      {l.decision_comment && <span className={styles.comment}>Decision: {l.decision_comment}</span>}
                    </span>
                  </TableCell>
                  <TableCell className={styles.num}>{formatMoney(l.amount, l.currency)}</TableCell>
                  <TableCell className={styles.num}>
                    <span className={admin.cellStack}>
                      <span>{formatMoney(l.amount_claim_ccy, claim.currency)}</span>
                      {l.fx_rate && (
                        <span className={admin.muted}>
                          @ {l.fx_rate} {l.fx_rate_date ? `(${l.fx_rate_date})` : ""}
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={admin.cellStack}>
                      <span>{l.billable ? (l.rebill_method ? REBILL_LABELS[l.rebill_method] : "Billable") : "Not billable"}</span>
                      {l.rebill_tax_mode && <span className={admin.muted}>{TAX_MODE_LABELS[l.rebill_tax_mode]}</span>}
                      {!l.reimbursable && <span className={admin.muted}>Company paid</span>}
                    </span>
                  </TableCell>
                  <TableCell className={styles.num}>{dash(l.markup_pct)}</TableCell>
                  <TableCell className={styles.num}>{l.bill_amount ? formatMoney(l.bill_amount, claim.currency) : "—"}</TableCell>
                  <TableCell>
                    <span className={admin.badges}>
                      {l.flags.length === 0
                        ? "—"
                        : l.flags.map((f) => (
                            <Badge key={f} appearance="tint" color="warning">
                              {flagLabel(f)}
                            </Badge>
                          ))}
                    </span>
                  </TableCell>
                  <TableCell>
                    {l.receipt_file_id ? (
                      <Link href={expensesApi.receiptUrl(claim.id, l.id)} target="_blank" rel="noopener noreferrer">
                        {l.receipt_name ?? "Receipt"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={admin.badges}>
                      <Badge appearance="tint" color={lineStatusColor(l.line_status)}>
                        {LINE_STATUS_LABELS[l.line_status] ?? l.line_status}
                      </Badge>
                      {l.payable_posted && <Badge appearance="outline">Payroll</Badge>}
                      {l.billing_posted && <Badge appearance="outline">Billed</Badge>}
                    </span>
                  </TableCell>
                  {proxyEditable && (
                    <TableCell>
                      <Button appearance="subtle" size="small" icon={<Edit20Regular />} aria-label="Edit" onClick={() => setEditing(l)} />
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<Delete20Regular />}
                        aria-label="Delete"
                        disabled={c.deleteLine.isPending}
                        onClick={() => c.deleteLine.mutate(l.id, { onError: (e) => toast.error(errorMessage(e)) })}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {claim.lines.length === 0 && <Text className={admin.muted}>No expenses on this claim.</Text>}
      </Card>

      {deciding && (
        <Card className={styles.section}>
          <Subtitle2 as="h2">Decision</Subtitle2>
          <Text className={admin.muted}>Approve or reject each expense. A reason is required for every rejected expense.</Text>
          <DecisionPanel
            perLine
            pending={c.decide.isPending}
            onDecide={(body) =>
              c.decide.mutate(body, {
                onSuccess: () => toast.success("Decision recorded"),
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
            lines={claim.lines
              .filter((l) => l.line_status !== "rejected")
              .map((l) => ({
                id: l.id,
                title: `${categoryLabel(l.category)} · ${formatDate(l.expense_date)}`,
                detail: [l.description, ...l.flags.map(flagLabel)].filter(Boolean).join(" · ") || undefined,
                amount: formatMoney(l.amount_claim_ccy, claim.currency),
              }))}
          />
        </Card>
      )}

      <Card className={styles.section}>
        <Subtitle2 as="h2">Approval history</Subtitle2>
        {claim.approval_history.length === 0 ? (
          <Text className={admin.muted}>No decisions yet.</Text>
        ) : (
          <Table aria-label="Approval history" size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Step</TableHeaderCell>
                <TableHeaderCell>Outcome</TableHeaderCell>
                <TableHeaderCell>By</TableHeaderCell>
                <TableHeaderCell>Comment</TableHeaderCell>
                <TableHeaderCell>When</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claim.approval_history.map((h, i) => (
                <TableRow key={i}>
                  <TableCell>{dash(h.name)}</TableCell>
                  <TableCell>{dash(h.outcome)}</TableCell>
                  <TableCell>{dash(h.actor_kind)}</TableCell>
                  <TableCell>{dash(h.comment)}</TableCell>
                  <TableCell>{formatDateTime(h.decided_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {editing && (
        <ExpenseLineDialog
          title={editing === "new" ? "Add expense" : "Edit expense"}
          claimId={claim.id}
          claimCurrency={claim.currency}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          preview={(body) => expensesApi.previewLine(claim.id, body)}
          save={(body) => c.saveLine.mutateAsync({ lineId: editing === "new" ? null : editing.id, body })}
        />
      )}

      <Dialog open={dialog !== null} onOpenChange={(_, d) => !d.open && setDialog(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{dialog === "reopen" ? "Reopen claim" : "Submit on behalf of the worker"}</DialogTitle>
            <DialogContent className={admin.form}>
              <Field label="Reason" required>
                <Textarea value={reason} maxLength={2000} onChange={(_, d) => setReason(d.value)} />
              </Field>
              <ErrorBar
                message={
                  dialog === "reopen" && c.reopen.isError
                    ? expenseErrorMessage(c.reopen.error, errorMessage)
                    : dialog === "submit" && c.submit.isError
                      ? expenseErrorMessage(c.submit.error, errorMessage)
                      : null
                }
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialog(null)}>Cancel</Button>
              <Button
                appearance="primary"
                disabled={!reason.trim() || c.reopen.isPending || c.submit.isPending}
                onClick={async () => {
                  try {
                    if (dialog === "reopen") await c.reopen.mutateAsync(reason.trim());
                    else await c.submit.mutateAsync(reason.trim());
                    toast.success(dialog === "reopen" ? "Claim reopened" : "Claim submitted");
                    setDialog(null);
                  } catch {
                    // shown inline
                  }
                }}
              >
                {dialog === "reopen" ? "Reopen" : "Submit"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
