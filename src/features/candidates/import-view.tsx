"use client";

import {
  Badge,
  Button,
  Caption1,
  Card,
  createTableColumn,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { ErrorBar, formatDateTime, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { ImportBatchOut, ImportItemStatus } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { candidateErrorMessage } from "./errors";
import { FileDrop } from "./file-drop";
import { formatBytes, IMPORT_ITEM_STATUS } from "./format";
import { type ImportCheck, validateImportFiles } from "./import-validation";
import { useCandidateMutation } from "./use-candidates";

const useStyles = makeStyles({
  selection: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: tokens.spacingHorizontalL },
  actions: { display: "flex", gap: tokens.spacingHorizontalS },
  list: { margin: 0, paddingLeft: tokens.spacingHorizontalL, maxHeight: "160px", overflow: "auto" },
});

export function BatchStatusBadge({ status }: { status: ImportBatchOut["status"] }) {
  const color = status === "completed" ? "success" : status === "processing" ? "informative" : "subtle";
  const label = status === "completed" ? "Completed" : status === "processing" ? "Processing" : "Queued";
  return (
    <Badge appearance="tint" color={color}>
      {label}
    </Badge>
  );
}

export function StatusCounts({ counts }: { counts: Record<string, number> }) {
  const styles = useAdminStyles();
  const entries = (Object.keys(IMPORT_ITEM_STATUS) as ImportItemStatus[]).filter((s) => (counts[s] ?? 0) > 0);
  if (entries.length === 0) return <span className={styles.muted}>—</span>;
  return (
    <div className={styles.badges}>
      {entries.map((s) => (
        <Badge key={s} appearance="tint" color={IMPORT_ITEM_STATUS[s].color}>
          {IMPORT_ITEM_STATUS[s].label} {counts[s]}
        </Badge>
      ))}
    </div>
  );
}

/** Bulk import: upload many resumes or one ZIP (client-side limits), plus the batches list. */
export function ImportView() {
  const styles = useStyles();
  const admin = useAdminStyles();
  const router = useRouter();
  const canCreate = usePermission("candidate:create");
  const [files, setFiles] = useState<File[]>([]);
  const [check, setCheck] = useState<ImportCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const batches = useQuery({
    queryKey: candidateKeys.importList(page),
    queryFn: ({ signal }) => candidatesApi.listImports(page, DEFAULT_PAGE_SIZE, signal),
    enabled: canCreate,
    placeholderData: (prev) => prev,
    refetchInterval: (q) => (q.state.data?.items.some((b) => b.status !== "completed") ? 5000 : false),
  });
  const start = useCandidateMutation({
    mutationFn: (f: File[]) => candidatesApi.createImport(f),
    invalidate: [candidateKeys.imports],
    success: (b) => `Import started: ${b.total} file${b.total === 1 ? "" : "s"}`,
  });

  if (!canCreate) return <NoAccess what="candidate imports" />;

  const choose = (selected: File[]) => {
    setError(null);
    setFiles(selected);
    setCheck(validateImportFiles(selected));
  };

  const columns: TableColumnDefinition<ImportBatchOut>[] = [
    createTableColumn<ImportBatchOut>({
      columnId: "created",
      renderHeaderCell: () => "Started",
      renderCell: (b) => <AppLink href={`/candidates/imports/${b.id}`}>{formatDateTime(b.created_at)}</AppLink>,
    }),
    createTableColumn<ImportBatchOut>({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (b) => <BatchStatusBadge status={b.status} />,
    }),
    createTableColumn<ImportBatchOut>({
      columnId: "total",
      renderHeaderCell: () => "Files",
      renderCell: (b) => b.total,
    }),
    createTableColumn<ImportBatchOut>({
      columnId: "counts",
      renderHeaderCell: () => "Results",
      renderCell: (b) => <StatusCounts counts={b.counts} />,
    }),
    createTableColumn<ImportBatchOut>({
      columnId: "completed",
      renderHeaderCell: () => "Completed",
      renderCell: (b) => formatDateTime(b.completed_at),
    }),
  ];

  const totalSize = files.reduce((n, f) => n + f.size, 0);
  return (
    <>
      <PageHeader
        title="Import candidates"
        subtitle={
          <>
            Upload up to 200 resumes (PDF or DOCX, 10 MB each) or one ZIP file. Each resume is parsed, matched by email and
            checked for duplicates. <AppLink href="/candidates">Back to candidates</AppLink>
          </>
        }
      />
      <div className={admin.form}>
        <ErrorBar message={error} />
        {files.length === 0 ? (
          <FileDrop
            accept=".pdf,.docx,.zip"
            multiple
            title="Drop resumes or a ZIP file here"
            hint="At most 200 files, 10 MB each; or one ZIP up to 200 MB."
            buttonLabel="Choose files"
            onFiles={choose}
          />
        ) : (
          <Card>
            <div className={styles.selection}>
              <Subtitle2 as="h2">
                {check?.isZip ? "ZIP archive" : `${files.length} file${files.length === 1 ? "" : "s"}`} selected ·{" "}
                {formatBytes(totalSize)}
              </Subtitle2>
              <ul className={styles.list}>
                {files.slice(0, 50).map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <Text size={200}>
                      {f.name} <Caption1 className={admin.muted}>({formatBytes(f.size)})</Caption1>
                    </Text>
                  </li>
                ))}
                {files.length > 50 && <li>…and {files.length - 50} more</li>}
              </ul>
              {check?.errors.map((e) => (
                <MessageBar key={e} intent="error">
                  <MessageBarBody>{e}</MessageBarBody>
                </MessageBar>
              ))}
              {check?.warnings.map((w) => (
                <MessageBar key={w} intent="warning">
                  <MessageBarBody>{w}</MessageBarBody>
                </MessageBar>
              ))}
              <div className={styles.actions}>
                <Button
                  appearance="primary"
                  disabled={!check?.ok || start.isPending}
                  icon={start.isPending ? <Spinner size="tiny" /> : undefined}
                  onClick={async () => {
                    setError(null);
                    try {
                      const batch = await start.mutateAsync(files);
                      setFiles([]);
                      setCheck(null);
                      router.push(`/candidates/imports/${batch.id}`);
                    } catch (e) {
                      setError(candidateErrorMessage(e));
                    }
                  }}
                >
                  Start import
                </Button>
                <Button disabled={start.isPending} onClick={() => choose([])}>
                  Clear
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Subtitle2 as="h2" className={admin.sectionTitle}>
          Import history
        </Subtitle2>
        <AdminGrid
          label="Import batches"
          items={batches.data?.items}
          columns={columns}
          getRowId={(b) => b.id}
          loading={batches.isPending}
          error={batches.error}
          emptyText="No imports yet."
          columnSizing={{ counts: { minWidth: 260, idealWidth: 320 } }}
          footer={
            batches.data && (
              <PagingBar page={page} pageSize={DEFAULT_PAGE_SIZE} total={batches.data.total} onPageChange={setPage} busy={batches.isFetching} />
            )
          }
        />
      </div>
    </>
  );
}
