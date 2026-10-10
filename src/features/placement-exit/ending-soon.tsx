"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dropdown,
  Field,
  makeStyles,
  Option,
  Subtitle2,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { formatDate } from "@/features/placements/format";
import { exitApi, exitKeys } from "./api";
import { ProposeExtensionDrawer } from "./extension-dialogs";
import { ConversionDialog, StartOffboardingDialog } from "./exit-dialogs";
import { daysLeftColor, daysLeftLabel, exitErrorMessage } from "./logic";
import type { EndingSoonRow } from "./types";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  list: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalS },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
});

/** Dashboard card: placements ending within 60 days (top 5). */
export function EndingSoonCard({ withinDays = 60 }: { withinDays?: number }) {
  const styles = useStyles();
  const canRead = usePermission("placement:read");
  const q = useQuery({
    queryKey: exitKeys.endingSoon(withinDays),
    queryFn: ({ signal }) => exitApi.endingSoon(withinDays, signal),
    enabled: canRead,
  });
  if (!canRead) return null;
  const rows = q.data ?? [];
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2>Ending soon</Subtitle2>}
        description={<Text size={200}>Placements ending within {withinDays} days</Text>}
        action={<NextLink href="/placements/ending-soon">View all ({rows.length})</NextLink>}
      />
      {q.isError && <ErrorBar message={exitErrorMessage(q.error)} />}
      {rows.length === 0 && !q.isPending ? (
        <Body1>Nothing ending soon.</Body1>
      ) : (
        <ul className={styles.list}>
          {rows.slice(0, 5).map((r) => (
            <li key={r.placement_id} className={styles.row}>
              <NextLink href={`/placements/${r.placement_id}`}>
                {r.human_id} · {r.candidate_name ?? "Worker"}
              </NextLink>
              <Badge appearance="tint" color={daysLeftColor(r.days_left)}>
                {daysLeftLabel(r.days_left)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

type Action = { kind: "extend" | "offboard" | "convert"; row: EndingSoonRow } | null;

/** `/placements/ending-soon`: DataGrid of placements nearing their end date, with quick actions. */
export function EndingSoonView() {
  const admin = useAdminStyles();
  const styles = useStyles();
  const canRead = usePermission("placement:read");
  const canExtend = usePermission("extension:write");
  const canOffboard = usePermission("offboarding:write");
  const canConvert = usePermission("conversion:write");
  const [within, setWithin] = useState(60);
  const [action, setAction] = useState<Action>(null);
  const q = useQuery({ queryKey: exitKeys.endingSoon(within), queryFn: ({ signal }) => exitApi.endingSoon(within, signal), enabled: canRead });
  if (!canRead) return <NoAccess what="placements" />;

  const columns: TableColumnDefinition<EndingSoonRow>[] = [
    createTableColumn({
      columnId: "placement",
      renderHeaderCell: () => "Placement",
      renderCell: (r) => (
        <div className={admin.cellStack}>
          <NextLink href={`/placements/${r.placement_id}`}>{r.human_id}</NextLink>
          <Text size={200} className={admin.muted}>
            {r.candidate_name ?? "Worker"}
          </Text>
        </div>
      ),
    }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (r) => r.client_name ?? "—" }),
    createTableColumn({ columnId: "role", renderHeaderCell: () => "Role", renderCell: (r) => r.role_title ?? "—" }),
    createTableColumn({ columnId: "end", renderHeaderCell: () => "End date", renderCell: (r) => formatDate(r.end_date) }),
    createTableColumn({
      columnId: "days",
      renderHeaderCell: () => "Days left",
      renderCell: (r) => (
        <Badge appearance="filled" color={daysLeftColor(r.days_left)}>
          {daysLeftLabel(r.days_left)}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (r) => (
        <div className={styles.actions}>
          {r.open_case_id ? (
            <NextLink href={`/offboarding/${r.open_case_id}`}>Offboarding case</NextLink>
          ) : (
            <>
              {r.open_extension_id ? (
                <NextLink href={`/placements/${r.placement_id}`}>Extension open</NextLink>
              ) : (
                canExtend && (
                  <Button size="small" appearance="primary" onClick={() => setAction({ kind: "extend", row: r })}>
                    Propose extension
                  </Button>
                )
              )}
              {canOffboard && (
                <Button size="small" onClick={() => setAction({ kind: "offboard", row: r })}>
                  Start offboarding
                </Button>
              )}
              {canConvert && (
                <Button size="small" onClick={() => setAction({ kind: "convert", row: r })}>
                  Record conversion
                </Button>
              )}
            </>
          )}
        </div>
      ),
    }),
  ];

  return (
    <>
      <PageHeader title="Ending soon" subtitle="Active placements approaching their end date." />
      <div className={admin.toolbar}>
        <Field label="Ending within" className={admin.filter}>
          <Dropdown
            value={`${within} days`}
            selectedOptions={[String(within)]}
            onOptionSelect={(_, d) => setWithin(Number(d.optionValue ?? 60))}
          >
            {[15, 30, 60, 90].map((n) => (
              <Option key={n} value={String(n)}>{`${n} days`}</Option>
            ))}
          </Dropdown>
        </Field>
      </div>
      {q.isError && <ErrorBar message={exitErrorMessage(q.error)} />}
      {q.isPending ? (
        <GridSkeleton />
      ) : (q.data ?? []).length === 0 ? (
        <div className={admin.empty}>No placements end within {within} days.</div>
      ) : (
        <div className={admin.surface}>
          <DataGrid items={q.data ?? []} columns={columns} getRowId={(r: EndingSoonRow) => r.placement_id} className={admin.grid}>
            <DataGridHeader>
              <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
            </DataGridHeader>
            <DataGridBody<EndingSoonRow>>
              {({ item, rowId }) => (
                <DataGridRow<EndingSoonRow> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        </div>
      )}
      {action?.kind === "extend" && (
        <ProposeExtensionDrawer placementId={action.row.placement_id} currentEndDate={action.row.end_date} onClose={() => setAction(null)} />
      )}
      {action?.kind === "offboard" && (
        <StartOffboardingDialog placementId={action.row.placement_id} defaultLwd={action.row.end_date} onClose={() => setAction(null)} />
      )}
      {action?.kind === "convert" && (
        <ConversionDialog placementId={action.row.placement_id} currency="INR" onClose={() => setAction(null)} />
      )}
    </>
  );
}
