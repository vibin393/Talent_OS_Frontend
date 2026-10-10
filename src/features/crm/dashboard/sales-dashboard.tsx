"use client";

import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Skeleton,
  SkeletonItem,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Toolbar,
  tokens,
} from "@fluentui/react-components";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { PersonPicker } from "@/features/activity/person-picker";
import { NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { AXIS_PROPS, CHART_FONT, CHART_FONT_SIZE, CHART_HEIGHT, seriesColor } from "@/features/dashboards/chart-theme";
import { ChartTooltip } from "@/features/dashboards/chart-tile";
import { errorMessage } from "@/lib/api/errors";
import { formatMoney, formatMoneyCompact, formatPercent, isoDate, STAGE_LABELS } from "../format";
import type { CurrencyTotal, OpportunityStage } from "../types";
import { useCrmDashboard } from "../use-crm-dashboard";
import { bucketHref, crmTileHref, monthRange } from "./links";
import { chartRows, currenciesOf, seriesFor } from "./series";

const useStyles = makeStyles({
  toolbar: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalL },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: tokens.spacingHorizontalL },
  wide: { gridColumn: "span 2", "@media (max-width: 767px)": { gridColumn: "span 1" } },
  card: { minWidth: 0 },
  big: { fontSize: tokens.fontSizeHero800, lineHeight: tokens.lineHeightHero800, fontWeight: tokens.fontWeightSemibold },
  muted: { color: tokens.colorNeutralForeground3 },
  chart: { height: `${CHART_HEIGHT}px`, minWidth: 0 },
});

function defaultRange() {
  const now = new Date();
  return { from: isoDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: isoDate(new Date(now.getFullYear(), now.getMonth() + 4, 0)) };
}

function Tile({ title, href, wide, children }: { title: string; href: string | null; wide?: boolean; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <Card className={wide ? `${styles.card} ${styles.wide}` : styles.card}>
      <CardHeader header={<Subtitle2 as="h2">{title}</Subtitle2>} action={href ? <AppLink href={href}>View list</AppLink> : undefined} />
      {children}
    </Card>
  );
}

function Totals({ totals }: { totals: CurrencyTotal[] }) {
  const styles = useStyles();
  if (!totals.length) return null;
  return (
    <>
      {totals.map((t) => (
        <Text key={t.currency} block size={200} className={styles.muted}>
          {formatMoney(t.estimated, t.currency)} · weighted {formatMoney(t.weighted, t.currency)}
        </Text>
      ))}
    </>
  );
}

const legendText = (value: unknown) => (
  <span style={{ color: tokens.colorNeutralForeground2, fontFamily: CHART_FONT, fontSize: CHART_FONT_SIZE }}>{String(value)}</span>
);

/** `/sales`: Sales dashboard (pipeline by stage / close month, closing this month, win rate, leads by source). */
export function SalesDashboard() {
  const styles = useStyles();
  const router = useRouter();
  const canRead = usePermission("opportunity:read");
  const [range, setRange] = useState(defaultRange);
  const [owner, setOwner] = useState<{ id: string; name: string } | null>(null);
  const q = useCrmDashboard({ ...range, ownerIds: owner ? [owner.id] : [], teamId: null });
  if (!canRead) return <NoAccess what="the sales dashboard" />;
  const d = q.data;

  const stageBuckets = (d?.pipeline.by_stage ?? []).map((s) => ({ ...s, key: s.stage, label: STAGE_LABELS[s.stage as OpportunityStage] ?? s.stage }));
  const stageCurrencies = currenciesOf(stageBuckets);
  const stageSeries = seriesFor(stageCurrencies, ["estimated", "weighted"]);
  const stageRows = chartRows(stageBuckets, stageSeries);
  const monthBuckets = (d?.pipeline.by_close_month ?? []).map((m) => ({ ...m, key: m.month, label: m.month === "overdue" ? "Overdue" : m.month }));
  const monthSeries = seriesFor(currenciesOf(monthBuckets), ["weighted"]);
  const monthRows = chartRows(monthBuckets, monthSeries);
  const money = (cur: string) => (v: unknown) => formatMoneyCompact(String(v), cur);

  return (
    <>
      <PageHeader title="Sales dashboard" subtitle="Pipeline, conversion and activity for your sales team." />
      <Toolbar className={styles.toolbar} aria-label="Dashboard filters">
        <Field label="From">
          <Input type="date" value={range.from} onChange={(_, v) => v.value && setRange((r) => ({ ...r, from: v.value }))} />
        </Field>
        <Field label="To">
          <Input type="date" value={range.to} onChange={(_, v) => v.value && setRange((r) => ({ ...r, to: v.value }))} />
        </Field>
        <PersonPicker
          label="Owner"
          value={owner?.id ?? null}
          valueLabel={owner?.name ?? ""}
          placeholder="Everyone in scope"
          clearLabel="Everyone in scope"
          unavailableHint=""
          onChange={(p) => setOwner(p ? { id: p.id, name: p.name } : null)}
        />
        <Button onClick={() => void q.refetch()} disabled={q.isFetching}>
          Refresh
        </Button>
      </Toolbar>
      {q.error && !d && (
        <MessageBar intent="error">
          <MessageBarBody>{errorMessage(q.error)}</MessageBarBody>
        </MessageBar>
      )}
      {!d && !q.error && (
        <Skeleton aria-label="Loading dashboard">
          <SkeletonItem size={128} />
        </Skeleton>
      )}
      {d && (
        <div className={styles.grid}>
          <Tile title="Closing this month" href={crmTileHref(d.closing_this_month.link)}>
            <span className={styles.big}>{d.closing_this_month.count}</span>
            <Totals totals={d.closing_this_month.totals} />
          </Tile>
          <Tile title="Win rate" href={crmTileHref(d.win_rate.link)}>
            <span className={styles.big}>{formatPercent(d.win_rate.win_rate_pct)}</span>
            <Text size={200} className={styles.muted}>
              {d.win_rate.won} won · {d.win_rate.lost} lost
            </Text>
          </Tile>
          <Tile title="Avg sales cycle" href={crmTileHref(d.win_rate.link)}>
            <span className={styles.big}>{d.win_rate.avg_sales_cycle_days ? `${Math.round(Number(d.win_rate.avg_sales_cycle_days))} d` : "—"}</span>
            <Text size={200} className={styles.muted}>
              Created to won
            </Text>
          </Tile>
          <Tile title="Overdue tasks" href={crmTileHref(d.overdue_tasks.link)}>
            <span className={styles.big}>{d.overdue_tasks.count}</span>
          </Tile>

          <Tile title="Open vs weighted pipeline by stage" href={crmTileHref(d.pipeline.link)} wide>
            {stageRows.length === 0 ? (
              <Text className={styles.muted}>No open opportunities.</Text>
            ) : (
              <div className={styles.chart}>
                <ResponsiveContainer width="100%" height={CHART_HEIGHT} initialDimension={{ width: 320, height: CHART_HEIGHT }}>
                  <BarChart data={stageRows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                    <CartesianGrid horizontal={false} stroke={tokens.colorNeutralStroke2} />
                    <XAxis type="number" tickFormatter={money(stageCurrencies[0] ?? "INR")} {...AXIS_PROPS} />
                    <YAxis type="category" dataKey="label" width={100} {...AXIS_PROPS} />
                    <Tooltip content={(props) => <ChartTooltip {...props} />} />
                    <Legend formatter={legendText} />
                    {stageSeries.map((s, i) => (
                      <Bar
                        key={s.key}
                        dataKey={s.key}
                        name={s.label}
                        fill={seriesColor(i)}
                        cursor="pointer"
                        onClick={(row: { payload?: { key?: string } }) => {
                          const href = bucketHref(d.pipeline.link, { stage: row.payload?.key ?? null });
                          if (href) router.push(href);
                        }}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Tile>
          <Tile title="Weighted pipeline by close month" href={crmTileHref(d.pipeline.link)} wide>
            {monthRows.length === 0 ? (
              <Text className={styles.muted}>No open opportunities.</Text>
            ) : (
              <div className={styles.chart}>
                <ResponsiveContainer width="100%" height={CHART_HEIGHT} initialDimension={{ width: 320, height: CHART_HEIGHT }}>
                  <BarChart data={monthRows} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                    <CartesianGrid vertical={false} stroke={tokens.colorNeutralStroke2} />
                    <XAxis dataKey="label" {...AXIS_PROPS} />
                    <YAxis tickFormatter={money(monthSeries[0]?.currency ?? "INR")} {...AXIS_PROPS} />
                    <Tooltip content={(props) => <ChartTooltip {...props} />} />
                    <Legend formatter={legendText} />
                    {monthSeries.map((s, i) => (
                      <Bar
                        key={s.key}
                        dataKey={s.key}
                        name={s.label}
                        fill={seriesColor(i)}
                        cursor="pointer"
                        onClick={(row: { payload?: { key?: string } }) => {
                          const r = monthRange(row.payload?.key ?? "");
                          const href = bucketHref(d.pipeline.link, r ? { close_from: r.from, close_to: r.to } : {});
                          if (href) router.push(href);
                        }}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Tile>
          <Tile title="Leads by source" href={crmTileHref(d.leads_by_source.link)} wide>
            {d.leads_by_source.rows.length === 0 ? (
              <Text className={styles.muted}>No leads in this period.</Text>
            ) : (
              <>
                <div className={styles.chart}>
                  <ResponsiveContainer width="100%" height={CHART_HEIGHT} initialDimension={{ width: 320, height: CHART_HEIGHT }}>
                    <BarChart data={d.leads_by_source.rows} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                      <CartesianGrid vertical={false} stroke={tokens.colorNeutralStroke2} />
                      <XAxis dataKey="source_code" {...AXIS_PROPS} />
                      <YAxis allowDecimals={false} {...AXIS_PROPS} />
                      <Tooltip content={(props) => <ChartTooltip {...props} />} />
                      <Legend formatter={legendText} />
                      <Bar dataKey="created" name="Created" fill={seriesColor(0)} />
                      <Bar dataKey="converted" name="Converted" fill={seriesColor(1)} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Table size="small" aria-label="Leads by source">
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>Source</TableHeaderCell>
                      <TableHeaderCell>Created</TableHeaderCell>
                      <TableHeaderCell>Converted</TableHeaderCell>
                      <TableHeaderCell>Conversion</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.leads_by_source.rows.map((r) => {
                      const href = bucketHref(d.leads_by_source.link, { source: r.source_code });
                      return (
                        <TableRow key={r.source_code}>
                          <TableCell>{href ? <AppLink href={href}>{r.source_code}</AppLink> : r.source_code}</TableCell>
                          <TableCell>{r.created}</TableCell>
                          <TableCell>{r.converted}</TableCell>
                          <TableCell>{formatPercent(r.conversion_rate_pct)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </Tile>
        </div>
      )}
    </>
  );
}
