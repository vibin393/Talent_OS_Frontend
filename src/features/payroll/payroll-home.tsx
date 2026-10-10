"use client";

import {
  Badge,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dropdown,
  Field,
  Option,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { legalEntitiesApi, legalEntityKeys } from "@/features/legal-entities/api";
import { errorMessage } from "@/lib/api/errors";
import { formatDate, periodStatusLabel } from "./format";
import type { PayPeriodOut } from "./types";
import { usePayPeriods } from "./use-pay-periods";

/** `/payroll`: pay periods per Legal Entity (status, final / supplementary count, processed state). */
export function PayrollHome() {
  const admin = useAdminStyles();
  const router = useRouter();
  const canRead = usePermission("payroll:read");
  const entities = useQuery({ queryKey: legalEntityKeys.list, queryFn: ({ signal }) => legalEntitiesApi.list(signal), enabled: canRead });
  const [picked, setPicked] = useState<string | null>(null);
  const le = picked ?? entities.data?.[0]?.id ?? null;
  const periods = usePayPeriods(le, canRead && !!le);
  if (!canRead) return <NoAccess what="payroll" />;
  const leName = entities.data?.find((e) => e.id === le)?.name ?? "";

  const columns: TableColumnDefinition<PayPeriodOut>[] = [
    createTableColumn({
      columnId: "period",
      renderHeaderCell: () => "Period",
      renderCell: (p) => (
        <span className={admin.cellStack}>
          <span>{`${formatDate(p.period_start)} – ${formatDate(p.period_end)}`}</span>
          <span className={admin.muted}>{p.human_id}</span>
        </span>
      ),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (p) => (
        <Badge appearance="tint" color={p.status === "locked" ? "brand" : "informative"}>
          {periodStatusLabel(p.status)}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "final", renderHeaderCell: () => "Final", renderCell: (p) => (p.final_count ? "Yes" : "—") }),
    createTableColumn({
      columnId: "supp",
      renderHeaderCell: () => "Supplementary",
      renderCell: (p) => (p.supplementary_count ? String(p.supplementary_count) : "—"),
    }),
    createTableColumn({
      columnId: "processed",
      renderHeaderCell: () => "Processed",
      renderCell: (p) =>
        p.processed ? (
          <Badge appearance="tint" color="success">
            Processed
          </Badge>
        ) : (
          "—"
        ),
    }),
  ];

  const open = (id: string) => router.push(`/payroll/periods/${encodeURIComponent(id)}`);

  return (
    <>
      <PageHeader title="Payroll" subtitle="Pay periods, payroll export previews, finalized files and processing status" />
      <div className={admin.toolbar}>
        <Field label="Legal entity" className={admin.filter}>
          <Dropdown
            placeholder="Choose a legal entity"
            selectedOptions={le ? [le] : []}
            value={leName}
            onOptionSelect={(_, d) => setPicked(d.optionValue ?? null)}
          >
            {(entities.data ?? []).map((e) => (
              <Option key={e.id} value={e.id}>
                {e.name}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>
      {periods.error && !periods.data ? (
        <ErrorBar title="Could not load pay periods." message={errorMessage(periods.error)} />
      ) : (
        <div className={admin.surface}>
          {!periods.data ? (
            <GridSkeleton />
          ) : periods.data.length === 0 ? (
            <div className={admin.empty}>No pay periods yet. Set up the pay calendar under Administration → Payroll.</div>
          ) : (
            <DataGrid items={periods.data} columns={columns} getRowId={(p) => p.id} aria-label="Pay periods" className={admin.grid} focusMode="composite">
              <DataGridHeader>
                <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
              </DataGridHeader>
              <DataGridBody<PayPeriodOut>>
                {({ item, rowId }) => (
                  <DataGridRow<PayPeriodOut>
                    key={rowId}
                    style={{ cursor: "pointer" }}
                    onClick={() => open(item.id)}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter") open(item.id);
                    }}
                  >
                    {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                  </DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
          )}
        </div>
      )}
    </>
  );
}
