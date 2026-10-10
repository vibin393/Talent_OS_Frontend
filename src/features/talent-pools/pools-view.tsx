"use client";

import {
  Badge,
  Button,
  Caption1,
  createTableColumn,
  Dropdown,
  Link,
  makeStyles,
  Option,
  SearchBox,
  Switch,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Add20Regular, Warning16Regular, Sparkle20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { useDebounced } from "@/lib/use-debounced";
import { diffText, KIND_COLORS, KIND_LABELS, POOL_FILTERS, VISIBILITY_LABELS } from "./logic";
import { NewPoolDialog, TemplatesDialog } from "./pool-dialogs";
import type { PoolFilter, PoolKind, PoolOut } from "./types";
import { usePools, useToggleSubscription } from "./use-pools";

const useStyles = makeStyles({
  name: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  stack: { display: "flex", flexDirection: "column" },
  num: { fontVariantNumeric: "tabular-nums" },
  warn: { color: tokens.colorPaletteMarigoldForeground1 },
  tabs: { marginBottom: tokens.spacingVerticalS },
});

export function PoolKindBadge({ kind }: { kind: PoolKind }) {
  return (
    <Badge appearance="tint" color={KIND_COLORS[kind]}>
      {KIND_LABELS[kind]}
    </Badge>
  );
}

/** Subscribe `Switch` for a pool's daily digest of new members. */
export function SubscribeSwitch({ pool, label }: { pool: PoolOut; label?: string }) {
  const toggle = useToggleSubscription();
  return (
    <Switch
      aria-label={`Daily digest for ${pool.name}`}
      label={label}
      checked={toggle.isPending ? !!toggle.variables?.on : pool.subscribed}
      disabled={toggle.isPending}
      onClick={(e) => e.stopPropagation()}
      onChange={(_, d) => toggle.mutate({ pool, on: d.checked })}
    />
  );
}

/** `/talent-pools`: visible pools with filters, templates and the "New pool" dialog. */
export function PoolsView() {
  const styles = useStyles();
  const admin = useAdminStyles();
  const router = useRouter();
  const canRead = usePermission("pool:read");
  const canWrite = usePermission("pool:write");
  const canManage = usePermission("pool:manage");
  const [filter, setFilter] = useState<PoolFilter>("all");
  const [kind, setKind] = useState<PoolKind | "">("");
  const [q, setQ] = useState("");
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState(false);
  const debouncedQ = useDebounced(q, 300);
  const pools = usePools(
    { filter, kind: kind || undefined, include_archived: archived, q: debouncedQ.trim() || undefined },
    canRead,
  );
  if (!canRead) return <NoAccess what="talent pools" />;

  const open = (p: PoolOut) => router.push(`/talent-pools/${p.id}`);
  const columns: TableColumnDefinition<PoolOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (p) => (
        <span className={styles.name}>
          <Link
            as="button"
            onClick={(e) => {
              e.stopPropagation();
              open(p);
            }}
          >
            {p.name}
          </Link>
          {p.needs_repair && (
            <Tooltip content="The segment needs repair: refreshes are skipped." relationship="label">
              <Warning16Regular className={styles.warn} />
            </Tooltip>
          )}
          {p.status === "archived" && (
            <Badge appearance="outline" color="subtle" size="small">
              Archived
            </Badge>
          )}
        </span>
      ),
    }),
    createTableColumn({ columnId: "kind", renderHeaderCell: () => "Kind", renderCell: (p) => <PoolKindBadge kind={p.kind} /> }),
    createTableColumn({ columnId: "owner", renderHeaderCell: () => "Owner", renderCell: (p) => p.owner_name ?? "—" }),
    createTableColumn({ columnId: "visibility", renderHeaderCell: () => "Visibility", renderCell: (p) => VISIBILITY_LABELS[p.visibility] }),
    createTableColumn({
      columnId: "members",
      renderHeaderCell: () => "Members",
      renderCell: (p) => <Text className={styles.num}>{p.member_count.toLocaleString()}</Text>,
    }),
    createTableColumn({
      columnId: "refresh",
      renderHeaderCell: () => "Last refresh",
      renderCell: (p) =>
        p.kind === "static" ? (
          "—"
        ) : (
          <span className={styles.stack}>
            <Text size={200}>{p.last_refreshed_at ? formatDateTime(p.last_refreshed_at) : "Not yet"}</Text>
            {p.last_diff && <Caption1 className={styles.num}>{diffText(p.last_diff)}</Caption1>}
          </span>
        ),
    }),
    createTableColumn({ columnId: "subscribe", renderHeaderCell: () => "Digest", renderCell: (p) => <SubscribeSwitch pool={p} /> }),
  ];

  return (
    <>
      <PageHeader title="Talent Pools" subtitle="Saved groups of candidates and workers to start every search from" />
      <TabList className={styles.tabs} selectedValue={filter} onTabSelect={(_, d) => setFilter(d.value as PoolFilter)} aria-label="Pool filter">
        {POOL_FILTERS.map((f) => (
          <Tab key={f.value} value={f.value}>
            {f.label}
          </Tab>
        ))}
      </TabList>
      <div className={admin.toolbar}>
        <SearchBox className={admin.search} placeholder="Search pools" value={q} onChange={(_, d) => setQ(d.value)} aria-label="Search pools" />
        <Dropdown
          className={admin.filter}
          aria-label="Kind"
          value={kind ? KIND_LABELS[kind] : "All kinds"}
          selectedOptions={[kind]}
          onOptionSelect={(_, d) => setKind((d.optionValue ?? "") as PoolKind | "")}
        >
          <Option value="">All kinds</Option>
          <Option value="static">Static</Option>
          <Option value="dynamic">Dynamic</Option>
        </Dropdown>
        <Switch label="Show archived" checked={archived} onChange={(_, d) => setArchived(d.checked)} />
        <span className={admin.grow} />
        {canManage && (
          <Button icon={<Sparkle20Regular />} onClick={() => setTemplates(true)}>
            Templates
          </Button>
        )}
        {canWrite && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New pool
          </Button>
        )}
      </div>
      <AdminGrid
        items={pools.data}
        columns={columns}
        getRowId={(p) => p.id}
        loading={pools.isPending}
        error={pools.error}
        emptyText="No pools match these filters."
        label="Talent pools"
        onRowClick={open}
      />
      {creating && <NewPoolDialog onClose={() => setCreating(false)} />}
      {templates && <TemplatesDialog onClose={() => setTemplates(false)} />}
    </>
  );
}
