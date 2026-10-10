"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Body1,
  Card,
  Dropdown,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  Option,
  Skeleton,
  SkeletonItem,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  ToggleButton,
  tokens,
} from "@fluentui/react-components";
import { Table20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar } from "@/features/admin/ui";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { AXIS_PROPS, CHART_HEIGHT, GRID_COLOR, seriesColor, seriesDash } from "../chart-theme";
import { cellHref, cellText, hasLiveCells, marginColor, monthLabel } from "./executive-model";
import { useLegalEntityOptions } from "./legal-entity-filter";
import { formatCompactInr, formatMoney, toChartNumber } from "./money";
import type { ExecGridOut, ExecRow } from "./types";

const useStyles = makeStyles({
  toolbar: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "end", marginBottom: tokens.spacingVerticalM },
  tableWrap: { overflow: "auto", maxHeight: "70vh", marginBottom: tokens.spacingVerticalL },
  stickyHead: { position: "sticky", top: 0, zIndex: 1, backgroundColor: tokens.colorNeutralBackground1 },
  stickyCol: { position: "sticky", left: 0, backgroundColor: tokens.colorNeutralBackground1, minWidth: "180px" },
  num: { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  charts: { display: "grid", gap: tokens.spacingHorizontalL, gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))" },
  chart: { height: `${CHART_HEIGHT}px` },
  muted: { color: tokens.colorNeutralForeground3 },
  section: { marginTop: tokens.spacingVerticalL },
});

export function useExecutiveGrid(le: string | null, monthFrom: string, monthTo: string) {
  const q = new URLSearchParams({ month_from: `${monthFrom}-01`, month_to: `${monthTo}-01` });
  if (le) q.set("legal_entity_id", le);
  return useQuery({
    queryKey: ["reporting", "executive-grid", le, monthFrom, monthTo],
    queryFn: ({ signal }) => api.get<ExecGridOut>(`/api/v1/dashboards/executive/grid?${q.toString()}`, { signal }),
    staleTime: 60_000,
  });
}

function defaultMonths(): { from: string; to: string } {
  const now = new Date();
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return { from: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`, to };
}

function TrendChart({ grid, keys, title }: { grid: ExecGridOut; keys: string[]; title: string }) {
  const styles = useStyles();
  const [asTable, setAsTable] = useState(false);
  const rows = grid.rows.filter((r) => keys.includes(r.key) && !r.masked);
  const data = grid.months.map((m, i) => {
    const point: Record<string, string | number | null> = { month: monthLabel(m) };
    for (const r of rows) {
      point[r.key] = toChartNumber(r.cells[i]?.value as never);
      point[`${r.key}__d`] = cellText(r, r.cells[i] ?? { value: null });
    }
    return point;
  });
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Subtitle2 as="h2">{title}</Subtitle2>
        <ToggleButton size="small" appearance="subtle" icon={<Table20Regular />} checked={asTable} onClick={() => setAsTable((v) => !v)}>
          View as table
        </ToggleButton>
      </div>
      {asTable ? (
        <Table size="extra-small" aria-label={title}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Month</TableHeaderCell>
              {rows.map((r) => (
                <TableHeaderCell key={r.key} className={styles.num}>
                  {r.label}
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={String(d.month)}>
                <TableCell>{d.month}</TableCell>
                {rows.map((r) => (
                  <TableCell key={r.key} className={styles.num}>
                    {d[`${r.key}__d`]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className={styles.chart}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="month" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => formatCompactInr(v)} width={64} />
              <Tooltip formatter={(v, name) => [formatMoney({ amount: String(v), currency: "INR" }), name]} />
              <Legend />
              {rows.map((r, i) => (
                <Line key={r.key} dataKey={r.key} name={r.label} stroke={seriesColor(i)} strokeDasharray={seriesDash(i)} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function GridTable({ grid }: { grid: ExecGridOut }) {
  const styles = useStyles();
  const renderCell = (row: ExecRow, i: number) => {
    const cell = row.cells[i];
    const text = cellText(row, cell ?? { value: null });
    const href = row.masked ? null : cellHref(row.key, grid.months[i], grid.legal_entity_id);
    const content =
      row.key === "margin_pct" && text !== "—" ? (
        <Badge appearance="tint" color={marginColor(cell?.value)}>
          {text}
        </Badge>
      ) : (
        text
      );
    return (
      <TableCell key={grid.months[i]} className={styles.num}>
        {href && text !== "—" ? <AppLink href={href}>{content}</AppLink> : content}
        {cell?.source === "live" && <span className={styles.muted}> *</span>}
      </TableCell>
    );
  };
  return (
    <div className={styles.tableWrap}>
      <Table size="small" aria-label="Executive summary by month">
        <TableHeader className={styles.stickyHead}>
          <TableRow>
            <TableHeaderCell className={styles.stickyCol}>Metric</TableHeaderCell>
            {grid.months.map((m) => (
              <TableHeaderCell key={m} className={styles.num}>
                {monthLabel(m)}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {grid.rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className={styles.stickyCol}>{row.label}</TableCell>
              {grid.months.map((_m, i) => renderCell(row, i))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** `/reports/executive`: months x metrics per Legal Entity, trends and definitions. */
export function ExecutiveView() {
  const styles = useStyles();
  const defaults = defaultMonths();
  const [monthFrom, setMonthFrom] = useState(defaults.from);
  const [monthTo, setMonthTo] = useState(defaults.to);
  const entities = useLegalEntityOptions();
  const [le, setLe] = useState<string | null>(null);
  const effectiveLe = le ?? entities.data?.[0]?.id ?? null;
  const grid = useExecutiveGrid(effectiveLe, monthFrom, monthTo);
  const leName = entities.data?.find((e) => e.id === effectiveLe)?.name ?? "";

  return (
    <>
      <PageHeader title="Executive summary" subtitle="Revenue, margin, workforce and receivables by month, from issued documents" />
      <div className={styles.toolbar}>
        {(entities.data?.length ?? 0) > 0 && (
          <Field label="Legal entity">
            <Dropdown
              value={leName}
              selectedOptions={effectiveLe ? [effectiveLe] : []}
              onOptionSelect={(_, d) => setLe(d.optionValue ?? null)}
              aria-label="Legal entity"
            >
              {(entities.data ?? []).map((e) => (
                <Option key={e.id} value={e.id}>
                  {e.name}
                </Option>
              ))}
            </Dropdown>
          </Field>
        )}
        <Field label="From month">
          <Input type="month" value={monthFrom} onChange={(_, d) => d.value && setMonthFrom(d.value)} />
        </Field>
        <Field label="To month">
          <Input type="month" value={monthTo} onChange={(_, d) => d.value && setMonthTo(d.value)} />
        </Field>
        {grid.data && hasLiveCells(grid.data.rows) && (
          <Badge appearance="tint" color="informative" data-testid="badge-reconciling">
            Reconciling (*)
          </Badge>
        )}
      </div>
      {grid.error ? (
        <ErrorBar title="Could not load the executive summary." message={errorMessage(grid.error)} />
      ) : !grid.data ? (
        <Skeleton aria-label="Loading">
          <SkeletonItem size={40} />
          <SkeletonItem size={40} />
        </Skeleton>
      ) : (
        <>
          <GridTable grid={grid.data} />
          <div className={styles.charts}>
            <TrendChart grid={grid.data} keys={["revenue", "margin"]} title="Revenue vs margin" />
            <TrendChart grid={grid.data} keys={["overdue_ar"]} title="Overdue AR" />
          </div>
        </>
      )}
      <Accordion collapsible className={mergeClasses(styles.section)}>
        <AccordionItem value="definitions">
          <AccordionHeader>Definitions</AccordionHeader>
          <AccordionPanel>
            <Body1 block>
              <strong>Revenue</strong>: taxable value (ex-GST, INR) of issued invoices and debit notes dated in the month, less credit
              notes by their own date. IRN-cancelled and imported opening-balance invoices are excluded.
            </Body1>
            <Body1 block>
              <strong>Gross margin</strong>: revenue less the cost frozen on each invoice line at issue. Margin % = margin ÷ revenue
              (shown as — when revenue is zero).
            </Body1>
            <Body1 block>
              <strong>DSO</strong>: from Receivables (open AR ÷ net sales incl. tax × days in the period).
            </Body1>
            <Body1 block>
              <strong>Fill rate</strong> (assumption, pending product confirmation): filled ÷ total positions of demands that reached
              filled, closed or cancelled in the month.
            </Body1>
            <Body1 block>
              <strong>Workers on billing</strong>: distinct workers with at least one issued invoice line in the month.
            </Body1>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </>
  );
}
