"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Combobox,
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
  makeStyles,
  Option,
  Spinner,
  Subtitle2,
  Switch,
  type TableColumnDefinition,
  TableCellLayout,
  Text,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowDownload20Regular,
  ArrowUpload20Regular,
  Archive20Regular,
  DocumentArrowRight20Regular,
  History20Regular,
  LockClosed16Filled,
  Shield16Filled,
  Signature20Regular,
} from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ConfirmDialog, DetailsDrawer, ErrorBar, formatDateTime } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, fieldErrors, isApiError } from "@/lib/api/errors";
import { documentsApi, useDocument, useDocuments, useInvalidateDocuments, useSignatureRequests } from "./api";
import { ACCESS_LEVELS, accessLevelInfo, categorySlug, DOCUMENT_CATEGORIES, expiryBadge, formatBytes, humanize, localToday, requestStatus } from "./logic";
import { SendForSignatureDrawer } from "./send-for-signature-drawer";
import type { AccessLevel, DocumentOut, SignatureRequestOut } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  toolbar: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center", justifyContent: "flex-end" },
  title: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS, minWidth: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
  icons: { display: "inline-flex", gap: tokens.spacingHorizontalXS, alignItems: "center", color: tokens.colorNeutralForeground2 },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  versions: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  version: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    paddingBlock: tokens.spacingVerticalS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
  },
  grow: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  requests: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  requestRow: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

const SOURCE_LABELS: Record<string, string> = { upload: "Uploaded", generated: "Generated", signed: "Signed copy", migrated: "Migrated" };

export type DocumentsPanelProps = {
  ownerKind: string;
  ownerId: string;
  /** Owner display name, used for the "This candidate" signer shortcut. */
  ownerName?: string;
};

/** Documents of one record (candidate, worker, client…): versions, expiry, access level, signature requests. */
export function DocumentsPanel({ ownerKind, ownerId, ownerName }: DocumentsPanelProps) {
  const styles = useStyles();
  const toast = useAppToast();
  const canWrite = usePermission("document:write");
  const canSign = usePermission("signature_request:create");
  const invalidate = useInvalidateDocuments();
  const [showArchived, setShowArchived] = useState(false);
  const docs = useDocuments(ownerKind, ownerId, showArchived);
  const requests = useSignatureRequests(ownerKind, ownerId, canSign);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<string | null>(null);
  const [fileAction, setFileAction] = useState<{ doc: DocumentOut; mode: "version" | "supersede" } | null>(null);
  const [archiving, setArchiving] = useState<DocumentOut | null>(null);
  const [signing, setSigning] = useState<{ requestId?: string; versionId?: string } | null>(null);
  const today = localToday();

  const columns: TableColumnDefinition<DocumentOut>[] = [
    createTableColumn({
      columnId: "title",
      compare: (a, b) => a.title.localeCompare(b.title),
      renderHeaderCell: () => "Document",
      renderCell: (d) => {
        const access = accessLevelInfo(d.access_level);
        return (
          <TableCellLayout truncate description={d.human_id}>
            <span className={styles.title}>
              <Text truncate wrap={false}>
                {d.title}
              </Text>
              <span className={styles.icons}>
                {access.restricted && (
                  <Tooltip content={`${access.label}: ${access.description}`} relationship="label">
                    <Shield16Filled tabIndex={0} />
                  </Tooltip>
                )}
                {d.signed && (
                  <Tooltip content="Signed: this document can't be changed" relationship="label">
                    <LockClosed16Filled tabIndex={0} />
                  </Tooltip>
                )}
              </span>
              {d.archived_at && (
                <Badge appearance="outline" color="subtle">
                  Archived
                </Badge>
              )}
              {d.superseded_by_id && (
                <Badge appearance="outline" color="subtle">
                  Superseded
                </Badge>
              )}
            </span>
          </TableCellLayout>
        );
      },
    }),
    createTableColumn({
      columnId: "category",
      compare: (a, b) => a.category.localeCompare(b.category),
      renderHeaderCell: () => "Category",
      renderCell: (d) => humanize(d.category),
    }),
    createTableColumn({
      columnId: "version",
      renderHeaderCell: () => "Version",
      renderCell: (d) => (d.current_version ? `v${d.current_version.version_no} · ${SOURCE_LABELS[d.current_version.source] ?? d.current_version.source}` : "—"),
    }),
    createTableColumn({
      columnId: "expiry",
      compare: (a, b) => (a.expires_on ?? "9999").localeCompare(b.expires_on ?? "9999"),
      renderHeaderCell: () => "Expiry",
      renderCell: (d) => {
        const b = expiryBadge(d.expires_on, today);
        return b.state === "none" ? (
          <Caption1 className={styles.muted}>—</Caption1>
        ) : (
          <Badge appearance={b.state === "ok" ? "outline" : "filled"} color={b.color}>
            {b.label}
          </Badge>
        );
      },
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (d) => (
        <span/* NOSONAR */ onClick={(e) => e.stopPropagation()}>
          <RowActions
            label={d.title}
            actions={[
              ...(d.current_version
                ? [{ label: "Download", icon: <ArrowDownload20Regular />, onClick: () => window.open(d.current_version?.download_url, "_blank", "noopener") }]
                : []),
              { label: "Version history", icon: <History20Regular />, onClick: () => setHistory(d.id) },
              ...(canWrite && !d.archived_at && !d.signed
                ? [{ label: "Upload new version", icon: <ArrowUpload20Regular />, onClick: () => setFileAction({ doc: d, mode: "version" }) }]
                : []),
              ...(canWrite && !d.archived_at && !d.superseded_by_id
                ? [{ label: "Supersede with a new file", icon: <DocumentArrowRight20Regular />, onClick: () => setFileAction({ doc: d, mode: "supersede" }) }]
                : []),
              ...(canSign && !d.archived_at && !d.signed && d.current_version
                ? [{ label: "Send for signature", icon: <Signature20Regular />, onClick: () => setSigning({ versionId: d.current_version?.id }) }]
                : []),
              ...(canWrite && !d.archived_at && !d.signed ? [{ label: "Archive", icon: <Archive20Regular />, onClick: () => setArchiving(d) }] : []),
            ]}
          />
        </span>
      ),
    }),
  ];

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Switch label="Show archived" checked={showArchived} onChange={(_, d) => setShowArchived(d.checked)} />
        {canSign && (
          <Button icon={<Signature20Regular />} onClick={() => setSigning({})}>
            Send for signature
          </Button>
        )}
        {canWrite && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setUploading(true)}>
            Upload document
          </Button>
        )}
      </div>
      <AdminGrid
        items={docs.data}
        columns={columns}
        getRowId={(d) => d.id}
        loading={docs.isPending}
        error={docs.error}
        emptyText="No documents yet."
        label="Documents"
        sortable
        onRowClick={(d) => setHistory(d.id)}
      />

      {canSign && (
        <SignatureRequestsList requests={requests.data} loading={requests.isPending} error={requests.error} onOpen={(id) => setSigning({ requestId: id })} />
      )}

      {uploading && <UploadDialog ownerKind={ownerKind} ownerId={ownerId} onClose={() => setUploading(false)} />}
      {fileAction && <FileActionDialog doc={fileAction.doc} mode={fileAction.mode} onClose={() => setFileAction(null)} />}
      <VersionHistoryDrawer id={history} onClose={() => setHistory(null)} />
      <ConfirmDialog
        open={!!archiving}
        title={`Archive “${archiving?.title ?? ""}”?`}
        confirmLabel="Archive"
        onClose={() => setArchiving(null)}
        onConfirm={async () => {
          if (!archiving) return;
          try {
            await documentsApi.archive(archiving.id);
            await invalidate();
            toast.success(`Archived “${archiving.title}”`);
          } catch (e) {
            toast.error(isApiError(e) && e.code === "document_signed" ? "Signed documents can't be archived." : errorMessage(e));
            throw e;
          }
        }}
      >
        The document is hidden from this list but kept for its retention period. Turn on “Show archived” to see it.
      </ConfirmDialog>
      {signing && (
        <SendForSignatureDrawer
          open
          onClose={() => setSigning(null)}
          ownerKind={ownerKind}
          ownerId={ownerId}
          ownerName={ownerName}
          requestId={signing.requestId ?? null}
          documentVersionId={signing.versionId ?? null}
        />
      )}
    </div>
  );
}

function SignatureRequestsList({
  requests,
  loading,
  error,
  onOpen,
}: {
  requests: SignatureRequestOut[] | undefined;
  loading: boolean;
  error: unknown;
  onOpen: (id: string) => void;
}) {
  const styles = useStyles();
  return (
    <section aria-labelledby="sig-req-title" className={styles.form}>
      <Subtitle2 as="h3" id="sig-req-title">
        Signature requests
      </Subtitle2>
      {loading && !requests ? (
        <Spinner size="tiny" label="Loading…" labelPosition="after" />
      ) : error && !requests ? (
        <ErrorBar message={errorMessage(error)} />
      ) : !requests?.length ? (
        <Body1 className={styles.muted}>No signature requests yet.</Body1>
      ) : (
        <ul className={styles.requests}>
          {requests.map((r) => {
            const st = requestStatus(r.status);
            const signed = r.signers.filter((s) => s.status === "signed").length;
            return (
              <li key={r.id} className={styles.requestRow}>
                <Link onClick={() => onOpen(r.id)}>
                  {r.human_id} · {r.title}
                </Link>
                <Badge appearance="tint" color={st.color}>
                  {st.label}
                </Badge>
                <Caption1 className={styles.muted}>
                  {signed}/{r.signers.length} signed · {r.completed_at ? `completed ${formatDateTime(r.completed_at)}` : `expires ${formatDateTime(r.expires_at)}`}
                </Caption1>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function UploadDialog({ ownerKind, ownerId, onClose }: { ownerKind: string; ownerId: string; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const invalidate = useInvalidateDocuments();
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [access, setAccess] = useState<AccessLevel>("entity");
  const [expires, setExpires] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: () =>
      documentsApi.upload({
        owner_kind: ownerKind,
        owner_id: ownerId,
        category: categorySlug(category),
        file: file as File,
        title: title.trim() || undefined,
        access_level: access,
        expires_on: expires || null,
      }),
  });
  const errs = fieldErrors(upload.error);
  const submit = async () => {
    if (!file) return setLocalError("Choose a file.");
    if (!category.trim()) return setLocalError("Choose or type a category.");
    setLocalError(null);
    try {
      const d = await upload.mutateAsync();
      await invalidate();
      toast.success(`Uploaded “${d.title}”`);
      onClose();
    } catch {
      // shown below
    }
  };
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !upload.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogContent className={styles.form}>
            <ErrorBar message={localError ?? (upload.isError && !Object.keys(errs).length ? errorMessage(upload.error) : null)} />
            <Field label="File" required validationMessage={errs.file}>
              <input type="file" aria-label="File" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
            <Field label="Category" required validationMessage={errs.category}>
              <Combobox
                freeform
                placeholder="Choose or type a category"
                value={category}
                selectedOptions={category ? [categorySlug(category)] : []}
                onOptionSelect={(_, d) => d.optionValue && setCategory(humanize(d.optionValue))}
                onChange={(e) => setCategory(e.target.value)}
              >
                {DOCUMENT_CATEGORIES.map((c) => (
                  <Option key={c} value={c} text={humanize(c)}>
                    {humanize(c)}
                  </Option>
                ))}
              </Combobox>
            </Field>
            <Field label="Title (optional)" hint="Defaults to the file name." validationMessage={errs.title}>
              <Input value={title} maxLength={300} onChange={(_, d) => setTitle(d.value)} />
            </Field>
            <Field label="Who can open it" validationMessage={errs.access_level}>
              <Dropdown
                value={accessLevelInfo(access).label}
                selectedOptions={[access]}
                onOptionSelect={(_, d) => d.optionValue && setAccess(d.optionValue as AccessLevel)}
              >
                {ACCESS_LEVELS.map((a) => (
                  <Option key={a} value={a} text={accessLevelInfo(a).label}>
                    {accessLevelInfo(a).label}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Expires on (optional)" hint="For IDs, visas and certificates." validationMessage={errs.expires_on}>
              <Input type="date" value={expires} onChange={(_, d) => setExpires(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={upload.isPending} icon={upload.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
              Upload
            </Button>
            <Button disabled={upload.isPending} onClick={onClose}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function FileActionDialog({ doc, mode, onClose }: { doc: DocumentOut; mode: "version" | "supersede"; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const invalidate = useInvalidateDocuments();
  const [file, setFile] = useState<File | null>(null);
  const run = useMutation({ mutationFn: (f: File) => (mode === "version" ? documentsApi.addVersion(doc.id, f) : documentsApi.supersede(doc.id, f)) });
  const submit = async () => {
    if (!file) return;
    try {
      await run.mutateAsync(file);
      await invalidate();
      toast.success(mode === "version" ? `Uploaded a new version of “${doc.title}”` : `Superseded “${doc.title}”`);
      onClose();
    } catch {
      // shown below
    }
  };
  const err = run.isError ? (isApiError(run.error) && run.error.code === "document_signed" ? "Signed documents can't get new versions. Supersede it instead." : errorMessage(run.error)) : null;
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !run.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{mode === "version" ? "Upload a new version" : "Supersede with a new file"}</DialogTitle>
          <DialogContent className={styles.form}>
            <Body1>
              {mode === "version"
                ? `The new file becomes the current version of “${doc.title}”. Earlier versions stay in the history.`
                : `A new document replaces “${doc.title}”, which is kept and marked as superseded.`}
            </Body1>
            <ErrorBar message={err} />
            <Field label="File" required>
              <input type="file" aria-label="File" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={!file || run.isPending} icon={run.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
              Upload
            </Button>
            <Button disabled={run.isPending} onClick={onClose}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function VersionHistoryDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const styles = useStyles();
  const q = useDocument(id);
  const d = q.data;
  const access = d ? accessLevelInfo(d.access_level) : null;
  return (
    <DetailsDrawer open={!!id} title={d?.title ?? "Document"} onClose={onClose}>
      {q.isPending ? (
        <Spinner label="Loading…" />
      ) : q.isError ? (
        <ErrorBar title="Could not load the document." message={errorMessage(q.error)} />
      ) : d ? (
        <div className={styles.form}>
          <Caption1 className={styles.muted}>
            {d.human_id} · {humanize(d.category)} · {access?.label}
            {d.signed ? " · Signed" : ""}
            {d.expires_on ? ` · expires ${d.expires_on}` : ""}
          </Caption1>
          <Subtitle2 as="h3">Versions</Subtitle2>
          <ul className={styles.versions}>
            {[...(d.versions ?? (d.current_version ? [d.current_version] : []))]
              .sort((a, b) => b.version_no - a.version_no)
              .map((v) => (
                <li key={v.id} className={styles.version}>
                  <div className={styles.grow}>
                    <Text weight="semibold">
                      v{v.version_no} · {SOURCE_LABELS[v.source] ?? v.source}
                      {d.current_version?.id === v.id ? " (current)" : ""}
                    </Text>
                    <Caption1 className={styles.muted}>
                      {v.file_name ?? "file"} · {formatBytes(v.size)} · {formatDateTime(v.created_at)}
                    </Caption1>
                    <Caption1 className={styles.muted} title={v.sha256}>
                      SHA-256 {v.sha256.slice(0, 12)}…
                    </Caption1>
                  </div>
                  <Button as="a" href={v.download_url} target="_blank" rel="noopener" appearance="subtle" icon={<ArrowDownload20Regular />} aria-label={`Download version ${v.version_no}`} />
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </DetailsDrawer>
  );
}
