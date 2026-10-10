"use client";

import { Badge, Button, Caption1, createTableColumn, Link, Spinner, type TableColumnDefinition } from "@fluentui/react-components";
import { ArrowDownload20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, formatDateTime, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { Candidate360Out, ResumeOut, ResumeUploadOut } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { candidateErrorMessage } from "./errors";
import { FileDrop } from "./file-drop";
import { formatBytes, PARSE_STATUS } from "./format";
import { RESUME_EXTENSIONS, validateSingleUpload } from "./import-validation";
import { ResumeDiffDialog } from "./resume-diff-dialog";
import { useCandidateMutation } from "./use-candidates";

export function ParseStatusBadge({ status, label }: { status: ResumeOut["parse_status"]; label?: string }) {
  const s = PARSE_STATUS[status];
  const color = s.intent === "success" ? "success" : s.intent === "error" ? "danger" : s.intent === "warning" ? "warning" : "informative";
  return (
    <Badge appearance="tint" color={color}>
      {label || s.label}
    </Badge>
  );
}

/** Resume versions (download, parse status) + upload with the diff dialog. */
export function ResumesTab({ c }: { c: Candidate360Out }) {
  const styles = useAdminStyles();
  const toast = useAppToast();
  const canEdit = usePermission("candidate:update") && c.can_edit !== false;
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<ResumeUploadOut | null>(null);

  const resumes = useQuery({
    queryKey: candidateKeys.resumes(c.id),
    queryFn: ({ signal }) => candidatesApi.listResumes(c.id, signal),
    initialData: c.resumes,
  });
  const upload = useCandidateMutation({
    mutationFn: (file: File) => candidatesApi.uploadResume(c.id, file),
    invalidate: [candidateKeys.resumes(c.id), candidateKeys.detail(c.id), candidateKeys.aiActions(c.id)],
  });

  async function onFiles(files: File[]) {
    const file = files[0];
    setUploadError(null);
    const problem = validateSingleUpload(file, RESUME_EXTENSIONS);
    if (problem) {
      setUploadError(problem);
      return;
    }
    try {
      const r = await upload.mutateAsync(file);
      if (r.parse_status === "parsed" && r.diff.length > 0) {
        setResult(r);
      } else {
        toast.success(
          r.parse_status === "parsed"
            ? `Resume v${r.resume.version ?? ""} uploaded. Nothing new to apply.`
            : `Resume v${r.resume.version ?? ""} uploaded. ${PARSE_STATUS[r.parse_status].label}.`,
        );
      }
    } catch (e) {
      setUploadError(candidateErrorMessage(e));
    }
  }

  const columns: TableColumnDefinition<ResumeOut>[] = [
    createTableColumn<ResumeOut>({
      columnId: "version",
      renderHeaderCell: () => "Version",
      renderCell: (r) => `v${r.version ?? "—"}`,
    }),
    createTableColumn<ResumeOut>({
      columnId: "file",
      renderHeaderCell: () => "File",
      renderCell: (r) => (
        <div className={styles.cellStack}>
          <Link href={r.file.download_url} download className={styles.truncate}>
            {r.file.original_name}
          </Link>
          <Caption1 className={styles.muted}>{formatBytes(r.file.size_bytes)}</Caption1>
        </div>
      ),
    }),
    createTableColumn<ResumeOut>({
      columnId: "status",
      renderHeaderCell: () => "Parse status",
      renderCell: (r) => <ParseStatusBadge status={r.parse_status} label={r.parse_label} />,
    }),
    createTableColumn<ResumeOut>({
      columnId: "text",
      renderHeaderCell: () => "Text",
      renderCell: (r) =>
        r.text_status === "ok" ? "Extracted" : r.text_status === "image_only" ? "Image only" : r.text_status === "encrypted" ? "Encrypted" : "Failed",
    }),
    createTableColumn<ResumeOut>({
      columnId: "uploaded",
      renderHeaderCell: () => "Uploaded",
      renderCell: (r) => formatDateTime(r.created_at),
    }),
    createTableColumn<ResumeOut>({
      columnId: "download",
      renderHeaderCell: () => "Download",
      renderCell: (r) => (
        <Button
          as="a"
          href={r.file.download_url}
          download
          appearance="subtle"
          icon={<ArrowDownload20Regular />}
          aria-label={`Download ${r.file.original_name}`}
        />
      ),
    }),
  ];

  const sorted = [...(resumes.data ?? [])].sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
  return (
    <div className={styles.form}>
      {canEdit && (
        <>
          <ErrorBar message={uploadError} />
          {upload.isPending ? (
            <Spinner label="Uploading and parsing…" />
          ) : (
            <FileDrop
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              title="Drop a new resume version here"
              hint="PDF or DOCX, up to 10 MB. Parsed changes are shown for review before anything is applied."
              buttonLabel="Upload resume"
              onFiles={onFiles}
            />
          )}
        </>
      )}
      <AdminGrid
        label="Resume versions"
        items={sorted}
        columns={columns}
        getRowId={(r) => r.id}
        loading={resumes.isPending}
        error={resumes.error}
        emptyText="No resumes yet."
        columnSizing={{ file: { minWidth: 220, idealWidth: 280 }, status: { minWidth: 180 } }}
      />
      {result && <ResumeDiffDialog candidate={c} upload={result} onClose={() => setResult(null)} />}
    </div>
  );
}
