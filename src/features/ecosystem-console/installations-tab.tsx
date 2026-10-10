"use client";

import {
  Badge,
  Body1,
  Caption1,
  createTableColumn,
  Dropdown,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  SearchBox,
  Subtitle2,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DetailsDrawer, formatDateTime } from "@/features/admin/ui";
import { useDebounced } from "@/lib/use-debounced";
import { consoleApi, consoleKeys, type InstallationRow } from "./api";
import { filterInstallations, installationTypeLabel, publisherLabel, statusColor } from "./logic";

const useStyles = makeStyles({
  filters: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "end", marginBottom: tokens.spacingVerticalM },
  chips: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  drawer: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
});

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "app", label: "Apps" },
  { value: "connector", label: "Connectors" },
  { value: "api_key", label: "API keys" },
];

function ScopeChips({ scopes, sensitive }: { scopes: readonly string[]; sensitive: readonly string[] }) {
  const styles = useStyles();
  if (scopes.length === 0) return <Text>—</Text>;
  return (
    <span className={styles.chips}>
      {scopes.map((s) => (
        <Badge key={s} appearance="tint" color={sensitive.includes(s) ? "warning" : "informative"} size="small">
          {s}
        </Badge>
      ))}
    </span>
  );
}

/** "Installations" tab: Apps, connectors and API keys in one grid; a row opens the detail drawer. */
export function InstallationsTab({ canManage: _canManage }: { canManage: boolean }) {
  const styles = useStyles();
  const [kind, setKind] = useState<string>("");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 250);
  const query = `${kind}|${debouncedQ}`;
  const [selected, setSelected] = useState<InstallationRow | null>(null);

  const rows = useQuery({
    queryKey: consoleKeys.installations(query),
    queryFn: ({ signal }) => consoleApi.installations({ kind: kind || null, q: debouncedQ || null }, signal),
    refetchInterval: 60_000,
  });
  // The server also filters; this keeps the grid responsive while a request is in flight.
  const items = rows.data ? filterInstallations(rows.data, kind || null, debouncedQ || null) : undefined;

  const columns: TableColumnDefinition<InstallationRow>[] = [
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Name", renderCell: (r) => <Text weight="semibold">{r.name}</Text> }),
    createTableColumn({ columnId: "type", renderHeaderCell: () => "Type", renderCell: (r) => installationTypeLabel(r.kind) }),
    createTableColumn({ columnId: "publisher", renderHeaderCell: () => "Publisher", renderCell: (r) => publisherLabel(r.publisher) }),
    createTableColumn({ columnId: "version", renderHeaderCell: () => "Version", renderCell: (r) => r.version ?? "—" }),
    createTableColumn({
      columnId: "access",
      renderHeaderCell: () => "Access",
      renderCell: (r) => <ScopeChips scopes={r.granted_scopes} sensitive={r.sensitive_scopes} />,
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) =>
        r.status ? (
          <Badge appearance="tint" color={statusColor(r.status)}>
            {r.status}
          </Badge>
        ) : (
          "—"
        ),
    }),
    createTableColumn({
      columnId: "health",
      renderHeaderCell: () => "Health",
      renderCell: (r) =>
        r.health_status ? (
          <Badge appearance="outline" color={statusColor(r.health_status)}>
            {r.health_status}
          </Badge>
        ) : (
          "—"
        ),
    }),
    createTableColumn({ columnId: "last", renderHeaderCell: () => "Last activity", renderCell: (r) => formatDateTime(r.last_activity_at) }),
    createTableColumn({ columnId: "requests", renderHeaderCell: () => "Requests (30 days)", renderCell: (r) => r.requests_30d.toLocaleString() }),
  ];

  return (
    <>
      <div className={styles.filters}>
        <Field label="Type">
          <Dropdown
            selectedOptions={[kind]}
            value={TYPE_OPTIONS.find((o) => o.value === kind)?.label ?? "All types"}
            onOptionSelect={(_, d) => setKind(String(d.optionValue))}
            style={{ minWidth: 160 }}
          >
            {TYPE_OPTIONS.map((o) => (
              <Option key={o.value} value={o.value}>
                {o.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Search">
          <SearchBox value={q} onChange={(_, d) => setQ(d.value)} placeholder="Name" />
        </Field>
      </div>
      <AdminGrid
        items={items}
        columns={columns}
        getRowId={(r) => `${r.kind}:${r.id}`}
        loading={rows.isPending}
        error={rows.error}
        emptyText="No installations match these filters."
        label="Installations"
        onRowClick={(r) => setSelected(r)}
      />
      <InstallationDrawer row={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function InstallationDrawer({ row, onClose }: { row: InstallationRow | null; onClose: () => void }) {
  const styles = useStyles();
  return (
    <DetailsDrawer open={!!row} onClose={onClose} title={row?.name ?? ""} size="medium">
      {row ? (
        <div className={styles.drawer}>
          <div className={styles.section}>
            <Caption1>Type</Caption1>
            <Body1>
              {installationTypeLabel(row.kind)} · {publisherLabel(row.publisher)}
              {row.version ? ` · v${row.version}` : ""}
            </Body1>
          </div>
          <div className={styles.section}>
            <Subtitle2>Access</Subtitle2>
            <ScopeChips scopes={row.granted_scopes} sensitive={row.sensitive_scopes} />
          </div>
          <div className={styles.section}>
            <Subtitle2>Usage</Subtitle2>
            <Body1>
              {row.requests_30d.toLocaleString()} requests · {row.errors_30d.toLocaleString()} errors (30 days)
              {row.minutes_30d ? ` · ${row.minutes_30d.toLocaleString()} minutes` : ""}
            </Body1>
            <Caption1>Last activity {formatDateTime(row.last_activity_at)}</Caption1>
            {row.accountable_user ? <Caption1>Accountable user: {row.accountable_user}</Caption1> : null}
          </div>
          <MessageBar intent="info">
            <MessageBarBody>
              Access history, usage by day, sync jobs and secret metadata are not yet exposed by the console API. They
              are shown in the installation&apos;s own page under Settings &rarr; Integrations.
            </MessageBarBody>
          </MessageBar>
        </div>
      ) : null}
    </DetailsDrawer>
  );
}
