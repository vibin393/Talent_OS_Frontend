"use client";

import { Body1, Card, Tab, TabList } from "@fluentui/react-components";
import { useState } from "react";
import { ErrorBlock, LoadingBlock, PortalPageHeader, usePortalStyles } from "@/features/portal/ui";
import { ClientClaimCard } from "./client-claim-card";
import { useClientExpenses } from "./use-client-expenses";

/** `/client/expenses`: billable expense claims awaiting this Client user (or all). */
export function ClientExpensesInbox() {
  const portal = usePortalStyles();
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const list = useClientExpenses(status);
  return (
    <div className={portal.page}>
      <PortalPageHeader title="Expenses" subtitle="Review billable expenses claimed by your workers." />
      <TabList selectedValue={status} onTabSelect={(_, d) => setStatus(d.value as "pending" | "all")}>
        <Tab value="pending">Awaiting approval</Tab>
        <Tab value="all">All</Tab>
      </TabList>
      {list.isPending ? (
        <LoadingBlock label="Loading expense claims" />
      ) : list.isError ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <Card className={portal.card}>
          {list.data.length === 0 ? (
            <Body1 className={portal.empty}>{status === "pending" ? "Nothing is waiting for your approval." : "No expense claims yet."}</Body1>
          ) : (
            <ul className={portal.list}>
              {list.data.map((c) => (
                <ClientClaimCard key={c.id} claim={c} />
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
