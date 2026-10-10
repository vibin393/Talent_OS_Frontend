"use client";

import {
  Body1,
  Caption1,
  Card,
  CardHeader,
  createTableColumn,
  LargeTitle,
  makeStyles,
  Subtitle2,
  Tab,
  TabList,
  type TableColumnDefinition,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { AXIS_PROPS, CHART_HEIGHT, seriesColor } from "@/features/dashboards/chart-theme";
import { errorMessage } from "@/lib/api/errors";
import { formatDate, formatDecimal, pctText } from "./format";
import type { BenchSummaryOut, RollOffRow } from "./types";
import { useBenchSummary, useRollOffs } from "./use-bench-summary";

const useStyles = makeStyles({
  tiles: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalL,
  },
  muted: { color: tokens.colorNeutralForeground3 },
  section: { marginBottom: tokens.spacingVerticalL },
});

const OPEN_LIST = "/bench?status=on_bench&status=proposed";

function Kpi({ title, value, href, caption }: { title: string; value: string; href?: string; caption?: string }) {
  const styles = useStyles();
  return (
    <Card>
      <Caption1 className={styles.muted}>{title}</Caption1>
      {href ? (
        <AppLink href={href}>
          <LargeTitle as="span" aria-label={`${title}: ${value}. View list`}>
            {value}
          </LargeTitle>
        </AppLink>
      ) : (
        <LargeTitle as="span">{value}</LargeTitle>
      )}
      {caption && <Caption1 className={styles.muted}>{caption}</Caption1>}
    </Card>
  );
}

function costTile(s: BenchSummaryOut): string {
  if (s.masked) return "••••";
  if (s.total_cost_to_date.length === 0) return "—";
  return s.total_cost_to_date.map((t) => formatDecimal(t.amount, t.currency)).join(" · ");
}

/** Bar chart rows: one bar per month per currency (never summed across currencies). Values are display-only. */
export function monthRows(s: BenchSummaryOut): { label: string; value: number; text: string }[] {
  return s.cost_by_month
    .filter((m) => m.amount !== null)
    .map((m) => ({
      label: s.cost_by_month.some((o) => o.currency !== m.currency) ? `${m.month} ${m.currency}` : m.month,
      value: Number(m.amount), // chart geometry only; labels use the exact decimal string
      text: formatDecimal(m.amount, m.currency),
    }));
}

/** `/bench/dashboard`: Delivery Manager bench KPIs, monthly bench cost and roll-offs (FR-127). */
export function BenchDashboard() {
  const styles = useStyles();
  const canRead = usePermission("bench:read");
  const [within, setWithin] = useState<30 | 60>(30);
  const summary = useBenchSummary(6, canRead);
  const rolls = useRollOffs(within, canRead);
  if (!canRead) return <NoAccess what="the bench dashboard" />;
  if (summary.isPending) return <GridSkeleton rows={4} />;
  if (summary.isError) return <ErrorBar title="Could not load the bench dashboard." message={errorMessage(summary.error)} />;
  const s = summary.data;
  const rows = monthRows(s);
  const columns: TableColumnDefinition<RollOffRow>[] = [
    createTableColumn({
      columnId: "worker",
      renderHeaderCell: () => "Worker",
      renderCell: (r) => <AppLink href={`/placements/${r.placement_id}`}>{r.candidate_name ?? r.placement_human_id}</AppLink>,
    }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (r) => r.client_name ?? "—" }),
    createTableColumn({ columnId: "role", renderHeaderCell: () => "Role", renderCell: (r) => r.role_title ?? "—" }),
    createTableColumn({ columnId: "end", renderHeaderCell: () => "Ends", renderCell: (r) => formatDate(r.end_date) }),
    createTableColumn({ columnId: "left", renderHeaderCell: () => "Days left", renderCell: (r) => r.days_left }),
  ];
  return (
    <>
      <PageHeader title="Bench dashboard" subtitle={`As of ${formatDate(s.as_of)}`} />
      <div className={styles.tiles}>
        <Kpi title="On bench" value={String(s.count_on_bench)} href={OPEN_LIST} />
        <Kpi title="Average bench days" value={s.avg_bench_days ?? "—"} href={OPEN_LIST} />
        <Kpi title="Bench cost to date" value={costTile(s)} href={OPEN_LIST} caption={s.masked ? "Requires compensation access" : undefined} />
        <Kpi
          title="Redeployment rate"
          value={pctText(s.redeployment_rate)}
          href="/bench?status=redeployed&status=released"
          caption={`${s.redeployed} redeployed · ${s.released} released`}
        />
        <Kpi title="Rolling off in 30 days" value={String(s.upcoming_roll_offs_30)} />
        <Kpi title="Rolling off in 60 days" value={String(s.upcoming_roll_offs_60)} />
      </div>
      <Card className={styles.section}>
        <CardHeader header={<Subtitle2 as="h2">Bench cost by month</Subtitle2>} />
        {s.masked ? (
          <Body1 className={styles.muted}>Bench cost needs compensation access.</Body1>
        ) : rows.length === 0 ? (
          <Body1 className={styles.muted}>No bench cost in the last six months.</Body1>
        ) : (
          <div role="img" aria-label={rows.map((r) => `${r.label}: ${r.text}`).join("; ")}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid vertical={false} stroke={tokens.colorNeutralStroke2} />
                <XAxis dataKey="label" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} width={72} />
                <Tooltip formatter={(_v, _n, p) => [(p.payload as { text: string }).text, "Cost"]} />
                <Bar dataKey="value" name="Cost" fill={seriesColor(0)} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <Card className={styles.section}>
        <CardHeader header={<Subtitle2 as="h2">Upcoming roll-offs</Subtitle2>} />
        <TabList selectedValue={String(within)} onTabSelect={(_, d) => setWithin(d.value === "60" ? 60 : 30)}>
          <Tab value="30">30 days</Tab>
          <Tab value="60">60 days</Tab>
        </TabList>
        <AdminGrid
          items={rolls.data}
          columns={columns}
          getRowId={(r) => r.placement_id}
          loading={rolls.isPending}
          error={rolls.error}
          emptyText="No active placements end in this window."
          label="Roll-offs"
        />
      </Card>
    </>
  );
}
