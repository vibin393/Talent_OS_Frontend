"use client";

import {
  Badge,
  Button,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dropdown,
  Field,
  Input,
  Option,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { ArrowUpload20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DetailsDrawer, ErrorBar, formatDateTime, GridSkeleton, useAdminStyles } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { LegalEntitySelect } from "../components";
import { errorMessage } from "@/lib/api/errors";
import { tdsReconApi, tdsReconKeys, type TdsFilters } from "./api";
import { currentQuarter, isValidFy, QUARTERS, RUN_STATUS_COLOR, tdsErrorMessage } from "./logic";
import type { Quarter, StatementKind, TdsRun } from "./types";

/** Statement runs for the selected Legal Entity / FY / quarter, with the "Upload statement" drawer. */
export function TdsRunsView({ filters }: { filters: TdsFilters }) {
  const admin = useAdminStyles();
  const router = useRouter();
  const perms = usePermissions();
  const canWrite = hasAnyPermission(perms, ["tds_recon:write"]);
  const [uploading, setUploading] = useState(false);
  const q = useQuery({
    queryKey: tdsReconKeys.runs(filters),
    queryFn: ({ signal }) => tdsReconApi.runs(filters, signal),
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === "parsing") ? 5_000 : false),
  });
  const open = (id: string) => router.push(`/finance/tds-reconciliation/${id}`);
  const columns: TableColumnDefinition<TdsRun>[] = [
    createTableColumn({ columnId: "period", renderHeaderCell: () => "Period", renderCell: (r) => `FY ${r.fy} ${r.quarter}` }),
    createTableColumn({
      columnId: "kind",
      renderHeaderCell: () => "Statement",
      renderCell: (r) => `${r.statement_kind === "ais" ? "AIS" : "26AS"} · ${r.source === "connector" ? "Connector" : "Upload"}`,
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <Badge appearance="tint" color={RUN_STATUS_COLOR[r.status] ?? "informative"} title={r.error ?? undefined}>
          {r.status}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "lines", renderHeaderCell: () => "Lines", renderCell: (r) => r.line_count }),
    createTableColumn({
      columnId: "progress",
      renderHeaderCell: () => "Matches",
      renderCell: (r) => (
        <span className={admin.badges}>
          <Badge appearance="tint" color="success">{r.confirmed} confirmed</Badge>
          <Badge appearance="tint" color="warning">{r.proposed} proposed</Badge>
          <Badge appearance="tint" color="informative">{r.unmatched} unmatched</Badge>
        </span>
      ),
    }),
    createTableColumn({ columnId: "created", renderHeaderCell: () => "Uploaded", renderCell: (r) => formatDateTime(r.created_at) }),
  ];
  return (
    <>
      <div className={admin.toolbar}>
        <div className={admin.grow} />
        {canWrite && (
          <Button appearance="primary" icon={<ArrowUpload20Regular />} onClick={() => setUploading(true)}>
            Upload statement
          </Button>
        )}
      </div>
      <ErrorBar message={q.error ? errorMessage(q.error) : null} />
      <div className={admin.surface}>
        {!q.data ? (
          <GridSkeleton />
        ) : q.data.length === 0 ? (
          <div className={admin.empty}>No statements uploaded for this period.</div>
        ) : (
          <DataGrid items={q.data} columns={columns} getRowId={(r) => r.id} aria-label="Statement runs" className={admin.grid} focusMode="composite">
            <DataGridHeader>
              <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
            </DataGridHeader>
            <DataGridBody<TdsRun>>
              {({ item, rowId }) => (
                <DataGridRow<TdsRun>
                  key={rowId}
                  style={{ cursor: "pointer" }}
                  onClick={() => open(item.id)}
                  onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && open(item.id)}
                >
                  {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                </DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        )}
      </div>
      {uploading && <UploadDrawer filters={filters} onClose={() => setUploading(false)} />}
    </>
  );
}

function UploadDrawer({ filters, onClose }: { filters: TdsFilters; onClose: () => void }) {
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const [le, setLe] = useState<string | null>(filters.legal_entity_id ?? null);
  const [fy, setFy] = useState(filters.fy ?? "");
  const [quarter, setQuarter] = useState<Quarter>((filters.quarter as Quarter | undefined) ?? currentQuarter());
  const [kind, setKind] = useState<StatementKind>("26as");
  const [file, setFile] = useState<File | null>(null);
  const fyOk = isValidFy(fy);
  const m = useMutation({
    mutationFn: () => tdsReconApi.upload({ legal_entity_id: le!, fy: fy.trim(), quarter, statement_kind: kind, file }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: tdsReconKeys.all });
      onClose();
    },
  });
  return (
    <DetailsDrawer
      open
      title="Upload statement"
      onClose={onClose}
      footer={
        <>
          <Button appearance="primary" disabled={!le || !fyOk || m.isPending} onClick={() => m.mutate()}>
            Upload
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </>
      }
    >
      <div className={admin.form}>
        <LegalEntitySelect value={le} onChange={setLe} />
        <Field
          label="Financial year"
          required
          validationState={fy && !fyOk ? "error" : "none"}
          validationMessage={fy && !fyOk ? "Use the format 2026-27." : undefined}
        >
          <Input value={fy} placeholder="2026-27" onChange={(_, d) => setFy(d.value)} />
        </Field>
        <Field label="Quarter" required>
          <Dropdown value={quarter} selectedOptions={[quarter]} onOptionSelect={(_, d) => d.optionValue && setQuarter(d.optionValue as Quarter)}>
            {QUARTERS.map((qq) => (
              <Option key={qq} value={qq}>
                {qq}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Statement">
          <Dropdown
            value={kind === "ais" ? "AIS" : "Form 26AS"}
            selectedOptions={[kind]}
            onOptionSelect={(_, d) => d.optionValue && setKind(d.optionValue as StatementKind)}
          >
            <Option value="26as">Form 26AS</Option>
            <Option value="ais">AIS</Option>
          </Dropdown>
        </Field>
        <Field label="Statement file" hint="TRACES text / CSV export. Optional when a statement connector is configured.">
          <input type="file" accept=".txt,.csv,.pdf,.json,text/plain,text/csv,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <ErrorBar message={m.error ? tdsErrorMessage(m.error) : null} />
      </div>
    </DetailsDrawer>
  );
}
