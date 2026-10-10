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
  TableCellLayout,
  type TableColumnDefinition,
  Text,
  Tooltip,
} from "@fluentui/react-components";
import { ArrowDownload16Regular } from "@fluentui/react-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { downloadApiFile } from "@/lib/api/download";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { ExportOut, ExportStatus } from "@/lib/api/types";
import { exportKeys, exportsApi, fallbackFilename } from "./api";

export const POLL_MS = 10_000;

const STATUS_BADGE: Record<ExportStatus, { label: string; color: "informative" | "brand" | "success" | "danger" | "subtle" }> = {
  queued: { label: "Queued", color: "informative" },
  running: { label: "Running", color: "brand" },
  done: { label: "Ready", color: "success" },
  failed: { label: "Failed", color: "danger" },
  expired: { label: "Expired", color: "subtle" },
};

const KIND_LABELS: Record<string, string> = {
  candidates: "Candidates",
  demands: "Demands",
  applications: "Applications",
  submissions: "Submissions",
  interviews: "Interviews",
  offers: "Offers",
};

/** Poll while any export on the page is still being produced. */
export function exportsPollInterval(items: readonly Pick<ExportOut, "status">[] | undefined): number | false {
  return items?.some((e) => e.status === "queued" || e.status === "running") ? POLL_MS : false;
}

export function isExpired(e: Pick<ExportOut, "status" | "expires_at">, now = Date.now()): boolean {
  return e.status === "expired" || (!!e.expires_at && new Date(e.expires_at).getTime() <= now);
}

/** Only finished async exports have a file; sync exports were downloaded when requested. */
export function canDownload(e: Pick<ExportOut, "status" | "mode" | "expires_at">, now = Date.now()): boolean {
  return e.status === "done" && e.mode === "async" && !isExpired(e, now);
}

const ERROR_LABELS: Record<string, string> = {
  forbidden: "You no longer have access to this data.",
  export_too_large: "Too many rows.",
};

/** `/exports`: the signed-in user's exports, newest first, with download for finished large exports. */
export function ExportsPage() {
  const styles = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canExport = usePermission("report:export");
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState<string | null>(null);
  const list = useQuery({
    queryKey: exportKeys.list(page),
    queryFn: ({ signal }) => exportsApi.list(page, DEFAULT_PAGE_SIZE, signal),
    enabled: canExport,
    refetchInterval: (q) => exportsPollInterval(q.state.data?.items),
    placeholderData: (prev) => prev,
  });

  if (!canExport) return <NoAccess what="exports" />;

  const download = async (e: ExportOut) => {
    setDownloading(e.id);
    try {
      await downloadApiFile(exportsApi.downloadPath(e.id), fallbackFilename(e.kind, e.format, new Date(e.created_at)));
      void queryClient.invalidateQueries({ queryKey: exportKeys.all });
    } catch (err) {
      if (isApiError(err) && err.status === 410) toast.error("This export has expired. Run it again from the list.");
      else toast.error(errorMessage(err, "The download failed. Please try again."));
    } finally {
      setDownloading(null);
    }
  };

  const columns: TableColumnDefinition<ExportOut>[] = [
    createTableColumn({
      columnId: "kind",
      renderHeaderCell: () => "Export",
      renderCell: (e) => <TableCellLayout>{KIND_LABELS[e.kind] ?? e.kind}</TableCellLayout>,
    }),
    createTableColumn({
      columnId: "format",
      renderHeaderCell: () => "Format",
      renderCell: (e) => e.format.toUpperCase(),
    }),
    createTableColumn({
      columnId: "rows",
      renderHeaderCell: () => "Rows",
      renderCell: (e) => (e.row_count === null ? "—" : e.row_count.toLocaleString()),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (e) => {
        const status: ExportStatus = isExpired(e) && e.status === "done" ? "expired" : e.status;
        const b = STATUS_BADGE[status];
        const badge = (
          <Badge appearance="tint" color={b.color}>
            {b.label}
          </Badge>
        );
        return e.status === "failed" && e.error_code ? (
          <Tooltip content={ERROR_LABELS[e.error_code] ?? e.error_code} relationship="description">
            {badge}
          </Tooltip>
        ) : (
          badge
        );
      },
    }),
    createTableColumn({
      columnId: "requested",
      renderHeaderCell: () => "Requested",
      renderCell: (e) => formatDateTime(e.created_at),
    }),
    createTableColumn({
      columnId: "expires",
      renderHeaderCell: () => "Expires",
      renderCell: (e) => (e.mode === "sync" ? "—" : e.expires_at ? formatDateTime(e.expires_at) : "—"),
    }),
    createTableColumn({
      columnId: "download",
      renderHeaderCell: () => "",
      renderCell: (e) =>
        canDownload(e) ? (
          <Button
            size="small"
            icon={<ArrowDownload16Regular />}
            disabled={downloading === e.id}
            onClick={() => void download(e)}
            aria-label={`Download ${KIND_LABELS[e.kind] ?? e.kind} export`}
          >
            Download
          </Button>
        ) : e.mode === "sync" && e.status === "done" ? (
          <Text size={200} className={styles.muted}>
            Downloaded directly
          </Text>
        ) : null,
    }),
  ];

  const items = list.data?.items;
  return (
    <>
      <PageHeader title="My exports" subtitle="Large exports are prepared in the background and kept for 24 hours." />
      {list.error && !items ? (
        <ErrorBar title="Could not load exports." message={errorMessage(list.error)} />
      ) : (
        <div className={styles.surface}>
          {list.isPending && !items ? (
            <GridSkeleton />
          ) : (
            <DataGrid items={items ?? []} columns={columns} getRowId={(e) => e.id} aria-label="My exports" className={styles.grid}>
              <DataGridHeader>
                <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
              </DataGridHeader>
              <DataGridBody<ExportOut>>
                {({ item, rowId }) => (
                  <DataGridRow<ExportOut> key={rowId} style={isExpired(item) ? { opacity: 0.55 } : undefined}>
                    {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                  </DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
          )}
          {items && items.length === 0 && <div className={styles.empty}>No exports yet. Use Export on a list to create one.</div>}
          {list.data && (
            <PagingBar page={page} pageSize={DEFAULT_PAGE_SIZE} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />
          )}
        </div>
      )}
    </>
  );
}
