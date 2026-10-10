"use client";

import { Card, CardHeader, Field, Input, makeStyles, Subtitle2, Text, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { reasonLabel } from "@/features/audiences/logic";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { marketingApi, marketingKeys } from "./api";
import { FunnelChart } from "./funnel-chart";
import { formatRate } from "./logic";

const useStyles = makeStyles({
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalL },
  kpi: { padding: tokens.spacingHorizontalL },
  kpiValue: { fontSize: tokens.fontSizeHero700, lineHeight: tokens.lineHeightHero700, fontWeight: tokens.fontWeightSemibold, fontVariantNumeric: "tabular-nums" },
  muted: { color: tokens.colorNeutralForeground3 },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
    gap: tokens.spacingHorizontalL,
    "@media (max-width: 1000px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** `/marketing`: funnel across all campaigns and sequences for a date range. */
export function MarketingOverview() {
  const styles = useStyles();
  const admin = useAdminStyles();
  const canRead = usePermission("campaign:read");
  const [from, setFrom] = useState(() => isoDaysAgo(30));
  const [to, setTo] = useState(() => isoDaysAgo(0));
  const overview = useQuery({
    queryKey: marketingKeys.overview(from || null, to || null),
    queryFn: ({ signal }) => marketingApi.overview(from || null, to || null, signal),
    enabled: canRead,
  });
  if (!canRead) return <NoAccess what="recruitment marketing" />;
  const f = overview.data;
  const kpis = f
    ? [
        { label: "Sent", value: f.counts.sent.toLocaleString() },
        { label: "Delivery rate", value: formatRate(f.rates.delivery_rate) },
        { label: "Click rate", value: formatRate(f.rates.click_rate) },
        { label: "Applied", value: f.counts.applied.toLocaleString() },
        { label: "Hired", value: f.counts.hired.toLocaleString() },
      ]
    : [];
  return (
    <>
      <div className={admin.toolbar}>
        <Field label="From">
          <Input type="date" value={from} max={to || undefined} onChange={(_, d) => setFrom(d.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} min={from || undefined} onChange={(_, d) => setTo(d.value)} />
        </Field>
      </div>
      {overview.isPending ? (
        <GridSkeleton rows={6} />
      ) : overview.isError ? (
        <ErrorBar title="Could not load the overview." message={errorMessage(overview.error)} />
      ) : (
        f && (
          <>
            <div className={styles.kpis}>
              {kpis.map((k) => (
                <Card key={k.label} className={styles.kpi}>
                  <Text className={styles.muted}>{k.label}</Text>
                  <Text className={styles.kpiValue}>{k.value}</Text>
                </Card>
              ))}
            </div>
            <div className={styles.grid}>
              <Card>
                <CardHeader header={<Subtitle2 as="h2">Funnel</Subtitle2>} />
                <FunnelChart counts={f.counts} rates={f.rates} label="Marketing funnel" />
              </Card>
              <Card>
                <CardHeader header={<Subtitle2 as="h2">Suppressed</Subtitle2>} />
                {Object.keys(f.suppressed_by_reason).length === 0 ? (
                  <Text className={styles.muted}>Nothing suppressed in this period.</Text>
                ) : (
                  <dl className={admin.detailList}>
                    {Object.entries(f.suppressed_by_reason).map(([r, n]) => (
                      <div key={r} style={{ display: "contents" }}>
                        <dt>{reasonLabel(r)}</dt>
                        <dd>{n.toLocaleString()}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </Card>
            </div>
          </>
        )
      )}
    </>
  );
}
