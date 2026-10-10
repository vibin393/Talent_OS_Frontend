"use client";

import {
  Badge,
  Button,
  Caption1,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Link,
  Option,
  Spinner,
  type TableColumnDefinition,
  Textarea,
} from "@fluentui/react-components";
import { Archive20Regular, ArrowDownload20Regular, Attach20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, formatDateTime, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { AttachmentCategory, AttachmentOut, Candidate360Out } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { candidateErrorMessage } from "./errors";
import { FileDrop } from "./file-drop";
import { ATTACHMENT_CATEGORIES, ATTACHMENT_CATEGORY_LABELS, formatBytes, formatDate } from "./format";
import { ATTACHMENT_EXTENSIONS, validateSingleUpload } from "./import-validation";
import { useCandidateMutation } from "./use-candidates";

function isExpired(expiresOn: string | null): boolean {
  if (!expiresOn) return false;
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return expiresOn < iso;
}

/** Attachments grid (name, category, expiry, uploaded) with upload dialog and archive. */
export function AttachmentsTab({ c }: { c: Candidate360Out }) {
  const styles = useAdminStyles();
  const canEdit = usePermission("candidate:update") && c.can_edit !== false;
  const [uploading, setUploading] = useState(false);
  const [archiving, setArchiving] = useState<AttachmentOut | null>(null);
  const list = useQuery({
    queryKey: candidateKeys.attachments(c.id),
    queryFn: ({ signal }) => candidatesApi.listAttachments(c.id, signal),
  });
  const archive = useCandidateMutation({
    mutationFn: (a: AttachmentOut) => candidatesApi.archiveAttachment(a.id),
    invalidate: [candidateKeys.attachments(c.id), candidateKeys.detail(c.id)],
    success: (a) => `${a.file.original_name} archived`,
    toastErrors: true,
  });

  const columns: TableColumnDefinition<AttachmentOut>[] = [
    createTableColumn<AttachmentOut>({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (a) => (
        <div className={styles.cellStack}>
          <Link href={a.file.download_url} download className={styles.truncate}>
            {a.file.original_name}
          </Link>
          <Caption1 className={styles.muted}>
            {formatBytes(a.file.size_bytes)}
            {a.note ? ` · ${a.note}` : ""}
          </Caption1>
        </div>
      ),
    }),
    createTableColumn<AttachmentOut>({
      columnId: "category",
      renderHeaderCell: () => "Category",
      renderCell: (a) => ATTACHMENT_CATEGORY_LABELS[a.category],
    }),
    createTableColumn<AttachmentOut>({
      columnId: "expiry",
      renderHeaderCell: () => "Expiry",
      renderCell: (a) =>
        a.expires_on ? (
          <span>
            {formatDate(a.expires_on)}{" "}
            {isExpired(a.expires_on) && (
              <Badge size="small" appearance="tint" color="danger">
                expired
              </Badge>
            )}
          </span>
        ) : (
          "—"
        ),
    }),
    createTableColumn<AttachmentOut>({
      columnId: "uploaded",
      renderHeaderCell: () => "Uploaded",
      renderCell: (a) => formatDateTime(a.created_at),
    }),
    createTableColumn<AttachmentOut>({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (a) => (
        <RowActions
          label={a.file.original_name}
          actions={[
            {
              label: "Download",
              icon: <ArrowDownload20Regular />,
              onClick: () => window.open(a.file.download_url, "_blank", "noopener"),
            },
            ...(canEdit ? [{ label: "Archive", icon: <Archive20Regular />, onClick: () => setArchiving(a) }] : []),
          ]}
        />
      ),
    }),
  ];

  return (
    <div className={styles.form}>
      {canEdit && (
        <div>
          <Button appearance="primary" icon={<Attach20Regular />} onClick={() => setUploading(true)}>
            Upload attachment
          </Button>
        </div>
      )}
      <AdminGrid
        label="Attachments"
        items={list.data}
        columns={columns}
        getRowId={(a) => a.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No attachments yet."
        columnSizing={{ name: { minWidth: 220, idealWidth: 300 }, actions: { minWidth: 56, idealWidth: 56 } }}
      />
      {uploading && <UploadAttachmentDialog candidateId={c.id} onClose={() => setUploading(false)} />}
      <ConfirmDialog
        open={!!archiving}
        title="Archive attachment?"
        confirmLabel="Archive"
        onClose={() => setArchiving(null)}
        onConfirm={() => archive.mutateAsync(archiving!)}
      >
        {archiving && `${archiving.file.original_name} will be removed from this profile.`}
      </ConfirmDialog>
    </div>
  );
}

function UploadAttachmentDialog({ candidateId, onClose }: { candidateId: string; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<AttachmentCategory>("certificate");
  const [expiresOn, setExpiresOn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const upload = useCandidateMutation({
    mutationFn: () => candidatesApi.addAttachment(candidateId, file!, category, expiresOn || null, note.trim() || null),
    invalidate: [candidateKeys.attachments(candidateId), candidateKeys.detail(candidateId)],
    success: (a) => `${a.file.original_name} uploaded`,
  });

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !upload.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Upload attachment</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ErrorBar message={error} />
            {file ? (
              <Field label="File">
                <span>
                  {file.name} ({formatBytes(file.size)}){" "}
                  <Button size="small" appearance="subtle" onClick={() => setFile(null)}>
                    Change
                  </Button>
                </span>
              </Field>
            ) : (
              <FileDrop
                accept=".pdf,.docx,.png,.jpg,.jpeg"
                title="Drop a file here"
                hint="PDF, DOCX, PNG or JPEG, up to 10 MB."
                onFiles={(files) => {
                  const f = files[0];
                  const problem = validateSingleUpload(f, ATTACHMENT_EXTENSIONS);
                  setError(problem);
                  if (!problem) setFile(f);
                }}
              />
            )}
            <Field label="Category" required>
              <Dropdown
                value={ATTACHMENT_CATEGORY_LABELS[category]}
                selectedOptions={[category]}
                onOptionSelect={(_, d) => d.optionValue && setCategory(d.optionValue as AttachmentCategory)}
              >
                {ATTACHMENT_CATEGORIES.map((cat) => (
                  <Option key={cat} value={cat}>
                    {ATTACHMENT_CATEGORY_LABELS[cat]}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Expires on" hint="Optional, e.g. for ID proofs or certificates.">
              <Input type="date" value={expiresOn} onChange={(_, d) => setExpiresOn(d.value)} />
            </Field>
            <Field label="Note">
              <Textarea value={note} maxLength={2000} onChange={(_, d) => setNote(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={upload.isPending}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={!file || upload.isPending}
              icon={upload.isPending ? <Spinner size="tiny" /> : undefined}
              onClick={async () => {
                setError(null);
                try {
                  await upload.mutateAsync(undefined);
                  onClose();
                } catch (e) {
                  setError(candidateErrorMessage(e));
                }
              }}
            >
              Upload
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
