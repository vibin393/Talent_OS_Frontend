"use client";

import { Badge, Caption1, makeStyles, MessageBar, MessageBarBody, Spinner, Text, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { pipelineApi } from "@/features/pipeline/api";
import { pipelineError } from "@/features/pipeline/use-actions";
import { useDebounced } from "@/lib/use-debounced";
import type { MarginPreviewIn } from "@/lib/api/types";
import { formatMoney, formatPct, marginTone, rateErrors, type WizardItem } from "./wizard-logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, minHeight: "32px" },
  line: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** Live margin from the debounced `POST /submissions/margin-preview` (needs `compensation:view`). */
export function MarginPreview({ demandId, item }: { demandId: string; item: WizardItem }) {
  const styles = useStyles();
  const errors = rateErrors(item);
  const ready = !errors.pay && !errors.bill && !errors.currency;
  const body: MarginPreviewIn = {
    demand_id: demandId,
    pay_rate: { amount: item.payAmount.trim(), currency: item.currency },
    bill_rate: { amount: item.billAmount.trim(), currency: item.currency },
    pay_rate_unit: item.payUnit,
    bill_rate_unit: item.billUnit,
  };
  const key = useDebounced(JSON.stringify(body), 400);
  const preview = useQuery({
    queryKey: ["pipeline", "margin", key],
    queryFn: ({ signal }) => pipelineApi.marginPreview(JSON.parse(key) as MarginPreviewIn, signal),
    enabled: ready,
    retry: false,
    placeholderData: (prev) => prev,
  });

  if (!ready) return <Caption1 className={styles.muted}>Enter both rates to see the margin.</Caption1>;
  if (preview.isError) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{pipelineError(preview.error)}</MessageBarBody>
      </MessageBar>
    );
  }
  const m = preview.data;
  if (!m) return <Spinner size="tiny" label="Calculating margin…" labelPosition="after" />;
  const tone = marginTone(m);
  return (
    <div className={styles.root} aria-live="polite">
      <div className={styles.line}>
        <Text weight="semibold">Margin</Text>
        <Text>{formatMoney(m.margin_amount.amount, m.margin_amount.currency)} per {m.rate_unit}</Text>
        <Badge appearance="filled" color={tone} aria-label={`Margin ${formatPct(m.margin_pct)}`}>
          {formatPct(m.margin_pct)}
        </Badge>
        {preview.isFetching && <Spinner size="extra-tiny" aria-label="Updating" />}
      </div>
      <Caption1 className={styles.muted}>
        Burden {formatPct(m.burden_pct)} · minimum margin {formatPct(m.min_margin_pct)}
      </Caption1>
      {m.below_min_margin && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>Requires margin approval: the submission waits for approval before it is emailed.</MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}
