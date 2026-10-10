"use client";

import {
  Badge,
  Body1,
  Caption1,
  Card,
  CardHeader,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Link,
  makeStyles,
  Subtitle2,
  Text,
  tokens,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { complianceApi, complianceKeys } from "./api";
import { formatDate, ITEM_KIND_LABELS, maskedNumber } from "./logic";
import type { DashboardCredentialRow, DashboardPlacementRow, ItemKind } from "./types";

const useStyles = makeStyles({
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalL },
  kpi: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  value: { fontSize: tokens.fontSizeHero800, lineHeight: tokens.lineHeightHero800, fontWeight: tokens.fontWeightSemibold },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalXL },
  bars: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  bar: { display: "grid", gridTemplateColumns: "180px 1fr 40px", alignItems: "center", gap: tokens.spacingHorizontalS },
  track: { height: "8px", backgroundColor: tokens.colorNeutralBackground5, borderRadius: tokens.borderRadiusSmall, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: tokens.colorBrandBackground },
});

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const s = useStyles();
  return (
    <Card className={s.kpi}>
      <Caption1>{label}</Caption1>
      <Text className={s.value}>{value}</Text>
      {hint && <Caption1>{hint}</Caption1>}
    </Card>
  );
}

const placementColumns: TableColumnDefinition<DashboardPlacementRow>[] = [
  createTableColumn({
    columnId: "placement",
    renderHeaderCell: () => "Placement",
    renderCell: (r) => (
      <Link as="a" href={`/placements/${r.placement_id}?tab=compliance`}>
        {r.human_id}
      </Link>
    ),
  }),
  createTableColumn({ columnId: "worker", renderHeaderCell: () => "Worker", renderCell: (r) => r.candidate_name ?? "—" }),
  createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (r) => r.client_name ?? "—" }),
  createTableColumn({
    columnId: "state",
    renderHeaderCell: () => "Compliance",
    renderCell: (r) => (
      <Badge appearance="tint" color={r.blocking ? "danger" : "warning"}>
        {r.blocking ? "Blocking" : "Non-compliant"}
      </Badge>
    ),
  }),
  createTableColumn({ columnId: "missing", renderHeaderCell: () => "Missing", renderCell: (r) => r.missing }),
  createTableColumn({ columnId: "expired", renderHeaderCell: () => "Expired", renderCell: (r) => r.expired }),
];

const credentialColumns: TableColumnDefinition<DashboardCredentialRow>[] = [
  createTableColumn({ columnId: "type", renderHeaderCell: () => "Credential", renderCell: (r) => r.type_label }),
  createTableColumn({
    columnId: "worker",
    renderHeaderCell: () => "Worker",
    renderCell: (r) => <NextLink href={`/workers/${r.candidate_id}`}>{r.candidate_name ?? "Worker"}</NextLink>,
  }),
  createTableColumn({ columnId: "number", renderHeaderCell: () => "Number", renderCell: (r) => maskedNumber(r.number_last4) }),
  createTableColumn({ columnId: "expires", renderHeaderCell: () => "Expires", renderCell: (r) => formatDate(r.expires_on) }),
  createTableColumn({
    columnId: "left",
    renderHeaderCell: () => "Days left",
    renderCell: (r) => (
      <Badge appearance="tint" color={(r.days_left ?? 0) < 0 ? "danger" : (r.days_left ?? 0) <= 30 ? "warning" : "informative"}>
        {(r.days_left ?? 0) < 0 ? "Expired" : `${r.days_left} days`}
      </Badge>
    ),
  }),
];

/** BGV "open cases by age" tile, composed from the BGV list API; hidden when that API is unavailable. */
function BgvAgingTile() {
  const s = useStyles();
  const q = useQuery({
    queryKey: ["compliance", "bgv-aging"],
    queryFn: async ({ signal }) => {
      const cases = await api.get<{ created_at?: string; status?: string }[]>("/api/v1/bgv-cases", { signal });
      const now = Date.now();
      const buckets: Record<string, number> = { "0–7 days": 0, "8–14 days": 0, "15–30 days": 0, "30+ days": 0 };
      for (const c of Array.isArray(cases) ? cases : []) {
        if (c.status && ["clear", "failed", "cancelled"].includes(c.status)) continue;
        const age = c.created_at ? (now - new Date(c.created_at).getTime()) / 86_400_000 : 0;
        const key = age <= 7 ? "0–7 days" : age <= 14 ? "8–14 days" : age <= 30 ? "15–30 days" : "30+ days";
        buckets[key] += 1;
      }
      return buckets;
    },
    retry: false,
  });
  if (!q.data) return null;
  const buckets = q.data;
  const max = Math.max(1, ...Object.values(buckets));
  return (
    <Card className={s.section}>
      <CardHeader header={<Subtitle2>Open BGV cases by age</Subtitle2>} />
      <div className={s.bars} role="list">
        {Object.entries(buckets).map(([label, n]) => (
          <div key={label} className={s.bar} role="listitem" aria-label={`${label}: ${n}`}>
            <Caption1>{label}</Caption1>
            <div className={s.track}>
              <div className={s.fill} style={{ width: `${(n / max) * 100}%` }} />
            </div>
            <Caption1>{n}</Caption1>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** `/compliance`: KPI cards, non-compliant placements, expiring credentials, missing items and BGV aging. */
export function ComplianceDashboardView() {
  const s = useStyles();
  const canRead = usePermission("compliance:read");
  const q = useQuery({ queryKey: complianceKeys.dashboard({}), queryFn: ({ signal }) => complianceApi.dashboard({}, signal), enabled: canRead });
  if (!canRead) return <NoAccess what="the compliance dashboard" />;
  return (
    <>
      <PageHeader title="Compliance" subtitle="Placements missing credentials, documents or acknowledgements, and credentials about to expire." />
      {q.isError && <ErrorBar message={errorMessage(q.error)} />}
      {q.isPending ? (
        <GridSkeleton />
      ) : q.data ? (
        <>
          <div className={s.kpis}>
            <Kpi label="Non-compliant placements" value={q.data.non_compliant} hint={`${q.data.retroactive_only} from new requirements only`} />
            <Kpi label="Blocking" value={q.data.blocking} hint="Extensions wait for these" />
            <Kpi label="Expiring in 30 days" value={q.data.expiring_30} />
            <Kpi label="Expiring in 31–60 days" value={q.data.expiring_60} />
          </div>
          <section className={s.section} aria-label="Missing mandatory items">
            <Subtitle2>Missing mandatory items</Subtitle2>
            <Body1>
              {Object.entries(q.data.missing_by_kind)
                .map(([k, n]) => `${ITEM_KIND_LABELS[k as ItemKind] ?? k}: ${n}`)
                .join(" · ")}
            </Body1>
          </section>
          <section className={s.section} aria-label="Non-compliant placements">
            <Subtitle2>Non-compliant placements</Subtitle2>
            {q.data.top_non_compliant.length === 0 ? (
              <Body1>Every open placement is compliant.</Body1>
            ) : (
              <DataGrid items={q.data.top_non_compliant} columns={placementColumns} getRowId={(r) => r.placement_id}>
                <DataGridHeader>
                  <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
                </DataGridHeader>
                <DataGridBody<DashboardPlacementRow>>
                  {({ item, rowId }) => (
                    <DataGridRow<DashboardPlacementRow> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
                  )}
                </DataGridBody>
              </DataGrid>
            )}
          </section>
          <section className={s.section} aria-label="Expiring credentials">
            <Subtitle2>Expiring credentials (60 days)</Subtitle2>
            {q.data.expiring.length === 0 ? (
              <Body1>No credential expires in the next 60 days.</Body1>
            ) : (
              <DataGrid items={q.data.expiring} columns={credentialColumns} getRowId={(r) => r.credential_id}>
                <DataGridHeader>
                  <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
                </DataGridHeader>
                <DataGridBody<DashboardCredentialRow>>
                  {({ item, rowId }) => (
                    <DataGridRow<DashboardCredentialRow> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
                  )}
                </DataGridBody>
              </DataGrid>
            )}
          </section>
          <BgvAgingTile />
        </>
      ) : null}
    </>
  );
}
