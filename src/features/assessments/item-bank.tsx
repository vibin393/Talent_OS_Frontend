"use client";

import {
  Badge,
  Button,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  Link,
  Option,
  Switch,
  type TableColumnDefinition,
  Text,
} from "@fluentui/react-components";
import { Add20Regular, ArrowUpload20Regular, Search20Regular } from "@fluentui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ConfirmDialog, ErrorBar, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { assessmentsApi } from "./api";
import { ITEM_KIND_LABELS, ITEM_KINDS } from "./logic";
import type { ImportPreviewOut, ImportRow, ItemKind, ItemOut } from "./types";
import { DialogShell, useAsmStyles } from "./ui";
import { ItemEditorDrawer } from "./item-editor";
import { assessmentKeys, useAssessmentPermissions, useItems } from "./use-assessments";

const ALL = "__all__";

/** `/assessments/items`: the item bank with the kind-specific editor drawer, archive and CSV/XLSX import. */
export function ItemBank() {
  const admin = useAdminStyles();
  const styles = useAsmStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const { canRead, canAuthor } = useAssessmentPermissions();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<ItemOut | "new" | null>(null);
  const [archiving, setArchiving] = useState<ItemOut | null>(null);
  const [importing, setImporting] = useState(false);
  const q = useDeferredValue(search.trim());
  const list = useItems({ q: q || undefined, kind: kind || undefined, include_archived: archived || undefined }, canRead || canAuthor);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["assessments", "items"] });
  if (!canRead && !canAuthor) return <NoAccess what="the item bank" />;

  const columns: TableColumnDefinition<ItemOut>[] = [
    createTableColumn({
      columnId: "stem",
      renderHeaderCell: () => "Item",
      renderCell: (i) => (
        <span className={admin.cellStack}>
          <Link as="button" onClick={() => setEditing(i)} disabled={!canAuthor}>
            {i.human_id}
          </Link>
          <Text size={200} className={admin.muted} truncate wrap={false}>
            {i.version.stem.slice(0, 120)}
          </Text>
        </span>
      ),
      compare: (a, b) => a.human_id.localeCompare(b.human_id),
    }),
    createTableColumn({
      columnId: "kind",
      renderHeaderCell: () => "Kind",
      renderCell: (i) => (
        <span className={admin.badges}>
          {ITEM_KIND_LABELS[i.kind] ?? i.kind}
          {i.archived_at && (
            <Badge appearance="tint" color="subtle">
              Archived
            </Badge>
          )}
        </span>
      ),
      compare: (a, b) => a.kind.localeCompare(b.kind),
    }),
    createTableColumn({ columnId: "tags", renderHeaderCell: () => "Tags", renderCell: (i) => i.tags.join(", ") || "—" }),
    createTableColumn({ columnId: "skills", renderHeaderCell: () => "Skills", renderCell: (i) => i.skill_keys.join(", ") || "—" }),
    createTableColumn({
      columnId: "difficulty",
      renderHeaderCell: () => "Difficulty",
      renderCell: (i) => <span aria-label={`Difficulty ${i.difficulty} of 5`}>{"●".repeat(i.difficulty)}{"○".repeat(Math.max(0, 5 - i.difficulty))}</span>,
      compare: (a, b) => a.difficulty - b.difficulty,
    }),
    createTableColumn({ columnId: "version", renderHeaderCell: () => "Version", renderCell: (i) => `v${i.current_version}`, compare: (a, b) => a.current_version - b.current_version }),
    createTableColumn({ columnId: "usage", renderHeaderCell: () => "Usage", renderCell: (i) => i.usage_count, compare: (a, b) => a.usage_count - b.usage_count }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => <span className={admin.muted}>Actions</span>,
      renderCell: (i) =>
        canAuthor && !i.archived_at ? (
          <Button
            size="small"
            appearance="subtle"
            onClick={(e) => {
              e.stopPropagation();
              setArchiving(i);
            }}
          >
            Archive
          </Button>
        ) : null,
    }),
  ];

  return (
    <>
      <div className={styles.headerRow}>
        <PageHeader title="Item bank" subtitle={<AppLink href="/assessments">Back to assessments</AppLink>} />
        {canAuthor && (
          <div className={styles.rowCenter}>
            <Button icon={<ArrowUpload20Regular />} onClick={() => setImporting(true)}>
              Import
            </Button>
            <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
              New item
            </Button>
          </div>
        )}
      </div>
      <div className={admin.toolbar}>
        <Field label="Search" className={admin.search}>
          <Input contentBefore={<Search20Regular aria-hidden />} value={search} placeholder="Stem, tag or skill" onChange={(_, d) => setSearch(d.value)} />
        </Field>
        <Field label="Kind" className={admin.filter}>
          <Dropdown
            value={kind ? ITEM_KIND_LABELS[kind as ItemKind] : "All kinds"}
            selectedOptions={[kind || ALL]}
            onOptionSelect={(_, d) => setKind(d.optionValue === ALL ? "" : String(d.optionValue))}
          >
            <Option value={ALL}>All kinds</Option>
            {ITEM_KINDS.map((k) => (
              <Option key={k} value={k}>
                {ITEM_KIND_LABELS[k]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Switch label="Include archived" checked={archived} onChange={(_, d) => setArchived(d.checked)} />
      </div>
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(i) => i.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No items match. Create one or import a file."
        label="Assessment items"
        sortable
        onRowClick={canAuthor ? (i) => setEditing(i) : undefined}
      />
      {editing && (
        <ItemEditorDrawer
          key={editing === "new" ? "new" : editing.id}
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            toast.success(editing === "new" ? "Item created" : "New item version saved");
            refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(archiving)}
        title={`Archive ${archiving?.human_id ?? "item"}?`}
        confirmLabel="Archive"
        onClose={() => setArchiving(null)}
        onConfirm={async () => {
          if (!archiving) return;
          try {
            await assessmentsApi.archiveItem(archiving.id);
            toast.success(`${archiving.human_id} archived`);
            refresh();
            void qc.invalidateQueries({ queryKey: assessmentKeys.item(archiving.id) });
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        Archived items are no longer offered for new sections or draws. Published versions that use it are unaffected.
      </ConfirmDialog>
      {importing && <ImportWizard onClose={() => setImporting(false)} onDone={refresh} />}
    </>
  );
}

/** Upload a CSV / XLSX, preview rows with their errors, then commit the valid rows. */
function ImportWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const styles = useAsmStyles();
  const toast = useAppToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await assessmentsApi.importPreview(file));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const out = await assessmentsApi.importCommit(preview.batch_id);
      toast.success(`${out.created} item${out.created === 1 ? "" : "s"} imported`);
      onDone();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const columns: TableColumnDefinition<ImportRow>[] = [
    createTableColumn({ columnId: "row", renderHeaderCell: () => "Row", renderCell: (r) => r.row }),
    createTableColumn({ columnId: "kind", renderHeaderCell: () => "Kind", renderCell: (r) => (r.kind ? (ITEM_KIND_LABELS[r.kind as ItemKind] ?? r.kind) : "—") }),
    createTableColumn({ columnId: "stem", renderHeaderCell: () => "Stem", renderCell: (r) => r.stem ?? "—" }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) =>
        r.valid ? (
          <Badge appearance="tint" color="success">
            Valid
          </Badge>
        ) : (
          <span className={styles.tight}>
            <Badge appearance="tint" color="danger">
              Error
            </Badge>
            {r.errors.map((e) => (
              <Text key={e} size={200}>
                {e}
              </Text>
            ))}
          </span>
        ),
    }),
  ];

  return (
    <DialogShell
      title="Import items"
      onClose={onClose}
      wide
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {preview ? (
            <>
              <Button disabled={busy} onClick={() => setPreview(null)}>
                Choose another file
              </Button>
              <Button appearance="primary" disabled={busy || preview.valid_count === 0} onClick={() => void commit()}>
                Import {preview.valid_count} valid row{preview.valid_count === 1 ? "" : "s"}
              </Button>
            </>
          ) : (
            <Button appearance="primary" disabled={busy || !file} onClick={() => void upload()}>
              Upload and preview
            </Button>
          )}
        </>
      }
    >
      <div className={styles.stack}>
        {!preview ? (
          <Field label="CSV or Excel file" hint="One item per row: kind, stem, options, answer key, skills, tags, difficulty, points.">
            <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
        ) : (
          <>
            <Text>
              {preview.valid_count} valid · {preview.error_count} with errors. Rows with errors are skipped.
            </Text>
            <AdminGrid items={preview.rows} columns={columns} getRowId={(r) => String(r.row)} loading={false} error={null} emptyText="The file has no rows." label="Import preview" />
          </>
        )}
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}
