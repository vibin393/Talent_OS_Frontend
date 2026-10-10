"use client";

import {
  Body1,
  Caption1,
  Card,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Title3,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { errorMessage } from "@/lib/api/errors";
import { type AppUsageOut, devApi } from "./api";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  tiles: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap" },
  tile: { padding: tokens.spacingHorizontalM, minWidth: "140px", display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  row: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap", alignItems: "end" },
});

const RANGES: { key: number; label: string }[] = [
  { key: 7, label: "Last 7 days" },
  { key: 30, label: "Last 30 days" },
  { key: 90, label: "Last 90 days" },
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The App "Usage" tab (FR-385): installs, requests, errors, webhook success and deprecated calls by day. */
export function UsageCharts({ appId }: { appId: string }) {
  const s = useStyles();
  const [days, setDays] = useState(30);
  const [asTable, setAsTable] = useState(false);
  const q = useQuery<AppUsageOut>({
    queryKey: ["dev", "usage", appId, days],
    queryFn: () => {
      const now = Date.now();
      return devApi.usage(appId, iso(new Date(now - days * 86400000)), iso(new Date(now)));
    },
  });

  if (q.isPending) return <Spinner label="Loading usage" />;
  if (q.error || !q.data) return <MessageBar intent="error"><MessageBarBody>{errorMessage(q.error)}</MessageBarBody></MessageBar>;
  const u = q.data;

  const tiles: { label: string; value: string }[] = [
    { label: "Installs", value: String(u.installs_total) },
    { label: "Active installations", value: String(u.installs_active) },
    { label: "Requests", value: String(u.requests) },
    { label: "Error rate", value: `${(u.error_rate * 100).toFixed(1)}%` },
    { label: "Webhook success", value: u.webhook_success_rate == null ? "—" : `${(u.webhook_success_rate * 100).toFixed(1)}%` },
    { label: "Deprecated calls", value: String(u.deprecated_calls) },
  ];

  return (
    <div className={s.root}>
      <div className={s.row}>
        <Field label="Range">
          <Dropdown value={RANGES.find((r) => r.key === days)?.label ?? ""} selectedOptions={[String(days)]} onOptionSelect={(_, d) => d.optionValue && setDays(Number(d.optionValue))}>
            {RANGES.map((r) => (
              <Option key={r.key} value={String(r.key)}>
                {r.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Switch label="View as table" checked={asTable} onChange={(_, d) => setAsTable(d.checked)} />
      </div>
      <div className={s.tiles}>
        {tiles.map((t) => (
          <Card key={t.label} className={s.tile}>
            <Caption1>{t.label}</Caption1>
            <Title3>{t.value}</Title3>
          </Card>
        ))}
      </div>
      {asTable ? (
        <Table aria-label="Usage by day">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Day</TableHeaderCell>
              <TableHeaderCell>Requests</TableHeaderCell>
              <TableHeaderCell>Errors</TableHeaderCell>
              <TableHeaderCell>Webhook attempts</TableHeaderCell>
              <TableHeaderCell>Webhook failures</TableHeaderCell>
              <TableHeaderCell>Deprecated calls</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {u.days.map((d) => (
              <TableRow key={d.day}>
                <TableCell>{d.day}</TableCell>
                <TableCell>{d.requests}</TableCell>
                <TableCell>{d.errors}</TableCell>
                <TableCell>{d.webhook_attempts}</TableCell>
                <TableCell>{d.webhook_failures}</TableCell>
                <TableCell>{d.deprecated_calls}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <>
          <Subtitle2 as="h3">Requests and errors</Subtitle2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={u.days} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="requests" stroke={tokens.colorBrandForeground1} dot={false} />
              <Line type="monotone" dataKey="errors" stroke={tokens.colorPaletteRedForeground1} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <Subtitle2 as="h3">Webhook attempts</Subtitle2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={u.days} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="webhook_attempts" fill={tokens.colorBrandBackground} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
      {u.tenants.length ? (
        <>
          <Subtitle2 as="h3">By tenant</Subtitle2>
          <Table aria-label="Usage by tenant">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Tenant</TableHeaderCell>
                <TableHeaderCell>Requests</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {u.tenants.map((t) => (
                <TableRow key={t.label}>
                  <TableCell>{t.label}</TableCell>
                  <TableCell>{t.requests}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : null}
      <Caption1>Usage is shown without customer names unless a customer chose to share it.</Caption1>
      <Body1 />
    </div>
  );
}
