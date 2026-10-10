"use client";

import {
  Badge,
  Button,
  Caption1,
  createTableColumn,
  makeStyles,
  mergeClasses,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { ChevronRight20Regular, Edit20Regular, Open20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { LegalEntitiesReadinessSummary } from "@/features/legal-entities/readiness-banner";
import { AdminGrid } from "@/features/admin/admin-grid";
import { NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { settingsApi, settingsKeys } from "./api";
import { ownerEpicLabel, type PanelKey, settingsCategories, type SettingsRow, settingsRows } from "./catalog";
import { SettingsPanel } from "./settings-panels";

const useStyles = makeStyles({
  tabs: { marginBottom: tokens.spacingVerticalL },
  name: { display: "flex", flexDirection: "column", paddingBlock: tokens.spacingVerticalXS, minWidth: 0 },
  unavailable: { opacity: 0.55 },
  summary: { color: tokens.colorNeutralForeground2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
});

/** `/admin/settings`: Microsoft 365 "Org settings" style hub over `GET /settings` (Epic 12 story 12.8). */
export function SettingsHub({ initialTab }: { initialTab?: string }) {
  const styles = useStyles();
  const router = useRouter();
  const canManage = usePermission("settings:manage");
  const [selectedTab, setTab] = useState<string | undefined>(initialTab);
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const catalog = useQuery({ queryKey: settingsKeys.catalog, queryFn: ({ signal }) => settingsApi.catalog(signal), enabled: canManage });
  const categories = settingsCategories(catalog.data);
  const tab = categories.some((c) => c.value === selectedTab) ? selectedTab! : categories[0].value;
  const sections = useQuery({ queryKey: settingsKeys.sections, queryFn: ({ signal }) => settingsApi.sections(signal), enabled: canManage });

  if (!canManage) return <NoAccess what="organization settings" />;

  const open = (row: SettingsRow) => {
    if (row.action === "panel") setPanel(row.key as PanelKey);
    else if (row.action === "link" && row.href) router.push(row.href);
  };

  const columns: TableColumnDefinition<SettingsRow>[] = [
    createTableColumn({
      columnId: "name",
      compare: (a, b) => a.label.localeCompare(b.label),
      renderHeaderCell: () => "Name",
      renderCell: (r) => (
        <div className={mergeClasses(styles.name, !r.available && styles.unavailable)} aria-disabled={!r.available || undefined}>
          <Text weight="semibold">{r.label}</Text>
          <Caption1>{r.description}</Caption1>
        </div>
      ),
    }),
    createTableColumn({
      columnId: "summary",
      renderHeaderCell: () => "Current setting",
      renderCell: (r) =>
        !r.available ? (
          <Badge appearance="tint" color="subtle">
            {ownerEpicLabel(r) ?? "Coming soon"}
          </Badge>
        ) : (
          <span className={styles.summary}>{r.summary || (r.action === "none" ? "Managed in its own area" : "—")}</span>
        ),
    }),
    createTableColumn({
      columnId: "open",
      renderHeaderCell: () => "",
      renderCell: (r) =>
        r.action === "panel" ? (
          <Button appearance="subtle" icon={<Edit20Regular />} onClick={() => open(r)} aria-label={`Edit ${r.label}`}>
            Edit
          </Button>
        ) : r.action === "link" ? (
          <Button
            appearance="subtle"
            icon={<Open20Regular />}
            iconPosition="after"
            onClick={() => open(r)}
            aria-label={`Open ${r.label}`}
          >
            Open
          </Button>
        ) : r.available ? (
          <ChevronRight20Regular aria-hidden style={{ opacity: 0.3 }} />
        ) : null,
    }),
  ];

  return (
    <>
      <PageHeader title="Settings" subtitle="Organization-wide settings for your Talent OS workspace." />
      <LegalEntitiesReadinessSummary />
      <TabList
        className={styles.tabs}
        selectedValue={tab}
        onTabSelect={(_, d) => {
          setTab(String(d.value));
          router.replace(`/admin/settings?tab=${String(d.value)}`, { scroll: false });
        }}
        aria-label="Settings categories"
      >
        {categories.map((c) => (
          <Tab key={c.value} value={c.value}>
            {c.label}
          </Tab>
        ))}
      </TabList>
      <AdminGrid
        items={catalog.data ? settingsRows(catalog.data, tab) : undefined}
        columns={columns}
        getRowId={(r) => r.key}
        loading={catalog.isPending}
        error={catalog.error}
        emptyText="No settings in this category."
        label={`${categories.find((c) => c.value === tab)?.label ?? ""} settings`}
        sortable
      />
      {panel && sections.data && <SettingsPanel panel={panel} sections={sections.data} onClose={() => setPanel(null)} />}
    </>
  );
}
