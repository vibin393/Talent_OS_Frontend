"use client";

import { createTableColumn, MessageBar, MessageBarBody, type TableColumnDefinition } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { AdminGrid } from "@/features/admin/admin-grid";
import { copilotApi, copilotKeys } from "@/features/copilot/api";
import type { UsageDay } from "@/features/copilot/types";
import { ConsoleShell } from "./console-shell";
import { commentsPerDay, COPILOT_USAGE_NOTE, formatMicrosUsd, formatTokens } from "./logic";

/** `/admin/ai/copilot-usage`: Copilot usage metadata by day (Epic 54 `GET /copilot/admin/usage`). */
export function CopilotUsagePage() {
  return (
    <ConsoleShell anyOf={["copilot:configure"]}>
      <UsageBody />
    </ConsoleShell>
  );
}

function UsageBody() {
  const usage = useQuery({ queryKey: copilotKeys.usage(), queryFn: ({ signal }) => copilotApi.usage(undefined, undefined, signal) });
  const comments = commentsPerDay(usage.data?.comments ?? []);
  const columns: TableColumnDefinition<UsageDay>[] = [
    createTableColumn({ columnId: "day", compare: (a, b) => a.day.localeCompare(b.day), renderHeaderCell: () => "Day", renderCell: (d) => d.day }),
    createTableColumn({ columnId: "conv", renderHeaderCell: () => "Conversations", renderCell: (d) => formatTokens(d.conversations) }),
    createTableColumn({ columnId: "turns", renderHeaderCell: () => "Turns", renderCell: (d) => formatTokens(d.turns) }),
    createTableColumn({ columnId: "users", renderHeaderCell: () => "Active users", renderCell: (d) => formatTokens(d.active_users) }),
    createTableColumn({ columnId: "tokens", renderHeaderCell: () => "Tokens", renderCell: (d) => formatTokens(d.input_tokens + d.output_tokens) }),
    createTableColumn({ columnId: "cost", renderHeaderCell: () => "Cost (USD)", renderCell: (d) => formatMicrosUsd(d.cost_micros) }),
    createTableColumn({ columnId: "helpful", renderHeaderCell: () => "Helpful %", renderCell: (d) => (d.helpful_pct === null ? "—" : `${Math.round(d.helpful_pct)}%`) }),
    createTableColumn({ columnId: "comments", renderHeaderCell: () => "Comments", renderCell: (d) => comments[d.day] ?? 0 }),
    createTableColumn({
      columnId: "failures",
      renderHeaderCell: () => "Failures",
      renderCell: (d) => Object.values(d.failures ?? {}).reduce((a, b) => a + b, 0),
    }),
  ];
  return (
    <>
      <MessageBar intent="info" layout="multiline">
        <MessageBarBody>{COPILOT_USAGE_NOTE}</MessageBarBody>
      </MessageBar>
      <AdminGrid
        items={usage.data?.days}
        columns={columns}
        getRowId={(d) => d.day}
        loading={usage.isPending}
        error={usage.error}
        emptyText="No Copilot usage in this period."
        label="Copilot usage by day"
        sortable
      />
    </>
  );
}
