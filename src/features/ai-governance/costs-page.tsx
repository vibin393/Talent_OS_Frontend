"use client";

import {
  Caption1,
  Card,
  CardHeader,
  createTableColumn,
  LargeTitle,
  makeStyles,
  ProgressBar,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  type TableColumnDefinition,
  Text,
  ToggleButton,
  tokens,
} from "@fluentui/react-components";
import { Table20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ChartTip, XAxis, YAxis } from "recharts";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { AXIS_PROPS, CHART_HEIGHT, GRID_COLOR, seriesColor, seriesDash } from "@/features/dashboards/chart-theme";
import { errorMessage } from "@/lib/api/errors";
import type { AgentBudgetRow, CostsOut } from "@/lib/api/governance-types";
import { governanceApi, governanceKeys } from "./api";
import { ConsoleShell } from "./console-shell";
import { budgetIntent, dailyCostSeries, formatMicrosUsd, formatTokens, formatUsd, humanize } from "./logic";

const useStyles = makeStyles({
  kpis: { display: "grid", gap: tokens.spacingHorizontalL, gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))" },
  chart: { height: `${CHART_HEIGHT}px`, minWidth: 0 },
  toolbar: { display: "flex", justifyContent: "flex-end" },
  wrap: { overflowX: "auto" },
  bar: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, minWidth: "120px" },
});

/** `/admin/ai/costs`: month KPIs, daily cost by agent and per-agent budgets. */
export function CostsPage() {
  return (
    <ConsoleShell>
      <CostsBody />
    </ConsoleShell>
  );
}

function CostsBody() {
  const styles = useStyles();
  const q = "group_by=agent";
  const costs = useQuery({ queryKey: governanceKeys.costs(q), queryFn: ({ signal }) => governanceApi.costs(q, signal) });
  if (costs.isPending) return <GridSkeleton rows={4} />;
  if (costs.isError) return <ErrorBar title="Could not load costs." message={errorMessage(costs.error)} />;
  const c = costs.data;
  return (
    <>
      <div className={styles.kpis}>
        <Kpi title="Tokens this month" value={formatTokens(c.month.tokens)} />
        <Kpi title="Cost this month (USD)" value={formatUsd(c.month.cost_usd)} />
        <Kpi title="Runs this month" value={formatTokens(c.month.runs)} />
      </div>
      <DailyCost costs={c} />
      <BudgetTable costs={c} />
    </>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader header={<Subtitle2 as="h2">{title}</Subtitle2>} />
      <LargeTitle as="p" style={{ margin: 0 }}>
        {value}
      </LargeTitle>
    </Card>
  );
}

function DailyCost({ costs }: { costs: CostsOut }) {
  const styles = useStyles();
  const [asTable, setAsTable] = useState(false);
  const { agents, rows } = dailyCostSeries(costs.series ?? []);
  const name = (k: string) => costs.agents.find((a) => a.agent_key === k)?.agent_name ?? humanize(k);
  return (
    <Card>
      <CardHeader
        header={<Subtitle2 as="h2">Daily cost by agent</Subtitle2>}
        action={
          <ToggleButton size="small" appearance="subtle" icon={<Table20Regular />} checked={asTable} onClick={() => setAsTable((v) => !v)}>
            View as table
          </ToggleButton>
        }
      />
      {rows.length === 0 ? (
        <Text>No agent costs yet this period.</Text>
      ) : asTable ? (
        <div className={styles.wrap}>
          <Table size="extra-small" aria-label="Daily cost by agent">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Day</TableHeaderCell>
                {agents.map((a) => (
                  <TableHeaderCell key={a}>{name(a)}</TableHeaderCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.day)}>
                  <TableCell>{String(r.day)}</TableCell>
                  {agents.map((a) => (
                    <TableCell key={a}>{String(r[`${a}__display`] ?? "—")}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className={styles.chart}>
          <ResponsiveContainer>
            <LineChart data={rows}>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="day" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `$${v}`} width={56} />
              <ChartTip formatter={(_v, n, item) => [String((item.payload as Record<string, unknown>)[`${String(item.dataKey)}__display`] ?? "—"), n]} />
              <Legend />
              {agents.map((a, i) => (
                <Line key={a} dataKey={a} name={name(a)} stroke={seriesColor(i)} strokeDasharray={seriesDash(i)} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function BudgetTable({ costs }: { costs: CostsOut }) {
  const styles = useStyles();
  const columns: TableColumnDefinition<AgentBudgetRow>[] = [
    createTableColumn({ columnId: "agent", renderHeaderCell: () => "Agent", renderCell: (a) => a.agent_name }),
    createTableColumn({
      columnId: "budget",
      renderHeaderCell: () => "Monthly budget (tokens)",
      renderCell: (a) => (a.monthly_token_budget === null ? "Tenant budget only" : formatTokens(a.monthly_token_budget)),
    }),
    createTableColumn({ columnId: "used", renderHeaderCell: () => "Used", renderCell: (a) => formatTokens(a.used_this_month) }),
    createTableColumn({
      columnId: "pct",
      renderHeaderCell: () => "% used",
      renderCell: (a) =>
        a.pct_used === null ? (
          "—"
        ) : (
          <div className={styles.bar}>
            <ProgressBar
              value={Math.min(1, a.pct_used / 100)}
              color={budgetIntent(a.pct_used) === "brand" ? "brand" : budgetIntent(a.pct_used)}
              aria-label={`${a.agent_name} budget used`}
            />
            <Caption1>{Math.round(a.pct_used)}%</Caption1>
          </div>
        ),
    }),
    createTableColumn({ columnId: "expected", renderHeaderCell: () => "Expected cost per run", renderCell: (a) => formatMicrosUsd(a.expected_cost_per_run_micros) }),
    createTableColumn({ columnId: "actual", renderHeaderCell: () => "Actual cost per run", renderCell: (a) => formatMicrosUsd(a.actual_cost_per_run_micros) }),
  ];
  return (
    <>
      <Subtitle2 as="h2">Budgets</Subtitle2>
      {costs.tenant_monthly_token_budget !== null && <Caption1>Tenant monthly budget: {formatTokens(costs.tenant_monthly_token_budget)} tokens</Caption1>}
      <AdminGrid items={costs.agents} columns={columns} getRowId={(a) => a.agent_key} loading={false} error={null} emptyText="No agents yet." label="Agent budgets" />
    </>
  );
}
