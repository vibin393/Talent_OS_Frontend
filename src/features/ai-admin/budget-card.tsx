"use client";

import {
  Body1,
  Caption1,
  Card,
  CardHeader,
  makeStyles,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { aiFeatureLabel } from "./ai-features";
import { BUDGET_THRESHOLDS, budgetState, markerPosition } from "./budget-state";

export type AiUsageOut = {
  month: string;
  total_tokens: number;
  budget: number | null;
  percent: number | null;
  bulk_paused: boolean;
  all_blocked: boolean;
  by_feature: Record<string, number>;
  by_day: Record<string, number>;
};

export const AI_USAGE_KEY = ["ai", "usage"] as const;

const useStyles = makeStyles({
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: `0 ${tokens.spacingHorizontalM} ${tokens.spacingVerticalM}` },
  barWrap: { position: "relative", paddingTop: tokens.spacingVerticalXL },
  marker: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "0",
    borderLeft: `${tokens.strokeWidthThin} dashed ${tokens.colorNeutralStroke1}`,
  },
  markerLabel: {
    position: "absolute",
    top: 0,
    transform: "translateX(-50%)",
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  stats: { display: "flex", gap: tokens.spacingHorizontalXXL, flexWrap: "wrap" },
  stat: { display: "flex", flexDirection: "column" },
  num: { textAlign: "end" },
});

const fmt = (n: number) => n.toLocaleString("en-US");

/** Read-only monthly budget (set by the platform operator) with 80/100/120 % markers and usage by feature. */
export function BudgetCard() {
  const styles = useStyles();
  const usage = useQuery({
    queryKey: AI_USAGE_KEY,
    queryFn: ({ signal }) => api.get<AiUsageOut>("/api/v1/ai/usage", { signal }),
    refetchInterval: 60_000,
  });
  return (
    <Card>
      <CardHeader
        header={<Subtitle2 as="h2">Monthly token budget</Subtitle2>}
        description={<Caption1>Set by your Talent OS platform operator. Contact support to change it.</Caption1>}
      />
      <div className={styles.body}>
        {usage.isPending ? (
          <GridSkeleton rows={3} />
        ) : usage.isError ? (
          <ErrorBar message={errorMessage(usage.error)} />
        ) : (
          <BudgetBody usage={usage.data} />
        )}
      </div>
    </Card>
  );
}

function BudgetBody({ usage }: { usage: AiUsageOut }) {
  const styles = useStyles();
  const view = budgetState(usage.total_tokens, usage.budget);
  const features = Object.entries(usage.by_feature).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <Caption1>Budget ({usage.month})</Caption1>
          <Body1>{usage.budget === null ? "No limit" : `${fmt(usage.budget)} tokens`}</Body1>
        </div>
        <div className={styles.stat}>
          <Caption1>Used</Caption1>
          <Body1>
            {fmt(usage.total_tokens)} tokens{view.percent !== null ? ` (${Math.round(view.percent)}%)` : ""}
          </Body1>
        </div>
      </div>
      {view.state !== "unlimited" && (
        <div className={styles.barWrap} aria-label="Budget usage">
          {BUDGET_THRESHOLDS.map((t) => (
            <span key={t}>
              <span className={styles.marker} style={{ left: `${markerPosition(t)}%` }} aria-hidden />
              <span className={styles.markerLabel} style={{ left: `${markerPosition(t)}%` }} aria-hidden>
                {t}%
              </span>
            </span>
          ))}
          <ProgressBar value={view.bar} max={1} color={view.color} thickness="large" aria-valuetext={`${Math.round(view.percent ?? 0)}% of the budget`} />
        </div>
      )}
      {(view.message || usage.bulk_paused) && (
        <MessageBar intent={view.intent ?? "warning"} layout="multiline">
          <MessageBarBody>{view.message ?? "Bulk AI paused: the monthly budget is used up."}</MessageBarBody>
        </MessageBar>
      )}
      {features.length > 0 && (
        <Table size="small" aria-label="Usage by feature">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Feature</TableHeaderCell>
              <TableHeaderCell className={styles.num}>Tokens</TableHeaderCell>
              <TableHeaderCell className={styles.num}>Share</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {features.map(([f, tokensUsed]) => (
              <TableRow key={f}>
                <TableCell>{aiFeatureLabel(f)}</TableCell>
                <TableCell className={styles.num}>{fmt(tokensUsed)}</TableCell>
                <TableCell className={styles.num}>
                  {usage.total_tokens > 0 ? `${Math.round((tokensUsed / usage.total_tokens) * 100)}%` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
