"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  makeStyles,
  Subtitle2,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TabList,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AppLink } from "@/components/app-link";
import { NoAccess } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { hasPermission } from "@/features/auth/permissions";
import { consoleApi, consoleKeys } from "@/features/ecosystem-console/api";
import {
  apiRequestRows,
  P5_EMPTY_STATE,
  P5_GAP_NOTE,
  P5_TAB_LABELS,
  P5_TAB_PERMISSION,
  type P5DashboardKey,
  type P5TileDef,
  tilesFor,
} from "./tile-model";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1200px" },
  grid: { display: "grid", gap: tokens.spacingHorizontalL, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))" },
  tile: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: tokens.spacingHorizontalM, minHeight: "140px" },
  empty: { color: tokens.colorNeutralForeground3 },
});

/** `/admin/integrations/insights` — the two Phase 5 dashboard tabs (spec B4). */
export function P5DashboardsPage() {
  const styles = useStyles();
  const { data: me } = useMe();
  const perms = me?.permissions;
  const tabs = (["ecosystem", "platform_outcomes"] as P5DashboardKey[]).filter((k) => hasPermission(perms, P5_TAB_PERMISSION[k]));
  const [tab, setTab] = useState<P5DashboardKey>("ecosystem");
  const active = tabs.includes(tab) ? tab : tabs[0];

  // Only data reachable today: the installations read feeds the "API requests & error rate" tile.
  const installations = useQuery({
    queryKey: consoleKeys.installations("all|"),
    queryFn: ({ signal }) => consoleApi.installations({}, signal),
    enabled: hasPermission(perms, "integration:view") || hasPermission(perms, "integration:manage"),
    refetchInterval: 60_000,
  });

  if (me && tabs.length === 0) {
    return (
      <>
        <PageHeader title="Integration dashboards" />
        <NoAccess what="integration dashboards" />
      </>
    );
  }

  return (
    <div className={styles.root}>
      <PageHeader title="Integration dashboards" subtitle="How your apps, connectors and AI integrations are doing." />
      <AppLink href="/admin/integrations">&larr; Ecosystem console</AppLink>
      {tabs.length > 1 ? (
        <TabList selectedValue={active} onTabSelect={(_, d) => setTab(d.value as P5DashboardKey)} aria-label="Dashboards">
          {tabs.map((k) => (
            <Tab key={k} value={k}>
              {P5_TAB_LABELS[k]}
            </Tab>
          ))}
        </TabList>
      ) : null}
      <div className={styles.grid}>
        {active
          ? tilesFor(active).map((def) => (
              <TileCard key={`${active}:${def.key}`} def={def} rows={def.derivable ? apiRequestRows(installations.data) : null} />
            ))
          : null}
      </div>
    </div>
  );
}

function TileCard({ def, rows }: { def: P5TileDef; rows: { installation: string; requests: number; errors: number; error_rate: string }[] | null }) {
  const styles = useStyles();
  const [asTable, setAsTable] = useState(false);
  const hasData = !!rows && rows.length > 0;
  return (
    <Card className={styles.tile}>
      <CardHeader
        header={<Subtitle2 as="h3">{def.title}</Subtitle2>}
        action={hasData ? <Button size="small" appearance="transparent" onClick={() => setAsTable((v) => !v)}>{asTable ? "View as chart" : "View as table"}</Button> : undefined}
      />
      {hasData ? (
        <Table size="small" aria-label={def.title}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Installation</TableHeaderCell>
              <TableHeaderCell>Requests</TableHeaderCell>
              <TableHeaderCell>Errors</TableHeaderCell>
              <TableHeaderCell>Error rate</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows!.map((r) => (
              <TableRow key={r.installation}>
                <TableCell>{r.installation}</TableCell>
                <TableCell>{r.requests.toLocaleString()}</TableCell>
                <TableCell>{r.errors.toLocaleString()}</TableCell>
                <TableCell>{r.error_rate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <>
          <Body1 className={styles.empty}>{P5_EMPTY_STATE}</Body1>
          {!def.derivable ? <Caption1 className={styles.empty}>{P5_GAP_NOTE}</Caption1> : null}
          <Text size={200} className={styles.empty}>
            &nbsp;
          </Text>
        </>
      )}
    </Card>
  );
}
