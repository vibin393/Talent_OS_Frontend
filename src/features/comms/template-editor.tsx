"use client";

import {
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  SearchBox,
  Spinner,
  Subtitle2,
  Tab,
  TabList,
  Textarea,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import { Add16Regular, ArrowLeft20Regular, Archive20Regular, Save20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { EmailTemplateDetailOut, EmailTemplateKey } from "@/lib/api/types";
import { useDebounced } from "@/lib/use-debounced";
import { commsApi, commsKeys } from "./api";
import { token, unknownPaths } from "./merge-tokens";
import { type RichTextHandle, RichTextEditor } from "./rich-text-editor";
import { LANGUAGE_LABELS, mergeFieldError, TEMPLATE_KEYS, templateKeyLabel } from "./template-keys";
import { useMergeFields, useTemplate } from "./use-templates";

const useStyles = makeStyles({
  back: { marginBottom: tokens.spacingVerticalS },
  headerRow: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: tokens.spacingHorizontalM },
  headerTitle: { flex: 1, minWidth: 0 },
  actions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", paddingTop: tokens.spacingVerticalXS },
  panes: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 3fr) minmax(280px, 2fr)",
    gap: tokens.spacingHorizontalL,
    alignItems: "start",
    "@media (max-width: 1023px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
  left: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
  },
  right: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  row: { display: "flex", gap: tokens.spacingHorizontalM, flexWrap: "wrap", "& > *": { flex: "1 1 220px" } },
  fields: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, maxHeight: "360px", overflowY: "auto" },
  groupLabel: { color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS },
  fieldButton: { justifyContent: "flex-start", minWidth: 0, width: "100%" },
  fieldToken: { color: tokens.colorNeutralForeground3, marginInlineStart: "auto", fontSize: tokens.fontSizeBase200 },
  preview: {
    width: "100%",
    minHeight: "360px",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: "#ffffff",
  },
});

function previewDoc(subject: string, bodyHtml: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:'Segoe UI',system-ui,sans-serif;font-size:14px;line-height:1.5;color:#242424;margin:16px}h1{font-size:18px;font-weight:600;margin:0 0 12px}a{color:#0f6cbd}</style></head><body><h1>${esc(subject)}</h1>${bodyHtml}</body></html>`;
}

type Form = { name: string; description: string; key: EmailTemplateKey; subject: string; bodyHtml: string };

function formFrom(t: EmailTemplateDetailOut | undefined): Form {
  const v = t?.variants.find((x) => x.language === "en") ?? t?.variants[0];
  return {
    name: t?.name ?? "",
    description: t?.description ?? "",
    key: (t?.key as EmailTemplateKey | undefined) ?? "custom",
    subject: v?.subject ?? "",
    bodyHtml: v?.body_html ?? "",
  };
}

/** `/admin/email-templates/[id]` (or `new`): two-pane template editor with merge-field palette and live preview. */
export function TemplateEditorPage({ id }: { id: string }) {
  const canRead = usePermission("email_template:read");
  const isNew = id === "new";
  const template = useTemplate(isNew ? null : id);
  if (!canRead) return <NoAccess what="email templates" />;
  if (!isNew && template.isPending) return <GridSkeleton rows={8} />;
  if (!isNew && template.isError) {
    return (
      <>
        <ErrorBar
          title="Could not load the template."
          message={
            isApiError(template.error) && template.error.status === 404
              ? "This template does not exist or you do not have access to it."
              : errorMessage(template.error)
          }
        />
        <p>
          <AppLink href="/admin/email-templates">Back to email templates</AppLink>
        </p>
      </>
    );
  }
  return <TemplateEditor key={template.data?.id ?? "new"} template={isNew ? undefined : template.data} />;
}

function TemplateEditor({ template }: { template: EmailTemplateDetailOut | undefined }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canManage = usePermission("email_template:manage");
  const [form, setForm] = useState<Form>(() => formFrom(template));
  const [saved, setSaved] = useState<Form>(() => formFrom(template));
  const [mergeError, setMergeError] = useState<{ title: string; fields: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldQuery, setFieldQuery] = useState("");
  const [archiving, setArchiving] = useState(false);
  const editorRef = useRef<RichTextHandle>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<"subject" | "body">("body");
  const readOnly = !canManage;
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const catalog = useMergeFields(form.key);
  const allowed = useMemo(
    () => (catalog.data ?? []).flatMap((g) => g.fields.map((f) => f.path)),
    [catalog.data],
  );

  // Chips not in the catalog for this template type turn red as you type.
  useEffect(() => {
    if (!catalog.data) return;
    const bad = new Set([...unknownPaths(form.bodyHtml, allowed), ...(mergeError?.fields ?? [])]);
    editorRef.current?.markInvalid([...bad]);
  }, [form.bodyHtml, allowed, catalog.data, mergeError]);

  const previewSubject = useDebounced(form.subject, 500);
  const previewBody = useDebounced(form.bodyHtml, 500);
  const preview = useQuery({
    queryKey: ["comms", "template-preview", form.key, previewSubject, previewBody],
    queryFn: ({ signal }) => commsApi.preview({ key: form.key, subject: previewSubject, body_html: previewBody }, signal),
    retry: false,
    placeholderData: (prev) => prev,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!template) {
        return commsApi.createTemplate({
          key: form.key,
          name: form.name.trim(),
          description: form.description.trim() || null,
          language: "en",
          subject: form.subject,
          body_html: form.bodyHtml,
        });
      }
      let out = template;
      if (form.name !== saved.name || form.description !== saved.description) {
        out = await commsApi.updateTemplate(template.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
        });
      }
      if (form.subject !== saved.subject || form.bodyHtml !== saved.bodyHtml) {
        out = await commsApi.putVariant(template.id, "en", { subject: form.subject, body_html: form.bodyHtml });
      }
      return out;
    },
    onSuccess: (out) => {
      void queryClient.invalidateQueries({ queryKey: commsKeys.templates });
      queryClient.setQueryData(commsKeys.template(out.id), out);
      setMergeError(null);
      setError(null);
      toast.success(template ? `Saved ${out.name}` : `Created ${out.name}`);
      if (!template) router.replace(`/admin/email-templates/${out.id}`);
      else {
        const next = formFrom(out);
        setSaved(next);
        setForm(next);
      }
    },
    onError: (e) => {
      const merge = mergeFieldError(e);
      if (merge) {
        setMergeError({
          title: merge.code === "unknown_merge_field" ? "Unknown or unavailable merge fields" : "Malformed merge field",
          fields: merge.fields,
        });
        return;
      }
      if (isApiError(e) && e.code === "language_not_supported") {
        setError("Only English is supported for now.");
        return;
      }
      setError(errorMessage(e));
    },
  });

  const archive = useMutation({
    mutationFn: () => commsApi.archiveTemplate(template?.id ?? ""),
    onSuccess: (out) => {
      void queryClient.invalidateQueries({ queryKey: commsKeys.templates });
      toast.success(`Archived ${out.name}`);
      router.push("/admin/email-templates");
    },
    onError: (e) =>
      toast.error(
        isApiError(e) && e.code === "template_system" ? "System templates can be edited but not archived." : errorMessage(e),
      ),
  });

  const insertField = (path: string) => {
    if (readOnly) return;
    if (lastFocus.current === "subject" && subjectRef.current) {
      const el = subjectRef.current;
      const start = el.selectionStart ?? form.subject.length;
      const end = el.selectionEnd ?? start;
      set({ subject: `${form.subject.slice(0, start)}${token(path)}${form.subject.slice(end)}`.slice(0, 500) });
      requestAnimationFrame(() => el.focus());
      return;
    }
    editorRef.current?.insertField(path);
  };

  const needle = fieldQuery.trim().toLowerCase();
  const groups = (catalog.data ?? [])
    .map((g) => ({
      ...g,
      fields: g.fields.filter(
        (f) => !needle || f.label.toLowerCase().includes(needle) || f.path.includes(needle),
      ),
    }))
    .filter((g) => g.fields.length > 0);

  const canSave = !readOnly && dirty && form.name.trim() !== "" && form.subject.trim() !== "" && !save.isPending;

  return (
    <>
      <div className={styles.back}>
        <AppLink href="/admin/email-templates">
          <ArrowLeft20Regular style={{ verticalAlign: "middle" }} aria-hidden /> Email templates
        </AppLink>
      </div>
      <div className={styles.headerRow}>
        <div className={styles.headerTitle}>
          <PageHeader
            title={template ? template.name : "New template"}
            subtitle={
              template ? (
                <>
                  {templateKeyLabel(template.key)}
                  {template.is_system && (
                    <Badge appearance="tint" color="brand" style={{ marginInlineStart: 8 }}>
                      System
                    </Badge>
                  )}
                  {template.archived_at && (
                    <Badge appearance="tint" color="subtle" style={{ marginInlineStart: 8 }}>
                      Archived
                    </Badge>
                  )}
                </>
              ) : (
                "Write the subject and message, and insert merge fields from the palette."
              )
            }
          />
        </div>
        {!readOnly && (
          <div className={styles.actions}>
            <Button
              appearance="primary"
              icon={save.isPending ? <Spinner size="tiny" /> : <Save20Regular />}
              disabled={!canSave}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
            {template && !template.is_system && !template.archived_at && (
              <Button icon={<Archive20Regular />} onClick={() => setArchiving(true)}>
                Archive
              </Button>
            )}
          </div>
        )}
      </div>

      <div className={styles.panes}>
        <div className={styles.left}>
          {mergeError && (
            <MessageBar intent="error" layout="multiline" role="alert">
              <MessageBarBody>
                <MessageBarTitle>{mergeError.title}</MessageBarTitle>
                {mergeError.fields.length > 0
                  ? `${mergeError.fields.join(", ")} cannot be used in a ${templateKeyLabel(form.key)} template. Remove the red fields.`
                  : "Use the form {{ group.field }}, or insert fields from the palette."}
              </MessageBarBody>
            </MessageBar>
          )}
          <ErrorBar message={error} />
          <div className={styles.row}>
            <Field label="Name" required>
              <Input value={form.name} maxLength={200} disabled={readOnly} onChange={(_, d) => set({ name: d.value })} />
            </Field>
            <Field label="Type" hint={template ? "The type cannot be changed after creation." : undefined}>
              <Dropdown
                value={templateKeyLabel(form.key)}
                selectedOptions={[form.key]}
                disabled={readOnly || !!template}
                onOptionSelect={(_, d) => d.optionValue && set({ key: d.optionValue as EmailTemplateKey })}
              >
                {TEMPLATE_KEYS.map((k) => (
                  <Option key={k} value={k}>
                    {templateKeyLabel(k)}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              value={form.description}
              maxLength={1000}
              disabled={readOnly}
              resize="vertical"
              onChange={(_, d) => set({ description: d.value })}
            />
          </Field>
          <TabList selectedValue="en" size="small" aria-label="Languages">
            {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
              <Tab key={code} value={code}>
                {label}
              </Tab>
            ))}
            <Tooltip content="More languages coming soon" relationship="description">
              <Tab value="add" disabled icon={<Add16Regular />}>
                Add language
              </Tab>
            </Tooltip>
          </TabList>
          <Field label="Subject" required>
            <Input
              ref={subjectRef}
              value={form.subject}
              maxLength={500}
              disabled={readOnly}
              onFocus={() => {
                lastFocus.current = "subject";
              }}
              onChange={(_, d) => set({ subject: d.value })}
            />
          </Field>
          <Field label="Message">
            <div
              onFocusCapture={() => {
                lastFocus.current = "body";
              }}
            >
              <RichTextEditor
                ref={editorRef}
                value={form.bodyHtml}
                onChange={(bodyHtml) => set({ bodyHtml })}
                ariaLabel="Template message"
                minHeight={320}
                disabled={readOnly}
              />
            </div>
          </Field>
        </div>

        <div className={styles.right}>
          <Card>
            <CardHeader
              header={<Subtitle2 as="h2">Merge fields</Subtitle2>}
              description={<Body1>Click a field to insert it where the cursor is.</Body1>}
            />
            <SearchBox
              size="small"
              placeholder="Search fields"
              aria-label="Search merge fields"
              value={fieldQuery}
              onChange={(_, d) => setFieldQuery(d.value)}
            />
            <div className={styles.fields}>
              {catalog.isPending && <Spinner size="tiny" label="Loading fields" />}
              {groups.map((g) => (
                <div key={g.group}>
                  <Body1 className={styles.groupLabel} as="p">
                    {g.label}
                  </Body1>
                  {g.fields.map((f) => (
                    <Button
                      key={f.path}
                      appearance="subtle"
                      size="small"
                      className={styles.fieldButton}
                      disabled={readOnly}
                      onClick={() => insertField(f.path)}
                    >
                      {f.label}
                      <span className={styles.fieldToken}>{f.token}</span>
                    </Button>
                  ))}
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader
              header={<Subtitle2 as="h2">Preview</Subtitle2>}
              description={<Body1>Rendered with sample values.</Body1>}
              action={preview.isFetching ? <Spinner size="extra-tiny" aria-label="Updating preview" /> : undefined}
            />
            {preview.isError && !preview.data ? (
              <MessageBar intent="warning">
                <MessageBarBody>{errorMessage(preview.error, "The preview could not be rendered.")}</MessageBarBody>
              </MessageBar>
            ) : preview.data ? (
              <iframe
                title="Template preview"
                sandbox=""
                className={styles.preview}
                srcDoc={previewDoc(preview.data.subject, preview.data.body_html)}
              />
            ) : (
              <Spinner size="tiny" />
            )}
          </Card>
          {template && (
            <Body1 as="p" style={{ color: tokens.colorNeutralForeground3 }}>
              Version {template.variants.find((v) => v.language === "en")?.version ?? 1}
            </Body1>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={archiving}
        title="Archive template?"
        confirmLabel="Archive"
        onClose={() => setArchiving(false)}
        onConfirm={() => archive.mutateAsync()}
      >
        {`${template?.name ?? "This template"} will no longer be offered when composing emails.`}
      </ConfirmDialog>
    </>
  );
}
