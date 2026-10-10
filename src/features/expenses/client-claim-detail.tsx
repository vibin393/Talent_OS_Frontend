"use client";

import {
  Badge,
  Body1,
  Caption1,
  Card,
  Link as FluentLink,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import { ErrorBlock, InlineError, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { errorMessage } from "@/lib/api/errors";
import { clientExpensesApi } from "./api";
import { DecisionPanel } from "./decision-panel";
import { categoryLabel, formatDate, LINE_STATUS_LABELS, lineStatusColor, statusColor, statusLabel } from "./format";
import { formatMoney } from "./money";
import { useClientExpense } from "./use-client-expenses";

const useStyles = makeStyles({
  line: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    padding: `${tokens.spacingVerticalS} 0`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
  },
  head: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: tokens.spacingHorizontalS },
  amount: { fontVariantNumeric: "tabular-nums" },
  comment: { color: tokens.colorNeutralForeground3, fontStyle: "italic" },
});

/** `/client/expenses/[id]`: billable lines with receipt preview and per-line approve / reject. Mobile-first. */
export function ClientClaimDetailView({ id }: { id: string }) {
  const portal = usePortalStyles();
  const styles = useStyles();
  const { query, decide } = useClientExpense(id);
  if (query.isPending) return <LoadingBlock label="Loading expense claim" />;
  if (query.isError) return <ErrorBlock error={query.error} onRetry={() => query.refetch()} />;
  const claim = query.data;
  const pendingLines = claim.lines.filter((l) => l.line_status !== "rejected");
  return (
    <div className={portal.page}>
      <FluentLink href="/client/expenses" style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44 }}>
        <ArrowLeft20Regular aria-hidden /> Expenses
      </FluentLink>
      <PortalPageHeader
        title={`${claim.worker_name ?? "Worker"} · ${claim.title || claim.human_id}`}
        subtitle={[claim.role_title, claim.human_id].filter(Boolean).join(" · ")}
      />
      <Card className={portal.card}>
        <div className={portal.actions}>
          <Badge appearance="tint" color={claim.awaiting_client ? "warning" : statusColor(claim.status)}>
            {claim.awaiting_client ? "Awaiting you" : statusLabel(claim.status)}
          </Badge>
          <Text weight="semibold">Billable {formatMoney(claim.billable_total, claim.currency)}</Text>
        </div>
        {claim.lines.length === 0 ? (
          <Body1 className={portal.empty}>No billable expenses.</Body1>
        ) : (
          <ul className={portal.list}>
            {claim.lines.map((l) => (
              <li key={l.id} className={styles.line}>
                <div className={styles.head}>
                  <Text weight="semibold">
                    {categoryLabel(l.category)} · {formatDate(l.expense_date)}
                  </Text>
                  <Text weight="semibold" className={styles.amount}>
                    {formatMoney(l.bill_amount ?? l.amount_claim_ccy, claim.currency)}
                  </Text>
                </div>
                {l.description && <Caption1>{l.description}</Caption1>}
                <div className={portal.actions}>
                  <Badge appearance="tint" color={lineStatusColor(l.line_status)}>
                    {LINE_STATUS_LABELS[l.line_status] ?? l.line_status}
                  </Badge>
                  {l.has_receipt ? (
                    <FluentLink href={clientExpensesApi.receiptUrl(claim.id, l.id)} target="_blank" rel="noopener noreferrer">
                      View receipt
                    </FluentLink>
                  ) : (
                    <Caption1>No receipt</Caption1>
                  )}
                </div>
                {l.decision_comment && <Caption1 className={styles.comment}>{l.decision_comment}</Caption1>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {claim.awaiting_client && (
        <Card className={portal.card}>
          <Text weight="semibold">Your decision</Text>
          {!claim.line_decisions_supported && (
            <Caption1>Your decision applies to all billable expenses on this claim.</Caption1>
          )}
          <DecisionPanel
            perLine={claim.line_decisions_supported}
            pending={decide.isPending}
            onDecide={(body) => decide.mutate(body)}
            lines={pendingLines.map((l) => ({
              id: l.id,
              title: `${categoryLabel(l.category)} · ${formatDate(l.expense_date)}`,
              detail: l.description ?? undefined,
              amount: formatMoney(l.bill_amount ?? l.amount_claim_ccy, claim.currency),
            }))}
          />
          <InlineError message={decide.isError ? errorMessage(decide.error) : null} />
        </Card>
      )}
      {decide.isSuccess && (
        <MessageBar intent="success">
          <MessageBarBody>Decision recorded.</MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}
