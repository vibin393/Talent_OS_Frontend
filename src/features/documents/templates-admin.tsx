"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Option,
  OverlayDrawer,
  Spinner,
  Subtitle2,
  Switch,
  type TableColumnDefinition,
  TableCellLayout,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowDown20Regular,
  ArrowUp20Regular,
  BracesVariable20Regular,
  Delete20Regular,
  Dismiss24Regular,
  Eye20Regular,
  Save20Regular,
} from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, formatDateTime, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { documentKeys, documentsApi, useEsignConfigs, useLegalEntities, useMergeCatalogue, useTemplate, useTemplates } from "./api";
import {
  insertAtCursor,
  mergeToken,
  moveItem,
  removeAt,
  renumberRoles,
  SIGNER_ROLE_LABELS,
  TEMPLATE_KINDS,
  templateKindLabel,
  unknownMergeFields,
} from "./logic";
import type { SignerRole, SignerRoleKind, TemplateKind, TemplateOut, TemplateVersionOut } from "./types";

const useStyles = makeStyles({
  toolbar: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  grow: { flex: 1 },
  filter: { minWidth: "200px" },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: tokens.spacingHorizontalL,
    "@media (max-width: 1023px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  row2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: tokens.spacingHorizontalM },
  body: { "& textarea": { fontFamily: tokens.fontFamilyMonospace, minHeight: "420px" } },
  bodyBar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  preview: {
    width: "100%",
    height: "70vh",
    minHeight: "420px",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  previewEmpty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: tokens.spacingHorizontalL,
    color: tokens.colorNeutralForeground3,
  },
  roles: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  roleRow: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: tokens.spacingHorizontalS },
  roleKind: { minWidth: "180px" },
  roleLabel: { flex: "1 1 160px" },
  versions: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  versionRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
  footer: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, justifyContent: "flex-end" },
});

const ALL = "__all__";
const NONE = "__none__";

/** `/admin/documents/templates`: document templates (agreements, letters, policies) with versioned Markdown bodies. */
export function TemplatesAdmin() {
  const styles = useStyles();
  const allowed = usePermission("document_template:manage");
  const [kind, setKind] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const templates = useTemplates(kind, showArchived, allowed);
  if (!allowed) return <NoAccess what="document templates" />;

  const columns: TableColumnDefinition<TemplateOut>[] = [
    createTableColumn({
      columnId: "name",
      compare: (a, b) => a.name.localeCompare(b.name),
      renderHeaderCell: () => "Template",
      renderCell: (t) => (
        <TableCellLayout truncate>
          {t.name}{" "}
          {t.archived_at && (
            <Badge appearance="outline" color="subtle">
              Archived
            </Badge>
          )}
          {!t.current_version_id && (
            <Badge appearance="tint" color="warning">
              Not published
            </Badge>
          )}
        </TableCellLayout>
      ),
    }),
    createTableColumn({ columnId: "kind", renderHeaderCell: () => "Kind", renderCell: (t) => templateKindLabel(t.kind) }),
    createTableColumn({
      columnId: "version",
      renderHeaderCell: () => "Published",
      renderCell: (t) => (t.current_version_no ? `v${t.current_version_no}` : "—"),
    }),
    createTableColumn({
      columnId: "signers",
      renderHeaderCell: () => "Signers",
      renderCell: (t) =>
        t.signer_roles.length
          ? [...t.signer_roles]
              .sort((a, b) => a.order - b.order)
              .map((r) => r.label)
              .join(" → ")
          : "—",
    }),
    createTableColumn({
      columnId: "updated",
      compare: (a, b) => a.updated_at.localeCompare(b.updated_at),
      renderHeaderCell: () => "Updated",
      renderCell: (t) => formatDateTime(t.updated_at),
    }),
  ];

  return (
    <>
      <PageHeader title="Document templates" subtitle="Agreements, letters and policies with merge fields, signing order and versions." />
      <div className={styles.toolbar}>
        <Field label="Kind" className={styles.filter}>
          <Dropdown
            value={kind ? templateKindLabel(kind) : "All kinds"}
            selectedOptions={[kind ?? ALL]}
            onOptionSelect={(_, d) => setKind(d.optionValue === ALL ? null : (d.optionValue ?? null))}
          >
            <Option value={ALL}>All kinds</Option>
            {TEMPLATE_KINDS.map((k) => (
              <Option key={k} value={k}>
                {templateKindLabel(k)}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Switch label="Show archived" checked={showArchived} onChange={(_, d) => setShowArchived(d.checked)} />
        <span className={styles.grow} />
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
          New template
        </Button>
      </div>
      <AdminGrid
        items={templates.data}
        columns={columns}
        getRowId={(t) => t.id}
        loading={templates.isPending}
        error={templates.error}
        emptyText="No document templates yet."
        label="Document templates"
        sortable
        onRowClick={(t) => setEditing(t.id)}
      />
      {creating && (
        <NewTemplateDialog
          onClose={() => setCreating(false)}
          onCreated={(t) => {
            setCreating(false);
            setEditing(t.id);
          }}
        />
      )}
      <OverlayDrawer position="end" size="full" open={!!editing} onOpenChange={(_, d) => !d.open && setEditing(null)}>
        {editing && <TemplateEditor key={editing} id={editing} onClose={() => setEditing(null)} />}
      </OverlayDrawer>
    </>
  );
}

function NewTemplateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (t: TemplateOut) => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TemplateKind>("employment_agreement");
  const create = useMutation({ mutationFn: () => documentsApi.createTemplate({ name: name.trim(), kind, body_md: `# ${name.trim() || "Agreement"}\n\n` }) });
  const errs = fieldErrors(create.error);
  const submit = async () => {
    try {
      const t = await create.mutateAsync();
      void qc.invalidateQueries({ queryKey: documentKeys.templatesAll });
      toast.success(`Created “${t.name}”`);
      onCreated(t);
    } catch {
      // shown below
    }
  };
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && !create.isPending && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>New document template</DialogTitle>
          <DialogContent className={styles.form}>
            <ErrorBar message={create.isError && !Object.keys(errs).length ? errorMessage(create.error) : null} />
            <Field label="Name" required validationMessage={errs.name}>
              <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
            </Field>
            <Field label="Kind" required>
              <Dropdown value={templateKindLabel(kind)} selectedOptions={[kind]} onOptionSelect={(_, d) => d.optionValue && setKind(d.optionValue as TemplateKind)}>
                {TEMPLATE_KINDS.map((k) => (
                  <Option key={k} value={k}>
                    {templateKindLabel(k)}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={!name.trim() || create.isPending} icon={create.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
              Create
            </Button>
            <Button disabled={create.isPending} onClick={onClose}>
              Cancel
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function TemplateEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useTemplate(id);
  return (
    <>
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}>
          {q.data?.name ?? "Template"}
        </DrawerHeaderTitle>
      </DrawerHeader>
      {q.isPending ? (
        <DrawerBody>
          <Spinner label="Loading…" />
        </DrawerBody>
      ) : q.isError ? (
        <DrawerBody>
          <ErrorBar title="Could not load the template." message={errorMessage(q.error)} />
        </DrawerBody>
      ) : (
        <EditorForm template={q.data} onClose={onClose} />
      )}
    </>
  );
}

type RoleDraft = SignerRole & { key: string };
let roleSeq = 0;
const roleKey = () => `r${++roleSeq}`;

function latest(versions: TemplateVersionOut[], status: string): TemplateVersionOut | null {
  return [...versions].filter((v) => v.status === status).sort((a, b) => b.version_no - a.version_no)[0] ?? null;
}

function EditorForm({ template, onClose }: { template: TemplateOut; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const entities = useLegalEntities();
  const esign = useEsignConfigs();
  const catalogue = useMergeCatalogue();
  const draft = latest(template.versions, "draft");
  const published = template.versions.find((v) => v.id === template.current_version_id) ?? latest(template.versions, "published");

  const [name, setName] = useState(template.name);
  const [entityId, setEntityId] = useState<string | null>(template.legal_entity_id);
  const [esignId, setEsignId] = useState<string | null>(template.esign_config_id);
  const [roles, setRoles] = useState<RoleDraft[]>(() =>
    [...template.signer_roles].sort((a, b) => a.order - b.order).map((r) => ({ ...r, key: roleKey() })),
  );
  const [body, setBody] = useState(draft?.body_md ?? published?.body_md ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [unknown, setUnknown] = useState<string[] | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const previewUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: documentKeys.template(template.id) });
    void qc.invalidateQueries({ queryKey: documentKeys.templatesAll });
  };

  const saveDetails = useMutation({
    mutationFn: () =>
      documentsApi.patchTemplate(template.id, {
        name: name.trim(),
        legal_entity_id: entityId,
        esign_config_id: esignId,
        signer_roles: renumberRoles(roles.map((r) => ({ role: r.role, order: r.order, label: r.label.trim() }))),
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("Template details saved");
    },
  });

  /** The version id holding the current editor body (a new draft is saved when the body changed). */
  const ensureVersion = async (): Promise<TemplateVersionOut> => {
    if (draft && draft.body_md === body) return draft;
    if (!draft && published && published.body_md === body) return published;
    const v = await documentsApi.createVersion(template.id, body);
    await refresh();
    return v;
  };

  const saveDraft = useMutation({
    mutationFn: ensureVersion,
    onSuccess: (v) => toast.success(v.status === "draft" ? `Draft v${v.version_no} saved` : "No changes to save"),
  });

  const previewMut = useMutation({
    mutationFn: async () => {
      const v = await ensureVersion();
      return documentsApi.previewVersion(v.id);
    },
    onSuccess: (blob) => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = URL.createObjectURL(blob);
      setPreview(previewUrl.current);
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      const v = await ensureVersion();
      if (v.status !== "draft") throw new Error("nothing_to_publish");
      return documentsApi.publishVersion(v.id);
    },
    onSuccess: async (t) => {
      setPublishing(false);
      setUnknown(null);
      await refresh();
      toast.success(`Published v${t.current_version_no}`);
    },
    onError: (e) => setUnknown(unknownMergeFields(e)),
  });

  const archive = useMutation({
    mutationFn: (archived: boolean) => documentsApi.patchTemplate(template.id, { archived }),
    onSuccess: async (t) => {
      await refresh();
      toast.success(t.archived_at ? "Template archived" : "Template restored");
    },
  });

  const insertField = (ns: string, attr: string) => {
    const el = bodyRef.current;
    const { value, caret } = insertAtCursor(body, el?.selectionStart, el?.selectionEnd, mergeToken(ns, attr));
    setBody(value);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const bodyDirty = draft ? draft.body_md !== body : published ? published.body_md !== body : body.length > 0;
  const canPublish = !!draft || bodyDirty;
  const entityOptions = entities.data ?? [];
  const esignOptions = esign.isError ? [] : (esign.data ?? []).filter((c) => c.status === "active");
  const detailErrs = fieldErrors(saveDetails.error);

  return (
    <>
      <DrawerBody>
        <div className={styles.form}>
          <Caption1 className={styles.muted}>
            {templateKindLabel(template.kind)} · {template.current_version_no ? `published v${template.current_version_no}` : "not published yet"}
            {draft ? ` · draft v${draft.version_no}` : ""}
            {template.archived_at ? " · archived" : ""}
          </Caption1>
          <div className={styles.layout}>
            <div className={styles.form}>
              <ErrorBar message={saveDetails.isError && !Object.keys(detailErrs).length ? errorMessage(saveDetails.error) : null} />
              <ErrorBar title="Could not save the draft." message={saveDraft.isError ? errorMessage(saveDraft.error) : null} />
              <div className={styles.row2}>
                <Field label="Name" required validationMessage={detailErrs.name}>
                  <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
                </Field>
                <Field label="Legal entity" hint={entities.isError ? "Legal entities could not be loaded." : "Company that issues the document."}>
                  <Dropdown
                    value={entityId ? (entityOptions.find((e) => e.id === entityId)?.name ?? "Selected entity") : "Any entity"}
                    selectedOptions={[entityId ?? NONE]}
                    onOptionSelect={(_, d) => setEntityId(d.optionValue === NONE ? null : (d.optionValue ?? null))}
                  >
                    <Option value={NONE}>Any entity</Option>
                    {entityOptions.map((e) => (
                      <Option key={e.id} value={e.id}>
                        {e.name}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="eSign provider" hint={esign.isError ? "Only the built-in provider is available to you." : undefined}>
                  <Dropdown
                    value={esignId ? (esignOptions.find((c) => c.id === esignId)?.display_name ?? "Configured provider") : "Built-in (typed name)"}
                    selectedOptions={[esignId ?? NONE]}
                    onOptionSelect={(_, d) => setEsignId(d.optionValue === NONE ? null : (d.optionValue ?? null))}
                  >
                    <Option value={NONE}>Built-in (typed name)</Option>
                    {esignOptions.map((c) => (
                      <Option key={c.id} value={c.id}>
                        {c.display_name}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              </div>

              <section className={styles.form} aria-labelledby="roles-title">
                <Subtitle2 as="h3" id="roles-title">
                  Signing order
                </Subtitle2>
                {roles.length === 0 && <Body1 className={styles.muted}>No signer roles. Signers are chosen when sending.</Body1>}
                <ol className={styles.roles}>
                  {roles.map((r, i) => (
                    <li key={r.key} className={styles.roleRow}>
                      <Text weight="semibold">{i + 1}.</Text>
                      <Field label="Role" className={styles.roleKind}>
                        <Dropdown
                          value={SIGNER_ROLE_LABELS[r.role]}
                          selectedOptions={[r.role]}
                          onOptionSelect={(_, d) =>
                            d.optionValue && setRoles((l) => l.map((x) => (x.key === r.key ? { ...x, role: d.optionValue as SignerRoleKind } : x)))
                          }
                        >
                          {(Object.keys(SIGNER_ROLE_LABELS) as SignerRoleKind[]).map((k) => (
                            <Option key={k} value={k}>
                              {SIGNER_ROLE_LABELS[k]}
                            </Option>
                          ))}
                        </Dropdown>
                      </Field>
                      <Field label="Label" className={styles.roleLabel}>
                        <Input value={r.label} maxLength={100} onChange={(_, d) => setRoles((l) => l.map((x) => (x.key === r.key ? { ...x, label: d.value } : x)))} />
                      </Field>
                      <Button appearance="subtle" icon={<ArrowUp20Regular />} aria-label={`Move ${r.label || "role"} up`} disabled={i === 0} onClick={() => setRoles((l) => moveItem(l, i, -1))} />
                      <Button
                        appearance="subtle"
                        icon={<ArrowDown20Regular />}
                        aria-label={`Move ${r.label || "role"} down`}
                        disabled={i === roles.length - 1}
                        onClick={() => setRoles((l) => moveItem(l, i, 1))}
                      />
                      <Button appearance="subtle" icon={<Delete20Regular />} aria-label={`Remove ${r.label || "role"}`} onClick={() => setRoles((l) => removeAt(l, i))} />
                    </li>
                  ))}
                </ol>
                <div>
                  <Button
                    icon={<Add20Regular />}
                    disabled={roles.length >= 10}
                    onClick={() =>
                      setRoles((l) => [
                        ...l,
                        { key: roleKey(), role: l.length === 0 ? "worker" : "tenant_signatory", order: l.length + 1, label: l.length === 0 ? "Employee" : "Authorised signatory" },
                      ])
                    }
                  >
                    Add signer role
                  </Button>
                </div>
              </section>
              <div>
                <Button
                  icon={saveDetails.isPending ? <Spinner size="tiny" /> : <Save20Regular />}
                  disabled={saveDetails.isPending || !name.trim() || roles.some((r) => !r.label.trim())}
                  onClick={() => saveDetails.mutate()}
                >
                  Save details
                </Button>
              </div>

              <section className={styles.form} aria-labelledby="body-title">
                <div className={styles.bodyBar}>
                  <Subtitle2 as="h3" id="body-title" className={styles.grow}>
                    Body (Markdown)
                  </Subtitle2>
                  <MergeFieldMenu catalogue={catalogue.data?.namespaces} loading={catalogue.isPending} onPick={insertField} />
                </div>
                <Field
                  className={styles.body}
                  hint={`Merge fields look like {{ candidate.full_name }}. Filters: ${(catalogue.data?.filters ?? []).join(", ") || "—"}.`}
                >
                  <Textarea ref={bodyRef} value={body} resize="vertical" onChange={(_, d) => setBody(d.value)} aria-label="Template body" />
                </Field>
                {bodyDirty && <Caption1 className={styles.muted}>Unsaved changes. Saving creates a new draft version.</Caption1>}
              </section>

              <section className={styles.form} aria-labelledby="versions-title">
                <Subtitle2 as="h3" id="versions-title">
                  Version history
                </Subtitle2>
                <ul className={styles.versions}>
                  {[...template.versions]
                    .sort((a, b) => b.version_no - a.version_no)
                    .map((v) => (
                      <li key={v.id} className={styles.versionRow}>
                        <Text weight="semibold">v{v.version_no}</Text>
                        <Badge appearance="tint" color={v.status === "published" ? "success" : v.status === "draft" ? "warning" : "subtle"}>
                          {v.status}
                        </Badge>
                        <Caption1 className={styles.muted}>
                          {v.published_at ? `published ${formatDateTime(v.published_at)}` : `created ${formatDateTime(v.created_at)}`} · {v.merge_fields.length} fields
                        </Caption1>
                        <Button size="small" appearance="subtle" onClick={() => setBody(v.body_md)}>
                          Load into editor
                        </Button>
                      </li>
                    ))}
                </ul>
              </section>
            </div>

            <section className={styles.form} aria-labelledby="preview-title">
              <div className={styles.bodyBar}>
                <Subtitle2 as="h3" id="preview-title" className={styles.grow}>
                  Preview
                </Subtitle2>
                <Button
                  icon={previewMut.isPending ? <Spinner size="tiny" /> : <Eye20Regular />}
                  disabled={previewMut.isPending || !body.trim()}
                  onClick={() => previewMut.mutate()}
                >
                  {preview ? "Refresh preview" : "Preview"}
                </Button>
              </div>
              {previewMut.isError && <ErrorBar title="Could not render the preview." message={errorMessage(previewMut.error)} />}
              {preview ? (
                <iframe className={styles.preview} src={preview} title={`Preview of ${template.name}`} />
              ) : (
                <div className={mergeClasses(styles.preview, styles.previewEmpty)}>Select Preview to render the PDF with sample data. Unsaved changes are saved as a draft first.</div>
              )}
            </section>
          </div>
        </div>
      </DrawerBody>
      <DrawerFooter>
        <div className={styles.footer}>
          <Button
            appearance="primary"
            disabled={!canPublish || publish.isPending || !!template.archived_at}
            onClick={() => {
              setUnknown(null);
              publish.reset();
              setPublishing(true);
            }}
          >
            Publish…
          </Button>
          <Button icon={saveDraft.isPending ? <Spinner size="tiny" /> : undefined} disabled={!bodyDirty || saveDraft.isPending || !body.trim()} onClick={() => saveDraft.mutate()}>
            Save draft
          </Button>
          <Button disabled={archive.isPending} onClick={() => archive.mutate(!template.archived_at)}>
            {template.archived_at ? "Restore" : "Archive"}
          </Button>
          <Button appearance="subtle" onClick={onClose}>
            Close
          </Button>
        </div>
      </DrawerFooter>
      <Dialog open={publishing} onOpenChange={(_, d) => !d.open && !publish.isPending && setPublishing(false)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Publish this version?</DialogTitle>
            <DialogContent className={styles.form}>
              <Body1>
                New signature requests will use it. Documents already sent keep the version they were generated from.
                {bodyDirty ? " Your unsaved changes are saved as a new draft first." : ""}
              </Body1>
              {unknown && unknown.length > 0 && (
                <MessageBar intent="error" layout="multiline" role="alert">
                  <MessageBarBody>
                    These merge fields are not in the catalogue. Fix or remove them, then publish again:
                    <ul>
                      {unknown.map((f) => (
                        <li key={f}>
                          <code>{f}</code>
                        </li>
                      ))}
                    </ul>
                  </MessageBarBody>
                </MessageBar>
              )}
              {publish.isError && !unknown?.length && (
                <ErrorBar
                  message={publish.error instanceof Error && publish.error.message === "nothing_to_publish" ? "There is no draft to publish." : errorMessage(publish.error)}
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" disabled={publish.isPending} icon={publish.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => publish.mutate()}>
                Publish
              </Button>
              <Button disabled={publish.isPending} onClick={() => setPublishing(false)}>
                Cancel
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}

function MergeFieldMenu({
  catalogue,
  loading,
  onPick,
}: {
  catalogue: Record<string, string[]> | undefined;
  loading: boolean;
  onPick: (ns: string, attr: string) => void;
}) {
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button icon={<BracesVariable20Regular />} disabled={loading || !catalogue}>
          Insert merge field
        </Button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {Object.entries(catalogue ?? {}).map(([ns, attrs]) => (
            <Menu key={ns}>
              <MenuTrigger disableButtonEnhancement>
                <MenuItem>{ns}</MenuItem>
              </MenuTrigger>
              <MenuPopover>
                <MenuList style={{ maxHeight: 360, overflowY: "auto" }}>
                  {attrs.map((a) => (
                    <MenuItem key={a} onClick={() => onPick(ns, a)}>
                      {ns}.{a}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
