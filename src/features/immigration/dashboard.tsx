"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  createTableColumn,
  makeStyles,
  Subtitle2,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Settings20Regular } from "@fluentui/react-icons";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { AppLink } from "@/components/app-link";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { casesHref, countryName, STAGE_CATEGORY_LABELS } from "./logic";
import type { AtRiskOut, StageCategory } from "./types";
import { useAtRisk, useImmigrationDashboard, useImmigrationPermissions } from "./use-immigration";

const useStyles = makeStyles({
  headerRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: tokens.spacingHorizontalM },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  tiles: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalL },
  tileLink: {
    textDecorationLine: "none",
    color: tokens.colorNeutralForeground1,
    borderRadius: tokens.borderRadiusMedium,
    ":focus-visible": { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: "2px" },
  },
  tile: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS, height: "100%", boxSizing: "border-box" },
  value: { fontSize: tokens.fontSizeHero800, lineHeight: tokens.lineHeightHero800, fontWeight: tokens.fontWeightSemibold },
  columns: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: tokens.spacingHorizontalL, marginBottom: tokens.spacingVerticalL },
  section: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  bars: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  bar: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 2fr 40px", alignItems: "center", gap: tokens.spacingHorizontalS },
  track: { height: "8px", backgroundColor: tokens.colorNeutralBackground5, borderRadius: tokens.borderRadiusSmall, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: tokens.colorBrandBackground },
  muted: { color: tokens.colorNeutralForeground3 },
});

function Bars({ rows, label }: { rows: { key: string; label: string; count: number; href: string }[]; label: string }) {
  const styles = useStyles();
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <Caption1 className={styles.muted}>No open cases.</Caption1>;
  return (
    <ul className={styles.bars} aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className={styles.bar}>
          <AppLink href={r.href}>{r.label}</AppLink>
          <div className={styles.track} aria-hidden>
            {/* width is data-driven; makeStyles cannot express it */}
            <div className={styles.fill} style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <Text>{r.count}</Text>
        </li>
      ))}
    </ul>
  );
}

/** `/immigration`: tiles (each a drill-down to the filtered case list), stage / country breakdown and the at-risk list. */
export function ImmigrationDashboard() {
  const styles = useStyles();
  const router = useRouter();
  const { canRead, canConfigure } = useImmigrationPermissions();
  const dash = useImmigrationDashboard(canRead);
  const atRisk = useAtRisk(canRead);
  if (!canRead) return <NoAccess what="immigration" />;
  const riskColumns: TableColumnDefinition<AtRiskOut>[] = [
    createTableColumn({
      columnId: "placement",
      renderHeaderCell: () => "Placement",
      renderCell: (r) => <AppLink href={`/placements/${r.placement_id}`}>{r.placement_human_id}</AppLink>,
    }),
    createTableColumn({
      columnId: "worker",
      renderHeaderCell: () => "Worker",
      renderCell: (r) => <AppLink href={`/candidates/${r.candidate_id}`}>{r.candidate_name ?? "Open profile"}</AppLink>,
    }),
    createTableColumn({ columnId: "country", renderHeaderCell: () => "Work country", renderCell: (r) => countryName(r.work_country) }),
    createTableColumn({
      columnId: "case",
      renderHeaderCell: () => "Immigration case",
      renderCell: (r) => (r.case_id ? <AppLink href={`/immigration/cases/${r.case_id}`}>{r.case_human_id ?? "Open case"}</AppLink> : "None"),
    }),
  ];
  return (
    <>
      <div className={styles.headerRow}>
        <PageHeader title="Immigration" subtitle="Open cases, upcoming key dates and workers abroad without a valid permit" />
        <div className={styles.actions}>
          <Button appearance="primary" onClick={() => router.push("/immigration/cases")}>
            All cases
          </Button>
          {canConfigure && (
            <Button icon={<Settings20Regular />} onClick={() => router.push("/settings/immigration")}>
              Visa types &amp; counsel
            </Button>
          )}
        </div>
      </div>
      {dash.isPending ? (
        <GridSkeleton rows={3} />
      ) : dash.isError ? (
        <ErrorBar title="Could not load the dashboard." message={errorMessage(dash.error)} />
      ) : (
        <>
          <div className={styles.tiles}>
            {dash.data.tiles.map((t) => (
              <NextLink key={t.key} href={casesHref(t.filters)} className={styles.tileLink} aria-label={`${t.label}: ${t.count}. Open the case list`}>
                <Card className={styles.tile}>
                  <Caption1>{t.label}</Caption1>
                  <Text className={styles.value}>{t.count}</Text>
                </Card>
              </NextLink>
            ))}
          </div>
          <div className={styles.columns}>
            <Card className={styles.section}>
              <Subtitle2 as="h2">Open cases by stage</Subtitle2>
              <Bars
                label="Open cases by stage"
                rows={dash.data.by_stage.map((s) => ({
                  key: `${s.category}:${s.stage_key ?? ""}`,
                  label: `${STAGE_CATEGORY_LABELS[s.category as StageCategory] ?? s.category} · ${s.stage_label}`,
                  count: s.count,
                  href: casesHref(s.stage_key ? { stage: s.stage_key } : {}),
                }))}
              />
            </Card>
            <Card className={styles.section}>
              <Subtitle2 as="h2">Open cases by country</Subtitle2>
              <Bars
                label="Open cases by country"
                rows={dash.data.by_country.map((c) => ({ key: c.country, label: countryName(c.country), count: c.count, href: casesHref({ country: c.country }) }))}
              />
            </Card>
          </div>
        </>
      )}
      <Subtitle2 as="h2">Abroad without a valid permit</Subtitle2>
      <Body1 className={styles.muted}>Active placements in a country that needs a permit, with no valid permit or credential on file.</Body1>
      <AdminGrid
        items={atRisk.data}
        columns={riskColumns}
        getRowId={(r) => r.placement_id}
        loading={atRisk.isPending}
        error={atRisk.error}
        emptyText="No workers abroad without a valid permit."
        label="Workers abroad without a valid permit"
      />
    </>
  );
}
