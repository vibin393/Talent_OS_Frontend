"use client";

import { Badge, createTableColumn, type TableColumnDefinition, Text } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime } from "@/features/admin/ui";
import { statusColor } from "./logic";
import { consoleApi, consoleKeys, type TestResultRow } from "./api";

const str = (v: unknown): string | null => (typeof v === "string" ? v : v == null ? null : String(v));

/** "Test results" tab: latest Conformance Kit / red-team / STT results for the platform Listings this tenant uses. */
export function TestResultsTab() {
  const rows = useQuery({ queryKey: consoleKeys.testResults, queryFn: ({ signal }) => consoleApi.testResults(signal) });

  const columns: TableColumnDefinition<TestResultRow>[] = [
    createTableColumn({ columnId: "listing", renderHeaderCell: () => "Listing", renderCell: (r) => <Text weight="semibold">{str(r.listing) ?? "—"}</Text> }),
    createTableColumn({ columnId: "suite", renderHeaderCell: () => "Suite", renderCell: (r) => str(r.suite) ?? "—" }),
    createTableColumn({
      columnId: "result",
      renderHeaderCell: () => "Result",
      renderCell: (r) => {
        const result = str(r.result);
        return result ? (
          <Badge appearance="tint" color={statusColor(result)}>
            {result}
          </Badge>
        ) : (
          "—"
        );
      },
    }),
    createTableColumn({ columnId: "run_at", renderHeaderCell: () => "Run at", renderCell: (r) => formatDateTime(str(r.run_at)) }),
  ];

  return (
    <AdminGrid
      items={rows.data}
      columns={columns}
      getRowId={(r) => `${str(r.listing) ?? ""}:${str(r.suite) ?? ""}:${str(r.run_at) ?? ""}`}
      loading={rows.isPending}
      error={rows.error}
      emptyText="No test results for your installed listings yet."
      label="Test results"
    />
  );
}
