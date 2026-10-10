"use client";

import {
  Badge,
  Caption1,
  Card,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Tab,
  TabList,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { NoAccess } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { hasPermission } from "@/features/auth/permissions";
import { AppLink } from "@/components/app-link";
import { consoleApi, consoleKeys } from "./api";
import { activeConsoleTab, type ConsoleTabKey, CONSOLE_TABS, KILL_SWITCH_BANNER, summaryCards, VIEW_ONLY_NOTICE } from "./logic";
import { InstallationsTab } from "./installations-tab";
import { AuthorizationsTab } from "./authorizations-tab";
import { DataFlowsTab } from "./data-flows-tab";
import { PolicyEventsTab } from "./policy-events-tab";
import { TestResultsTab } from "./test-results-tab";
import { WebhooksTab } from "./webhooks-tab";
import { McpTab } from "./mcp-tab";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1200px" },
  cards: { display: "grid", gap: tokens.spacingHorizontalM, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 170px), 1fr))" },
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, padding: tokens.spacingHorizontalM },
  value: { fontSize: tokens.fontSizeHero700, fontWeight: tokens.fontWeightSemibold, lineHeight: tokens.lineHeightHero700 },
  tabs: { overflowX: "auto", borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}` },
});

/** `/admin/integrations` — the ecosystem console (Epic 79 story 79.1, FR-405). */
export function EcosystemConsolePage() {
  const styles = useStyles();
  const { data: me } = useMe();
  const perms = me?.permissions;
  const canView = hasPermission(perms, "integration:view") || hasPermission(perms, "integration:manage");
  const canManage = hasPermission(perms, "integration:manage");
  const [tab, setTab] = useState<ConsoleTabKey>("installations");

  // Console counts refresh every 60 s (spec B: polling only).
  const summary = useQuery({
    queryKey: consoleKeys.summary,
    queryFn: ({ signal }) => consoleApi.summary(signal),
    enabled: canView,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (me && !canView) {
    return (
      <>
        <PageHeader title="Integrations" />
        <NoAccess what="the ecosystem console" />
      </>
    );
  }

  const cards = summaryCards(summary.data);
  const killOn = summary.data?.kill_switch_on;

  return (
    <div className={styles.root}>
      <PageHeader title="Integrations" subtitle="Everything that connects to Talent OS from outside." />

      {killOn ? (
        <MessageBar intent="warning">
          <MessageBarBody>{KILL_SWITCH_BANNER}</MessageBarBody>
          <MessageBarActions>
            <AppLink href="/settings/integrations">Manage</AppLink>
          </MessageBarActions>
        </MessageBar>
      ) : null}

      {!canManage ? (
        <MessageBar intent="info">
          <MessageBarBody>{VIEW_ONLY_NOTICE}</MessageBarBody>
        </MessageBar>
      ) : null}

      <div className={styles.cards} role="list" aria-label="Integration summary">
        {cards.map((c) => (
          <Card key={c.key} className={styles.card} role="listitem">
            <Caption1>{c.label}</Caption1>
            <Text as="span" className={styles.value}>
              <Badge appearance="ghost" color={c.color} size="large" style={{ paddingLeft: 0 }}>
                {summary.isPending ? "–" : c.value}
              </Badge>
            </Text>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "center", justifyContent: "space-between" }}>
        <TabList className={styles.tabs} selectedValue={activeConsoleTab(tab)} onTabSelect={(_, d) => setTab(d.value as ConsoleTabKey)} aria-label="Ecosystem console">
          {CONSOLE_TABS.map((t) => (
            <Tab key={t.key} value={t.key}>
              {t.label}
            </Tab>
          ))}
        </TabList>
        <AppLink href="/admin/integrations/insights">Dashboards</AppLink>
      </div>

      <div>
        {tab === "installations" && <InstallationsTab canManage={canManage} />}
        {tab === "authorizations" && <AuthorizationsTab canManage={canManage} />}
        {tab === "webhooks" && <WebhooksTab />}
        {tab === "mcp" && <McpTab />}
        {tab === "data-flows" && <DataFlowsTab />}
        {tab === "policy-events" && <PolicyEventsTab />}
        {tab === "test-results" && <TestResultsTab />}
      </div>
    </div>
  );
}
