"use client";

import { Badge, createTableColumn, Dropdown, Field, makeStyles, Option, type TableColumnDefinition, Text, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime } from "@/features/admin/ui";
import { consoleApi, consoleKeys, type ViolationRow } from "./api";
import { VIOLATION_FILTERS, violationLabel } from "./logic";

const useStyles = makeStyles({
  filters: { display: "flex", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
});

/** "Policy events" tab: composed policy violations (egress / scope / injection / token reuse / human-only / pauses). */
export function PolicyEventsTab() {
  const styles = useStyles();
  const [kind, setKind] = useState("");
  const rows = useQuery({
    queryKey: consoleKeys.violations(kind),
    queryFn: ({ signal }) => consoleApi.violations({ kind: kind || null }, signal),
    refetchInterval: 60_000,
  });

  const columns: TableColumnDefinition<ViolationRow>[] = [
    createTableColumn({ columnId: "when", renderHeaderCell: () => "When", renderCell: (r) => formatDateTime(r.at) }),
    createTableColumn({
      columnId: "type",
      renderHeaderCell: () => "Type",
      renderCell: (r) => (
        <Badge appearance="tint" color="warning">
          {violationLabel(r.kind)}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "system", renderHeaderCell: () => "System", renderCell: (r) => r.installation ?? "—" }),
    createTableColumn({ columnId: "user", renderHeaderCell: () => "User", renderCell: (r) => r.user ?? "—" }),
    createTableColumn({ columnId: "where", renderHeaderCell: () => "Where", renderCell: (r) => <Text>{r.route_or_tool ?? r.error_code ?? "—"}</Text> }),
  ];

  return (
    <>
      <div className={styles.filters}>
        <Field label="Type">
          <Dropdown
            selectedOptions={[kind]}
            value={VIOLATION_FILTERS.find((o) => o.value === kind)?.label ?? "All types"}
            onOptionSelect={(_, d) => setKind(String(d.optionValue))}
            style={{ minWidth: 220 }}
          >
            {VIOLATION_FILTERS.map((o) => (
              <Option key={o.value} value={o.value}>
                {o.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>
      <AdminGrid
        items={rows.data}
        columns={columns}
        getRowId={(r) => `${r.kind}:${r.at ?? ""}:${r.installation ?? ""}:${r.route_or_tool ?? ""}`}
        loading={rows.isPending}
        error={rows.error}
        emptyText="No policy events in this period."
        label="Policy events"
      />
    </>
  );
}
