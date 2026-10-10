"use client";

import {
  Caption1,
  Divider,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Title1,
  tokens,
} from "@fluentui/react-components";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CHART_HEIGHT, GRID_COLOR, seriesColor, seriesDash, TOOLTIP_SURFACE } from "@/features/dashboards/chart-theme";
import { chartData, formatCell, limitMessage, maskedNote, pivot } from "./logic";
import type { Bucket, FieldCatalog, RunResult, VizSpec } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, minWidth: 0 },
  chart: { height: `${CHART_HEIGHT}px`, minWidth: 0 },
  tall: { height: `${CHART_HEIGHT + 80}px` },
  tableWrap: { maxHeight: "420px", overflow: "auto", border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium },
  num: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
  kpi: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: tokens.spacingVerticalXS, padding: tokens.spacingVerticalM },
  muted: { color: tokens.colorNeutralForeground3 },
  hidden: { color: tokens.colorNeutralForeground3, fontStyle: "italic" },
});

const NUMERIC = new Set(["int", "decimal"]);

export function ResultTable({ result, compact }: { result: RunResult; compact?: boolean }) {
  const styles = useStyles();
  return (
    <div className={styles.tableWrap}>
      <Table size={compact ? "extra-small" : "small"} aria-label="Report result">
        <TableHeader>
          <TableRow>
            {result.columns.map((c) => (
              <TableHeaderCell key={c.key} className={mergeClasses(NUMERIC.has(c.type) && styles.num)}>
                {c.label}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.rows.map((row, i) => (
            <TableRow key={i}>
              {result.columns.map((c) => (
                <TableCell key={c.key} className={mergeClasses(NUMERIC.has(c.type) && styles.num, c.masked && styles.hidden)}>
                  {formatCell(row[c.key] ?? null, c)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PivotTable({ result, viz }: { result: RunResult; viz: VizSpec }) {
  const styles = useStyles();
  const p = pivot(result, viz);
  const valueCol = result.columns.find((c) => c.key === viz.value) ?? { type: "decimal", masked: false };
  return (
    <div className={styles.tableWrap}>
      <Table size="small" aria-label="Pivot">
        <TableHeader>
          <TableRow>
            <TableHeaderCell />
            {p.cols.map((c) => (
              <TableHeaderCell key={c} className={styles.num}>
                {c}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {p.rows.map((r) => (
            <TableRow key={r}>
              <TableCell>{r}</TableCell>
              {p.cols.map((c) => (
                <TableCell key={c} className={styles.num}>
                  {formatCell(p.cell(r, c), valueCol)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Renders a run result in its visualisation, with the masked-field note and the limit `MessageBar`. */
export function ReportChart({
  result,
  viz,
  fields,
  bucket,
  compact,
}: {
  result: RunResult;
  viz: VizSpec;
  fields: Map<string, FieldCatalog>;
  bucket?: Bucket | null;
  compact?: boolean;
}) {
  const styles = useStyles();
  const note = maskedNote(result.masked_fields, fields);
  const limit = limitMessage(result);
  const { points, series } = viz.type === "bar" || viz.type === "line" || viz.type === "pie" ? chartData(result, viz, bucket) : { points: [], series: [] };
  const valueLabel = result.columns.find((c) => c.key === viz.value)?.label ?? viz.value ?? "";
  let body: React.ReactNode;
  if (result.rows.length === 0) {
    body = <Text className={styles.muted}>No rows match this report for you.</Text>;
  } else if (viz.type === "kpi") {
    const col = result.columns.find((c) => c.key === viz.value) ?? result.columns[result.columns.length - 1];
    body = (
      <div className={styles.kpi}>
        <Title1>{formatCell(result.rows[0]?.[col.key] ?? null, col)}</Title1>
        <Caption1 className={styles.muted}>{col.label}</Caption1>
      </div>
    );
  } else if (viz.type === "pivot") {
    body = <PivotTable result={result} viz={viz} />;
  } else if (viz.type === "bar" || viz.type === "line") {
    const Chart = viz.type === "bar" ? BarChart : LineChart;
    body = (
      <div className={mergeClasses(styles.chart, !compact && styles.tall)} role="img" aria-label={`${valueLabel} chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="x" tick={AXIS_TICK} />
            <YAxis tick={AXIS_TICK} />
            <Tooltip contentStyle={TOOLTIP_SURFACE} />
            {series.length > 1 && <Legend />}
            {series.map((s, i) =>
              viz.type === "bar" ? (
                <Bar key={s} dataKey={s} name={s} fill={seriesColor(i)} />
              ) : (
                <Line key={s} dataKey={s} name={s} stroke={seriesColor(i)} strokeDasharray={seriesDash(i)} dot={false} />
              ),
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
    );
  } else if (viz.type === "pie") {
    const key = series[0] ?? "";
    body = (
      <div className={styles.chart} role="img" aria-label={`${valueLabel} by ${viz.x ?? ""}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip contentStyle={TOOLTIP_SURFACE} />
            <Legend />
            <Pie data={points} dataKey={key} nameKey="x" outerRadius="80%">
              {points.map((p, i) => (
                <Cell key={p.x} fill={seriesColor(i)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  } else {
    body = <ResultTable result={result} compact={compact} />;
  }
  return (
    <div className={styles.root}>
      {limit && (
        <MessageBar intent={limit.intent}>
          <MessageBarBody>{limit.text}</MessageBarBody>
        </MessageBar>
      )}
      {note && (
        <MessageBar intent="info">
          <MessageBarBody>{note}</MessageBarBody>
        </MessageBar>
      )}
      {body}
      {!compact && viz.type !== "table" && result.rows.length > 0 && (
        <>
          <Divider />
          <Caption1 className={styles.muted}>
            {`${result.total ?? result.rows.length} result rows`}
          </Caption1>
        </>
      )}
    </div>
  );
}
