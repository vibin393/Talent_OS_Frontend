"use client";

import { createTableColumn, MessageBar, MessageBarBody, Tab, TabList, type TableColumnDefinition } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { formatDateTime, PagingBar } from "@/features/admin/ui";
import type { ViolationKind, ViolationRow } from "@/lib/api/governance-types";
import { governanceApi, governanceKeys } from "./api";
import { ConsoleShell } from "./console-shell";
import { CROSS_SCOPE_NOTE, humanize, runRef, VIOLATION_TABS, violationKind } from "./logic";

/** `/admin/ai/violations`: refused tools, injection detections and possible cross-scope attempts. */
export function ViolationsPage() {
  return (
    <ConsoleShell>
      <ViolationsBody />
    </ConsoleShell>
  );
}

function ViolationsBody() {
  const [kind, setKind] = useState<ViolationKind>("refused_tool");
  const [page, setPage] = useState(1);
  const q = `page=${page}&page_size=${DEFAULT_PAGE_SIZE}`;
  const list = useQuery({
    queryKey: governanceKeys.violations(kind, q),
    queryFn: ({ signal }) => governanceApi.violations(kind, q, signal),
    placeholderData: (prev) => prev,
  });
  const columns: TableColumnDefinition<ViolationRow>[] = [
    createTableColumn({ columnId: "when", renderHeaderCell: () => "When", renderCell: (v) => formatDateTime(v.created_at) }),
    createTableColumn({ columnId: "agent", renderHeaderCell: () => "Agent", renderCell: (v) => humanize(v.agent_key) }),
    createTableColumn({ columnId: "tool", renderHeaderCell: () => "Tool", renderCell: (v) => v.tool_key ?? "—" }),
    createTableColumn({ columnId: "code", renderHeaderCell: () => "Code", renderCell: (v) => v.error_code ?? v.mode_reason ?? "—" }),
    createTableColumn({ columnId: "run", renderHeaderCell: () => "Run", renderCell: (v) => <AppLink href={`/admin/ai/runs/${v.run_id}`}>{runRef(v.run_id)}</AppLink> }),
    createTableColumn({ columnId: "tainted", renderHeaderCell: () => "Tainted", renderCell: (v) => (v.tainted ? "Yes" : "No") }),
  ];
  return (
    <>
      <TabList
        selectedValue={kind}
        onTabSelect={(_, d) => {
          setKind(violationKind(String(d.value)));
          setPage(1);
        }}
        aria-label="Violation kinds"
        size="small"
      >
        {VIOLATION_TABS.map((t) => (
          <Tab key={t.value} value={t.value}>
            {t.label}
          </Tab>
        ))}
      </TabList>
      <MessageBar intent="info" layout="multiline">
        <MessageBarBody>{CROSS_SCOPE_NOTE}</MessageBarBody>
      </MessageBar>
      <AdminGrid
        items={list.data?.items}
        columns={columns}
        getRowId={(v) => `${v.run_id}-${v.created_at}-${v.tool_key ?? ""}`}
        loading={list.isPending}
        error={list.error}
        emptyText="Nothing recorded."
        label={VIOLATION_TABS.find((t) => t.value === kind)?.label ?? "Violations"}
        footer={list.data && <PagingBar page={page} pageSize={DEFAULT_PAGE_SIZE} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />}
      />
    </>
  );
}
