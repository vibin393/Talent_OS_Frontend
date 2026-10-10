"use client";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  createTableColumn,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Subtitle2,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  tokens,
  Tooltip as FluentTooltip,
} from "@fluentui/react-components";
import { ArrowDownload20Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDate } from "@/features/commercials/format";
import { AXIS_PROPS, CHART_FONT, CHART_FONT_SIZE, CHART_HEIGHT, seriesColor, TOOLTIP_SURFACE } from "@/features/dashboards/chart-theme";
import { usePredictionBatch } from "@/features/predictions/use-predictions";
import { errorMessage } from "@/lib/api/errors";
import { workforceApi } from "./api";
import { actualsChartRows, displayMoney, formatMonth, latestPredictedFill, varianceTone } from "./logic";
import type { ActualRow, GroupBy, PlanOut } from "./types";
import { usePlanActuals } from "./use-workforce";

const useStyles = makeStyles({
  toolbar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  grow: { flex: 1 },
  charts: { display: "grid", gap: tokens.spacingHorizontalL, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", marginBottom: tokens.spacingVerticalL },
  card: { padding: tokens.spacingHorizontalL, minWidth: 0 },
  chart: { height: `${CHART_HEIGHT}px`, minWidth: 0 },
  num: { fontVariantNumeric: "tabular-nums" },
  danger: { color: tokens.colorPaletteRedForeground1, fontVariantNumeric: "tabular-nums" },
  success: { color: tokens.colorPaletteGreenForeground1, fontVariantNumeric: "tabular-nums" },
  muted: { color: tokens.colorNeutralForeground3 },
  bars: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalM },
});

type ChartRow = { label: string; a: number | null; b: number | null };

/** Grouped vertical bars (two series) with a legend; colours from the dashboards chart theme. */
function PairChart({ title, rows, names, money }: { title: string; rows: ChartRow[]; names: [string, string]; money?: string }) {
  const styles = useStyles();
  const fmt = (v: number) => (money ? displayMoney(String(v), money) : String(v));
  const summary = `${title}: ${rows.map((r) => `${r.label} ${names[0]} ${r.a ?? "—"}, ${names[1]} ${r.b ?? "—"}`).join("; ")}`;
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h3">{title}</Subtitle2>} />
      <div className={styles.chart} role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} initialDimension={{ width: 320, height: CHART_HEIGHT }}>
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 4 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={tokens.colorNeutralStroke2} />
            <XAxis dataKey="label" {...AXIS_PROPS} interval={0} />
            <YAxis allowDecimals={!!money} width={money ? 72 : 32} tickFormatter={(v: number) => (money ? new Intl.NumberFormat("en-IN", { notation: "compact" }).format(v) : String(v))} {...AXIS_PROPS} />
            <Tooltip
              cursor={{ fill: tokens.colorNeutralBackground1Hover }}
              contentStyle={{ ...TOOLTIP_SURFACE, border: "none" }}
              formatter={(v) => (typeof v === "number" ? fmt(v) : String(v ?? "—"))}
            />
            <Legend wrapperStyle={{ fontFamily: CHART_FONT, fontSize: CHART_FONT_SIZE }} />
            <Bar dataKey="a" name={names[0]} fill={seriesColor(0)} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="b" name={names[1]} fill={seriesColor(1)} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Plan vs actual by line / by month: counts, Decimal money (masked "—"), predicted fill date (Epic 48), export. */
export function ActualsTab({ plan }: { plan: PlanOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const [groupBy, setGroupBy] = useState<GroupBy>("line");
  const q = usePlanActuals(plan.id, groupBy);
  const exportFile = useMutation({ mutationFn: () => workforceApi.exportActuals(plan.id, groupBy), onError: (e) => toast.error(errorMessage(e)) });
  const demandIds = useMemo(() => (q.data?.rows ?? []).flatMap((r) => r.demand_ids), [q.data]);
  const predictions = usePredictionBatch("demand", demandIds);
  const currency = q.data?.currency ?? plan.currency;
  const masked = q.data?.money_masked ?? plan.money_masked;

  const predictedFor = (r: ActualRow): string => {
    if (r.demand_ids.length === 0) return "—";
    if (!predictions.enabled) return "Not enough data";
    if (predictions.isPending) return "…";
    const days = r.demand_ids
      .map((id) => predictions.map.get(id))
      .filter((p) => p && p.kind === "time_to_fill" && p.status === "ok")
      .map((p) => p?.predicted_days ?? null);
    const date = latestPredictedFill(days);
    return date ? formatDate(date) : "Not enough data";
  };

  const columns: TableColumnDefinition<ActualRow>[] = [
    createTableColumn({
      columnId: "key",
      renderHeaderCell: () => (groupBy === "line" ? "Line" : "Month"),
      renderCell: (r) => (groupBy === "month" ? formatMonth(r.month) : (r.role_title ?? r.key)),
    }),
    createTableColumn({ columnId: "planned", renderHeaderCell: () => "Planned", renderCell: (r) => <span className={styles.num}>{r.planned}</span> }),
    createTableColumn({ columnId: "req", renderHeaderCell: () => "Requisitioned", renderCell: (r) => <span className={styles.num}>{r.requisitioned}</span> }),
    createTableColumn({ columnId: "filled", renderHeaderCell: () => "Filled", renderCell: (r) => <span className={styles.num}>{r.filled}</span> }),
    createTableColumn({ columnId: "open", renderHeaderCell: () => "Open", renderCell: (r) => <span className={styles.num}>{r.open}</span> }),
    createTableColumn({
      columnId: "budget",
      renderHeaderCell: () => "Budget",
      renderCell: (r) => <span className={styles.num}>{displayMoney(r.budget, currency)}</span>,
    }),
    createTableColumn({
      columnId: "committed",
      renderHeaderCell: () => "Committed",
      renderCell: (r) => (
        <span className={styles.num}>
          {displayMoney(r.committed, currency)}
          {r.pending_commitment && (
            <FluentTooltip content="Some offers or placements are not yet costed" relationship="description">
              <Badge appearance="tint" color="warning" size="small" style={{ marginLeft: 6 }}>
                pending
              </Badge>
            </FluentTooltip>
          )}
          {r.fx_missing && (
            <FluentTooltip content="An exchange rate is missing; part of the cost is not converted" relationship="description">
              <Badge appearance="tint" color="danger" size="small" style={{ marginLeft: 6 }}>
                FX
              </Badge>
            </FluentTooltip>
          )}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "variance",
      renderHeaderCell: () => "Variance",
      renderCell: (r) => {
        const tone = varianceTone(r.variance);
        return <span className={tone === "danger" ? styles.danger : tone === "success" ? styles.success : styles.num}>{displayMoney(r.variance, currency)}</span>;
      },
    }),
    createTableColumn({
      columnId: "predicted",
      renderHeaderCell: () => "Predicted fill",
      renderCell: (r) => {
        const v = predictedFor(r);
        return <span className={v === "Not enough data" ? styles.muted : styles.num}>{v}</span>;
      },
    }),
  ];

  const chartRows = actualsChartRows(q.data?.rows ?? [], groupBy);
  const totals = q.data?.totals;

  return (
    <>
      <div className={styles.toolbar}>
        <TabList selectedValue={groupBy} onTabSelect={(_, d) => setGroupBy(d.value as GroupBy)} aria-label="Group plan vs actual">
          <Tab value="line">By line</Tab>
          <Tab value="month">By month</Tab>
        </TabList>
        <span className={styles.grow} />
        {q.data?.effective_revision !== undefined && q.data?.effective_revision !== null && (
          <Text size={200} className={styles.muted}>{`Approved revision ${q.data.effective_revision}`}</Text>
        )}
        <Button icon={<ArrowDownload20Regular />} disabled={exportFile.isPending || !q.data} onClick={() => exportFile.mutate()}>
          Export to Excel
        </Button>
      </div>
      <div className={styles.bars}>
        {masked && (
          <MessageBar intent="info">
            <MessageBarBody>Money figures are hidden because you do not have compensation access.</MessageBarBody>
          </MessageBar>
        )}
      </div>
      {q.data && q.data.rows.length > 0 && (
        <div className={styles.charts}>
          <PairChart title="Planned vs filled headcount" rows={chartRows.map((r) => ({ label: r.label, a: r.planned, b: r.filled }))} names={["Planned", "Filled"]} />
          {!masked && (
            <PairChart
              title="Budget vs committed"
              rows={chartRows.map((r) => ({ label: r.label, a: r.budget, b: r.committed }))}
              names={["Budget", "Committed"]}
              money={currency}
            />
          )}
        </div>
      )}
      <AdminGrid
        items={q.data ? [...q.data.rows, ...(totals && q.data.rows.length ? [{ ...totals, key: "__total__", role_title: "Total", month: null }] : [])] : undefined}
        columns={columns.map((c) =>
          c.columnId === "key"
            ? createTableColumn<ActualRow>({
                columnId: "key",
                renderHeaderCell: c.renderHeaderCell,
                renderCell: (r) => (r.key === "__total__" ? <Text weight="semibold">Total</Text> : c.renderCell(r)),
              })
            : c.columnId === "predicted"
              ? createTableColumn<ActualRow>({ columnId: "predicted", renderHeaderCell: c.renderHeaderCell, renderCell: (r) => (r.key === "__total__" ? "" : c.renderCell(r)) })
              : c,
        )}
        getRowId={(r) => r.key}
        loading={q.isPending}
        error={q.error}
        emptyText="Nothing to compare yet: the plan has no approved lines."
        label="Plan vs actual"
      />
    </>
  );
}
