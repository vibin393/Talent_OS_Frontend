"use client";

import {
  Caption1,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  makeStyles,
  TableCellLayout,
  type TableColumnDefinition,
  Text,
  ToggleButton,
  tokens,
} from "@fluentui/react-components";
import { Table20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLink } from "@/components/app-link";
import type { TileOut } from "@/lib/api/types";
import { AXIS_PROPS, CHART_FONT, CHART_FONT_SIZE, CHART_HEIGHT, seriesColor, seriesDash, TOOLTIP_SURFACE } from "./chart-theme";
import { tileHref } from "./links";
import {
  type BarDatum,
  barData,
  barLabel,
  bucketLabel,
  chartSummary,
  formatNumber,
  parseSeries,
  type Series,
  seriesBucketLink,
  seriesRows,
} from "./tile-format";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, minWidth: 0 },
  bar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
  chart: { height: `${CHART_HEIGHT}px`, minWidth: 0 },
  tableWrap: { maxHeight: `${CHART_HEIGHT}px`, overflow: "auto" },
  num: { justifyContent: "flex-end" },
  tooltipRow: { display: "flex", alignItems: "center", gap: "6px" },
  swatch: { width: "10px", height: "10px", borderRadius: "2px", flexShrink: 0 },
});

type TooltipEntry = { name?: string | number; value?: unknown; color?: string; dataKey?: unknown; payload?: Record<string, unknown> };

/** recharts tooltip rendered as a Fluent surface. */
export function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: unknown;
  formatLabel?: (label: string) => string;
}) {
  const styles = useStyles();
  if (!active || !payload?.length) return null;
  const title = label === undefined || label === null ? "" : formatLabel ? formatLabel(String(label)) : String(label);
  return (
    <div style={{ ...TOOLTIP_SURFACE, padding: "8px 12px" }}>
      {title && (
        <Text weight="semibold" size={200} block>
          {title}
        </Text>
      )}
      {payload.map((p, i) => {
        const display = typeof p.payload?.display === "string" ? p.payload.display : formatNumber(typeof p.value === "number" ? p.value : null);
        return (
          <div key={String(p.dataKey ?? i)} className={styles.tooltipRow}>
            <span className={styles.swatch} style={{ backgroundColor: p.color }} aria-hidden />
            <Text size={200}>
              {p.name}: {display}
            </Text>
          </div>
        );
      })}
    </div>
  );
}

function legendText(value: unknown) {
  return <span style={{ color: tokens.colorNeutralForeground2, fontFamily: CHART_FONT, fontSize: CHART_FONT_SIZE }}>{String(value)}</span>;
}

// ================================================================ table views
type BarRow = BarDatum & { index: number };

function BarTable({ tile, bars }: { tile: TileOut; bars: BarDatum[] }) {
  const styles = useStyles();
  const rows: BarRow[] = bars.map((b, index) => ({ ...b, index }));
  const columns: TableColumnDefinition<BarRow>[] = [
    createTableColumn<BarRow>({
      columnId: "label",
      renderHeaderCell: () => (tile.kind === "funnel" ? "Stage" : "Category"),
      renderCell: (r) => {
        const href = tileHref(r.href) ?? tileHref(tile.link);
        return <TableCellLayout truncate>{href ? <AppLink href={href}>{r.label}</AppLink> : r.label}</TableCellLayout>;
      },
    }),
    createTableColumn<BarRow>({
      columnId: "value",
      renderHeaderCell: () => "Count",
      renderCell: (r) => <TableCellLayout className={styles.num}>{formatNumber(r.value)}</TableCellLayout>,
    }),
  ];
  if (tile.kind === "funnel") {
    columns.push(
      createTableColumn<BarRow>({
        columnId: "pct",
        renderHeaderCell: () => "% of previous",
        renderCell: (r) => <TableCellLayout className={styles.num}>{r.pct === null ? "—" : `${formatNumber(r.pct)}%`}</TableCellLayout>,
      }),
    );
  }
  return <MiniGrid label={`${tile.title} table`} rows={rows} columns={columns} getRowId={(r) => r.key} />;
}

type SeriesRow = Record<string, string | number>;

function SeriesTable({ tile, series, rows }: { tile: TileOut; series: Series[]; rows: SeriesRow[] }) {
  const styles = useStyles();
  const columns: TableColumnDefinition<SeriesRow>[] = [
    createTableColumn<SeriesRow>({
      columnId: "bucket",
      renderHeaderCell: () => "Period",
      renderCell: (r) => <TableCellLayout>{bucketLabel(String(r.bucket), tile.granularity)}</TableCellLayout>,
    }),
    ...series.map((s) =>
      createTableColumn<SeriesRow>({
        columnId: s.key,
        renderHeaderCell: () => s.label,
        renderCell: (r) => {
          const href = tileHref(seriesBucketLink(s, r));
          const text = formatNumber(typeof r[s.key] === "number" ? (r[s.key] as number) : null);
          return <TableCellLayout className={styles.num}>{href ? <AppLink href={href}>{text}</AppLink> : text}</TableCellLayout>;
        },
      }),
    ),
  ];
  return <MiniGrid label={`${tile.title} table`} rows={rows} columns={columns} getRowId={(r) => String(r.bucket)} />;
}

function MiniGrid<T>({
  label,
  rows,
  columns,
  getRowId,
}: {
  label: string;
  rows: T[];
  columns: TableColumnDefinition<T>[];
  getRowId: (row: T) => string;
}) {
  const styles = useStyles();
  return (
    <div className={styles.tableWrap}>
      <DataGrid items={rows} columns={columns} getRowId={getRowId} size="extra-small" aria-label={label} focusMode="composite">
        <DataGridHeader>
          <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
        </DataGridHeader>
        <DataGridBody<T>>
          {({ item, rowId }) => <DataGridRow<T> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>}
        </DataGridBody>
      </DataGrid>
    </div>
  );
}

// ================================================================ charts
function BarsChart({ tile, bars, onNavigate }: { tile: TileOut; bars: BarDatum[]; onNavigate: (href: string) => void }) {
  const data = bars.map((b) => ({ ...b, display: barLabel(b) }));
  const labelWidth = Math.min(140, Math.max(60, ...bars.map((b) => b.label.length * 7)));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT} initialDimension={{ width: 320, height: CHART_HEIGHT }}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 72, bottom: 4, left: 4 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={tokens.colorNeutralStroke2} />
        <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
        <YAxis type="category" dataKey="label" width={labelWidth} {...AXIS_PROPS} />
        <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ fill: tokens.colorNeutralBackground1Hover }} />
        <Bar
          dataKey="value"
          name={tile.kind === "funnel" ? "Applications" : "Count"}
          fill={seriesColor(0)}
          radius={[0, 4, 4, 0]}
          maxBarSize={24}
          cursor="pointer"
          isAnimationActive={false}
          onClick={(_, index) => {
            const href = tileHref(bars[index]?.href ?? null);
            if (href) onNavigate(href);
          }}
        >
          <LabelList dataKey="display" position="right" fill={tokens.colorNeutralForeground2} fontFamily={CHART_FONT} fontSize={CHART_FONT_SIZE} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SeriesChart({
  tile,
  series,
  rows,
  onNavigate,
}: {
  tile: TileOut;
  series: Series[];
  rows: SeriesRow[];
  onNavigate: (href: string) => void;
}) {
  const fmt = (v: string) => bucketLabel(v, tile.granularity);
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT} initialDimension={{ width: 320, height: CHART_HEIGHT }}>
      <LineChart
        data={rows}
        margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
        style={{ cursor: "pointer" }}
        onClick={(state) => {
          const index = Number(state?.activeTooltipIndex ?? state?.activeIndex);
          const row = Number.isInteger(index) ? rows[index] : undefined;
          const href = row && series[0] ? tileHref(seriesBucketLink(series[0], row)) : null;
          if (href) onNavigate(href);
        }}
      >
        <CartesianGrid vertical={false} stroke={tokens.colorNeutralStroke2} />
        <XAxis dataKey="bucket" tickFormatter={fmt} minTickGap={16} {...AXIS_PROPS} />
        <YAxis allowDecimals={false} width={36} {...AXIS_PROPS} />
        <Tooltip
          content={(props) => <ChartTooltip {...props} formatLabel={fmt} />}
          cursor={{ stroke: tokens.colorNeutralStroke1, strokeWidth: 1 }}
        />
        <Legend verticalAlign="bottom" height={28} iconType="plainline" itemSorter={null} formatter={legendText} wrapperStyle={{ fontSize: CHART_FONT_SIZE }} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={seriesColor(i)}
            strokeDasharray={seriesDash(i)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: tokens.colorNeutralBackground1 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Chart tiles: horizontal bars for breakdowns / funnels, lines for the throughput series. A "View as
 * table" toggle swaps the chart for a grid of the same data whose cells are drill-down links.
 */
export function ChartTile({ tile, initialView = "chart" }: { tile: TileOut; initialView?: "chart" | "table" }) {
  const styles = useStyles();
  const router = useRouter();
  const [view, setView] = useState<"chart" | "table">(initialView);
  const isSeries = tile.kind === "series";
  const series = isSeries ? parseSeries(tile) : [];
  const rows = isSeries ? seriesRows(series) : [];
  const bars = isSeries ? [] : barData(tile);
  const empty = isSeries ? rows.length === 0 : bars.length === 0;
  const summary = chartSummary(tile);
  const primary = series[0]?.label.toLowerCase();

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <Caption1 className={styles.muted}>
          {isSeries
            ? primary
              ? `Click a point to list ${primary} in that period.`
              : ""
            : "Click a bar to open its list."}
        </Caption1>
        <ToggleButton
          size="small"
          appearance="subtle"
          icon={<Table20Regular />}
          checked={view === "table"}
          aria-pressed={view === "table"}
          onClick={() => setView(view === "table" ? "chart" : "table")}
        >
          View as table
        </ToggleButton>
      </div>
      {empty ? (
        <Text className={styles.muted}>Nothing to show yet.</Text>
      ) : view === "table" ? (
        isSeries ? (
          <SeriesTable tile={tile} series={series} rows={rows} />
        ) : (
          <BarTable tile={tile} bars={bars} />
        )
      ) : (
        <div className={styles.chart} role="img" aria-label={summary}>
          {isSeries ? (
            <SeriesChart tile={tile} series={series} rows={rows} onNavigate={(h) => router.push(h)} />
          ) : (
            <BarsChart tile={tile} bars={bars} onNavigate={(h) => router.push(h)} />
          )}
        </div>
      )}
    </div>
  );
}

