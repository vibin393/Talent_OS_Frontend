"use client";

import {
  Badge,
  Button,
  Caption1,
  Card,
  CardHeader,
  LargeTitle,
  makeStyles,
  MessageBar,
  MessageBarActions,
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
  ToggleButton,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { ArrowClockwise16Regular, Info16Regular, Table20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ChartTip, XAxis, YAxis } from "recharts";
import { AppLink } from "@/components/app-link";
import { AXIS_PROPS, CHART_HEIGHT, GRID_COLOR, seriesColor, seriesDash } from "../chart-theme";
import { rowHref, tileHref } from "../links";
import type { TileState } from "../tile-card";
import { formatCompactInr, formatMoney } from "./money";
import { breakdownData, formatP2Cell, p2Columns, seriesData, stackedData, tileBadges } from "./tile-model";
import type { P2TileDef, P2TileOut } from "./types";

const useStyles = makeStyles({
  card: { minWidth: 0, height: "100%", boxSizing: "border-box" },
  title: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" },
  muted: { color: tokens.colorNeutralForeground3 },
  kpi: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  multi: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXXL, rowGap: tokens.spacingVerticalM },
  item: { display: "flex", flexDirection: "column", minWidth: "96px" },
  num: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
  wrap: { overflowX: "auto" },
  chart: { height: `${CHART_HEIGHT}px`, minWidth: 0 },
  toolbar: { display: "flex", justifyContent: "flex-end" },
  highlight: { color: tokens.colorPaletteRedForeground1, fontWeight: tokens.fontWeightSemibold },
});

function DataTable({ rows, title, tile }: { rows: Record<string, unknown>[]; title: string; tile: P2TileOut }) {
  const styles = useStyles();
  const cols = p2Columns(rows);
  if (rows.length === 0) return <Text className={styles.muted}>Nothing to show yet.</Text>;
  return (
    <div className={styles.wrap}>
      <Table size="extra-small" aria-label={title}>
        <TableHeader>
          <TableRow>
            {cols.map((c) => (
              <TableHeaderCell key={c.key} className={c.kind === "text" || c.kind === "date" ? undefined : styles.num}>
                {c.label}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 20).map((r, i) => (
            <TableRow key={i}>
              {cols.map((c, ci) => {
                const text = formatP2Cell(r[c.key], c.kind);
                const href = ci === 0 ? rowHref(tile.row_links as never, i, null) : null;
                return (
                  <TableCell key={c.key} className={c.kind === "text" || c.kind === "date" ? undefined : styles.num}>
                    {href ? <AppLink href={href}>{text}</AppLink> : text}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Kpi({ tile }: { tile: P2TileOut }) {
  const styles = useStyles();
  const rows = tile.rows ?? [];
  const links = tile.row_links ?? [];
  if (!tile.money && (tile.value === null || tile.value === undefined) && rows.length > 1 && links.length === rows.length) {
    return (
      <div className={styles.multi}>
        {rows.map((r, i) => {
          const href = rowHref(links, i, tile.link);
          const text = typeof r.value === "number" ? r.value.toLocaleString("en-IN") : "—";
          return (
            <div key={String(r.key ?? i)} className={styles.item}>
              <Caption1 className={styles.muted}>{String(r.label ?? r.key)}</Caption1>
              {href ? <AppLink href={href}><LargeTitle as="span">{text}</LargeTitle></AppLink> : <LargeTitle as="span">{text}</LargeTitle>}
            </div>
          );
        })}
      </div>
    );
  }
  const headline = tile.money ? formatMoney(tile.money) : typeof tile.value === "number" ? tile.value.toLocaleString("en-IN") : "—";
  const href = tileHref(tile.link);
  return (
    <div className={styles.kpi}>
      {href ? <AppLink href={href}><LargeTitle as="span">{headline}</LargeTitle></AppLink> : <LargeTitle as="span">{headline}</LargeTitle>}
      {tile.money && typeof tile.value === "number" && (
        <Caption1 className={styles.muted}>
          {tile.value.toLocaleString("en-IN")} {tile.unit ?? "documents"}
        </Caption1>
      )}
      {rows
        .filter((r) => typeof r.label === "string")
        .map((r, i) => (
          <Text key={String(r.key ?? i)} size={200} className={r.highlight ? styles.highlight : styles.muted}>
            {String(r.label)}: {r.value === null || r.value === undefined ? "—" : String(r.value)}
          </Text>
        ))}
    </div>
  );
}

function Chart({ tile }: { tile: P2TileOut }) {
  const styles = useStyles();
  const [asTable, setAsTable] = useState(false);
  const toggle = (
    <div className={styles.toolbar}>
      <ToggleButton size="small" appearance="subtle" icon={<Table20Regular />} checked={asTable} onClick={() => setAsTable((v) => !v)}>
        View as table
      </ToggleButton>
    </div>
  );
  if (tile.kind === "series") {
    const { keys, rows } = seriesData(tile);
    if (asTable) {
      const tableRows = rows.map((r) => Object.fromEntries([["month", r.bucket], ...keys.map((k) => [k.label, r[`${k.key}__display`]])]));
      return <>{toggle}<DataTable rows={tableRows} title={tile.title} tile={{ ...tile, row_links: null }} /></>;
    }
    return (
      <>
        {toggle}
        <div className={styles.chart}>
          <ResponsiveContainer>
            <LineChart data={rows}>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="bucket" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => (tile.unit === "INR" ? formatCompactInr(v) : String(v))} width={64} />
              <ChartTip formatter={(_v, name, item) => [String((item.payload as Record<string, unknown>)[`${String(item.dataKey)}__display`] ?? "—"), name]} />
              <Legend />
              {keys.map((k, i) => (
                <Line key={k.key} dataKey={k.key} name={k.label} stroke={seriesColor(i)} strokeDasharray={seriesDash(i)} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </>
    );
  }
  const stacked = stackedData(tile);
  if (stacked) {
    if (asTable) return <>{toggle}<DataTable rows={stacked.rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "key")))} title={tile.title} tile={tile} /></>;
    return (
      <>
        {toggle}
        <div className={styles.chart}>
          <ResponsiveContainer>
            <BarChart data={stacked.rows}>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} allowDecimals={false} />
              <ChartTip />
              <Legend />
              {stacked.keys.map((k, i) => (
                <Bar key={k.key} dataKey={k.key} name={k.label} stackId="s" fill={seriesColor(i)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </>
    );
  }
  const bars = breakdownData(tile);
  if (asTable) return <>{toggle}<DataTable rows={bars.map((b) => ({ category: b.label, value: b.display }))} title={tile.title} tile={tile} /></>;
  return (
    <>
      {toggle}
      <div className={styles.chart}>
        <ResponsiveContainer>
          <BarChart data={bars}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            {/* Aging buckets / categories always carry text labels: colour is never the only signal. */}
            <XAxis dataKey="label" {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => (tile.unit === "INR" ? formatCompactInr(v) : String(v))} width={64} />
            <ChartTip formatter={(_v, _n, item) => [String((item.payload as { display: string }).display), tile.title]} />
            <Bar dataKey="value" name={tile.title} fill={seriesColor(0)} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function Body({ state, onRetry }: { state: TileState; onRetry?: () => void }) {
  if (state.status === "loading") {
    return (
      <Skeleton aria-label="Loading">
        <SkeletonItem size={40} style={{ width: "40%" }} />
        <SkeletonItem size={16} />
      </Skeleton>
    );
  }
  if (state.status === "error") {
    return (
      <MessageBar intent="error" layout="multiline">
        <MessageBarBody>{state.message ?? "Couldn't load this tile."}</MessageBarBody>
        {onRetry && (
          <MessageBarActions>
            <Button size="small" icon={<ArrowClockwise16Regular />} onClick={onRetry}>
              Retry
            </Button>
          </MessageBarActions>
        )}
      </MessageBar>
    );
  }
  const tile = state.tile as unknown as P2TileOut;
  if (tile.status === "timeout") {
    return (
      <MessageBar intent="warning" layout="multiline">
        <MessageBarBody>Taking too long. Narrow the date range and try again.</MessageBarBody>
      </MessageBar>
    );
  }
  if (tile.kind === "kpi") return <Kpi tile={tile} />;
  if (tile.kind === "table") return <DataTable rows={tile.rows ?? []} title={tile.title} tile={tile} />;
  return <Chart tile={tile} />;
}

/** Phase 2 tile card: P1 card layout plus "Estimate" / "Reconciling" badges and AD-12 money rendering. */
export type ExtraTileBadge = { key: string; label: string; tooltip: string; color: "informative" | "warning" | "brand" | "subtle" };

export function P2TileCard({
  def,
  state,
  onRetry,
  span = 1,
  extraBadges = [],
}: {
  def: P2TileDef;
  state: TileState;
  onRetry?: () => void;
  span?: number;
  /** Additional header badges (Phase 3: "Supporting signal", "Amounts hidden"). */
  extraBadges?: readonly ExtraTileBadge[];
}) {
  const styles = useStyles();
  if (def.available === false) return null;
  if (state.status === "ok" && state.tile.status === "unavailable") return null;
  const tile = state.status === "ok" ? (state.tile as unknown as P2TileOut) : null;
  const href = tile && tile.status === "ok" ? tileHref(tile.link) : null;
  const badges = tile ? tileBadges(tile) : def.estimate ? tileBadges({ estimate: true }) : [];
  const headingId = `p2-tile-${def.key}`;
  return (
    <Card className={styles.card} style={{ gridColumn: `span ${span}` }} role="region" aria-labelledby={headingId}>
      <CardHeader
        header={
          <div className={styles.title}>
            <Subtitle2 as="h2" id={headingId}>
              {def.title}
            </Subtitle2>
            <Tooltip content={def.description} relationship="description" withArrow>
              <Button appearance="transparent" size="small" icon={<Info16Regular />} aria-label={`About ${def.title}`} />
            </Tooltip>
            {badges.map((b) => (
              <Tooltip key={b.key} content={b.tooltip} relationship="description" withArrow>
                <Badge appearance="tint" color={b.key === "estimate" ? "warning" : "informative"} data-testid={`badge-${b.key}`}>
                  {b.label}
                </Badge>
              </Tooltip>
            ))}
            {extraBadges.map((b) => (
              <Tooltip key={b.key} content={b.tooltip} relationship="description" withArrow>
                <Badge appearance="tint" color={b.color} data-testid={`badge-${b.key}`}>
                  {b.label}
                </Badge>
              </Tooltip>
            ))}
          </div>
        }
        action={href ? <AppLink href={href}>View list</AppLink> : undefined}
      />
      <div aria-busy={state.status === "loading"}>
        <Body state={state} onRetry={onRetry} />
      </div>
    </Card>
  );
}
