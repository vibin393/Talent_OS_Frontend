"use client";

import {
  Badge,
  Card,
  CardHeader,
  createTableColumn,
  Field,
  makeStyles,
  ProgressBar,
  Subtitle2,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { ErrorBar, formatDateTime, GridSkeleton, IdSelect, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { ImportItemOut, ImportItemStatus } from "@/lib/api/types";
import { candidateKeys, candidatesApi, fileDownloadUrl } from "./api";
import { candidateErrorMessage } from "./errors";
import { IMPORT_ITEM_STATUS } from "./format";
import { importProgress } from "./import-validation";
import { BatchStatusBadge, StatusCounts } from "./import-view";

const REASONS: Record<string, string> = {
  parse_unavailable: "AI parsing unavailable",
  image_only: "Scanned PDF (no text layer)",
  encrypted: "Password-protected PDF",
  failed: "Could not read the file",
  unsupported_file_type: "Unsupported file type",
  file_too_large: "Larger than 10 MB",
  file_infected: "Failed the virus scan",
  scan_unavailable: "Virus scanner unavailable",
};

const useStyles = makeStyles({
  summary: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, marginBottom: tokens.spacingVerticalL },
});

/** Import batch: progress, per-status counts and items (polls every 2 s until completed). */
export function ImportDetail({ id }: { id: string }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const canCreate = usePermission("candidate:create");
  const [status, setStatus] = useState<ImportItemStatus | null>(null);
  const [page, setPage] = useState(1);

  const batch = useQuery({
    queryKey: candidateKeys.import(id, status, page),
    queryFn: ({ signal }) => candidatesApi.getImport(id, status, page, DEFAULT_PAGE_SIZE, signal),
    enabled: canCreate,
    placeholderData: (prev) => prev,
    refetchInterval: (q) => (q.state.data && q.state.data.status !== "completed" ? 2000 : false),
  });

  if (!canCreate) return <NoAccess what="candidate imports" />;
  if (batch.isPending) return <GridSkeleton rows={6} />;
  if (batch.isError) return <ErrorBar title="Could not load the import." message={candidateErrorMessage(batch.error)} />;
  const b = batch.data;
  const progress = importProgress(b.total, b.counts);

  const columns: TableColumnDefinition<ImportItemOut>[] = [
    createTableColumn<ImportItemOut>({
      columnId: "file",
      renderHeaderCell: () => "File",
      renderCell: (it) => <span className={admin.truncate}>{it.filename}</span>,
    }),
    createTableColumn<ImportItemOut>({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (it) => (
        <Badge appearance="tint" color={IMPORT_ITEM_STATUS[it.status].color}>
          {IMPORT_ITEM_STATUS[it.status].label}
        </Badge>
      ),
    }),
    createTableColumn<ImportItemOut>({
      columnId: "reason",
      renderHeaderCell: () => "Reason",
      renderCell: (it) => (it.reason ? REASONS[it.reason] ?? it.reason : "—"),
    }),
    createTableColumn<ImportItemOut>({
      columnId: "result",
      renderHeaderCell: () => "Result",
      renderCell: (it) => (
        <div className={admin.cellStack}>
          {it.candidate_id && <AppLink href={`/candidates/${it.candidate_id}`}>Open candidate</AppLink>}
          {it.duplicate_id && <AppLink href={`/candidates/duplicates/${it.duplicate_id}`}>Review duplicate</AppLink>}
          {it.status === "failed" && (
            <>
              <AppLink href="/candidates/new">Create manually</AppLink>
              {it.file_id && (
                <a href={fileDownloadUrl(it.file_id)} download>
                  Download file
                </a>
              )}
            </>
          )}
          {!it.candidate_id && !it.duplicate_id && it.status !== "failed" && "—"}
        </div>
      ),
    }),
    createTableColumn<ImportItemOut>({
      columnId: "updated",
      renderHeaderCell: () => "Updated",
      renderCell: (it) => formatDateTime(it.updated_at),
    }),
  ];

  const statusOptions = (Object.keys(IMPORT_ITEM_STATUS) as ImportItemStatus[]).map((s) => ({
    id: s,
    label: `${IMPORT_ITEM_STATUS[s].label} (${b.counts[s] ?? 0})`,
  }));

  return (
    <>
      <PageHeader
        title="Import"
        subtitle={
          <>
            Started {formatDateTime(b.created_at)} · <AppLink href="/candidates/imports">All imports</AppLink>
          </>
        }
      />
      <Card className={styles.summary}>
        <CardHeader
          header={
            <Subtitle2 as="h2">
              {b.total} file{b.total === 1 ? "" : "s"} <BatchStatusBadge status={b.status} />
            </Subtitle2>
          }
          description={b.completed_at ? <Text>Completed {formatDateTime(b.completed_at)}</Text> : <Text>Processing… this page updates automatically.</Text>}
        />
        <Field
          validationMessage={`${Math.round(progress * 100)}% processed`}
          validationState="none"
          label="Progress"
        >
          <ProgressBar value={progress} max={1} thickness="large" color={b.status === "completed" ? "success" : "brand"} />
        </Field>
        <StatusCounts counts={b.counts} />
      </Card>
      <div className={admin.toolbar}>
        <IdSelect
          className={admin.filter}
          label="Status"
          noneLabel="All items"
          options={statusOptions}
          value={status}
          onChange={(v) => {
            setStatus(v as ImportItemStatus | null);
            setPage(1);
          }}
        />
      </div>
      <AdminGrid
        label="Import items"
        items={b.items.items}
        columns={columns}
        getRowId={(it) => it.id}
        loading={false}
        error={null}
        emptyText="No items."
        columnSizing={{ file: { minWidth: 220, idealWidth: 300 }, reason: { minWidth: 180 } }}
        footer={
          <PagingBar page={page} pageSize={DEFAULT_PAGE_SIZE} total={b.items.total} onPageChange={setPage} busy={batch.isFetching} />
        }
      />
    </>
  );
}
