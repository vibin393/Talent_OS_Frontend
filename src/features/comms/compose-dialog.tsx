"use client";

import {
  Button,
  Dialog,
  DialogSurface,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  OverlayDrawer,
  Spinner,
  Text,
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  ToolbarToggleButton,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import {
  BracesVariable20Regular,
  Delete20Regular,
  Dismiss20Regular,
  DocumentText20Regular,
  Eye20Regular,
  Send20Filled,
} from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppToast } from "@/components/toast";
import { activityKeys } from "@/features/activity/api";
import { ConfirmDialog } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { useDebounced } from "@/lib/use-debounced";
import { useMediaQuery } from "@/lib/use-media-query";
import { commsApi, commsKeys } from "./api";
import {
  bouncedSet,
  buildSendBody,
  clearDraft,
  type ComposeContext,
  type ComposeDraft,
  type ComposeErrors,
  draftKey,
  emptyDraft,
  fromLine,
  hasContent,
  knownAddresses,
  loadDraft,
  needsOverwriteConfirm,
  saveDraft,
  templateKeysFor,
  validateDraft,
} from "./compose-model";
import { type PickerGroup, SearchablePicker } from "./insert-menus";
import { token } from "./merge-tokens";
import { RecipientPicker } from "./recipient-picker";
import { type RichTextHandle, RichTextEditor } from "./rich-text-editor";
import { mergeFieldError, templateKeyLabel } from "./template-keys";
import { useMergeFields, useTemplates } from "./use-templates";

const useStyles = makeStyles({
  surface: {
    width: "min(960px, calc(100vw - 32px))",
    maxWidth: "min(960px, calc(100vw - 32px))",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    maxHeight: "calc(100vh - 48px)",
    overflow: "hidden",
  },
  titleBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  commandBar: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    flexWrap: "wrap",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    overflowY: "auto",
    flex: 1,
    minHeight: 0,
  },
  fromRow: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "baseline" },
  fromLabel: { width: "64px", flexShrink: 0, color: tokens.colorNeutralForeground2 },
  subjectField: { gridTemplateColumns: "64px minmax(0, 1fr)" },
  muted: { color: tokens.colorNeutralForeground3 },
  preview: {
    width: "100%",
    minHeight: "320px",
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: "#ffffff",
  },
  previewSubject: { fontWeight: tokens.fontWeightSemibold },
});

/** Sandboxed preview document (no scripts, no same-origin). */
function previewDoc(subject: string, bodyHtml: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:'Segoe UI',system-ui,sans-serif;font-size:14px;line-height:1.5;color:#242424;margin:16px}h1{font-size:18px;font-weight:600;margin:0 0 12px}a{color:#0f6cbd}</style></head><body><h1>${esc(subject)}</h1>${bodyHtml}</body></html>`;
}

/**
 * Outlook-like compose surface: command bar (Send, Discard, Insert template, Insert field, Preview),
 * read-only From line, To / Cc people pickers, Subject and a rich-text body with merge-field chips.
 * A large `Dialog`, or a full-width `OverlayDrawer` below 768px. The draft is kept in sessionStorage per entity.
 */
export function ComposeDialog({ context, onClose }: { context: ComposeContext; onClose: () => void }) {
  const narrow = useMediaQuery("(max-width: 767px)");
  const styles = useStyles();
  const title = `New message${context.label ? ` — ${context.label}` : ""}`;
  const content = <ComposeSurface context={context} onClose={onClose} title={title} narrow={narrow} />;

  if (narrow) {
    return (
      <OverlayDrawer open position="end" size="full" onOpenChange={(_, d) => !d.open && onClose()}>
        {content}
      </OverlayDrawer>
    );
  }
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface className={styles.surface} aria-label={title}>
        {content}
      </DialogSurface>
    </Dialog>
  );
}

function ComposeSurface({
  context,
  onClose,
  title,
  narrow,
}: {
  context: ComposeContext;
  onClose: () => void;
  title: string;
  narrow: boolean;
}) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const key = draftKey(context);
  const [draft, setDraft] = useState<ComposeDraft>(() => loadDraft(key) ?? emptyDraft(context));
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<ComposeErrors>({});
  const [serverError, setServerError] = useState<{ title: string; message: string } | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const editorRef = useRef<RichTextHandle>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<"subject" | "body">("body");

  // Persist the draft (a convenience; failures are ignored).
  useEffect(() => {
    if (hasContent(draft)) saveDraft(key, draft);
    else clearDraft(key);
  }, [key, draft]);

  const update = (patch: Partial<ComposeDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const connections = useQuery({
    queryKey: commsKeys.connections,
    queryFn: ({ signal }) => commsApi.connections(signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const allowedKeys = templateKeysFor(context.entityType);
  const templates = useTemplates(null);
  const mergeFields = useMergeFields(draft.templateKey);

  const addresses = knownAddresses([...draft.to, ...draft.cc]);
  const status = useQuery({
    queryKey: commsKeys.addressStatus(addresses),
    queryFn: ({ signal }) => commsApi.addressStatus(addresses, signal),
    enabled: addresses.length > 0,
    staleTime: 60_000,
  });
  const bounced = useMemo(() => bouncedSet(status.data), [status.data]);

  const debouncedSubject = useDebounced(draft.subject, 500);
  const debouncedBody = useDebounced(draft.bodyHtml, 500);
  const previewQuery = useQuery({
    queryKey: ["comms", "preview", draft.templateKey, debouncedSubject, debouncedBody, context.contextRefs],
    queryFn: ({ signal }) =>
      commsApi.preview(
        { key: draft.templateKey, subject: debouncedSubject, body_html: debouncedBody, context_refs: context.contextRefs },
        signal,
      ),
    enabled: preview,
    retry: false,
  });

  const templateGroups: PickerGroup[] = allowedKeys
    .map((k) => ({
      key: k,
      label: templateKeyLabel(k),
      items: (templates.data ?? [])
        .filter((t) => t.key === k && !t.archived_at)
        .map((t) => ({ value: t.id, label: t.name, secondary: t.description ?? undefined })),
    }))
    .filter((g) => g.items.length > 0);

  const fieldGroups: PickerGroup[] = (mergeFields.data ?? []).map((g) => ({
    key: g.group,
    label: g.label,
    items: g.fields.map((f) => ({ value: f.path, label: f.label, secondary: f.token })),
  }));

  const applyTemplate = async (templateId: string) => {
    setLoadingTemplate(true);
    setServerError(null);
    try {
      const t = await queryClient.fetchQuery({
        queryKey: commsKeys.template(templateId),
        queryFn: ({ signal }) => commsApi.getTemplate(templateId, signal),
      });
      const variant = t.variants.find((v) => v.language === "en") ?? t.variants[0];
      if (!variant) {
        toast.error("This template has no content yet.");
        return;
      }
      editorRef.current?.setHtml(variant.body_html);
      setDraft((d) => ({
        ...d,
        subject: variant.subject,
        bodyHtml: variant.body_html,
        templateVariantId: variant.id,
        templateKey: t.key as ComposeDraft["templateKey"],
        pristine: { subject: variant.subject, bodyHtml: variant.body_html },
      }));
    } catch (e) {
      toast.error(errorMessage(e, "Could not load the template."));
    } finally {
      setLoadingTemplate(false);
    }
  };

  const pickTemplate = (templateId: string) => {
    if (needsOverwriteConfirm(draft)) setPendingTemplate(templateId);
    else void applyTemplate(templateId);
  };

  const insertField = (path: string) => {
    if (lastFocus.current === "subject" && subjectRef.current) {
      const el = subjectRef.current;
      const start = el.selectionStart ?? draft.subject.length;
      const end = el.selectionEnd ?? start;
      const next = `${draft.subject.slice(0, start)}${token(path)}${draft.subject.slice(end)}`;
      update({ subject: next.slice(0, 500) });
      requestAnimationFrame(() => el.focus());
      return;
    }
    editorRef.current?.insertField(path);
  };

  const send = useMutation({
    mutationFn: () => commsApi.send(buildSendBody(draft, context)),
    onSuccess: (out) => {
      clearDraft(key);
      void queryClient.invalidateQueries({ queryKey: activityKeys.all });
      void queryClient.invalidateQueries({ queryKey: commsKeys.all });
      const bouncedOut = out?.warnings.bounced_addresses ?? [];
      toast.success(
        out && out.message_ids.length > 1 ? `${out.message_ids.length} messages queued` : "Message queued",
      );
      if (bouncedOut.length > 0) toast.info(`Earlier mail to ${bouncedOut.join(", ")} bounced; it may not arrive.`);
      onClose();
    },
    onError: (e) => {
      const merge = mergeFieldError(e);
      if (merge) {
        editorRef.current?.markInvalid(merge.fields);
        setServerError({
          title: merge.code === "unknown_merge_field" ? "Unknown merge fields" : "Malformed merge field",
          message:
            merge.code === "unknown_merge_field"
              ? `Remove or replace: ${merge.fields.join(", ")}`
              : "Use the form {{ group.field }}, or insert fields from the Insert field menu.",
        });
        return;
      }
      if (isApiError(e) && e.code === "recipient_email_missing") {
        setServerError({ title: "Missing email address", message: "A recipient has no email address on file." });
        return;
      }
      if (isApiError(e) && (e.code === "rate_limited" || e.status === 429)) {
        setServerError({ title: "Sending limit reached", message: "You have sent many emails this hour. Try again later." });
        return;
      }
      setServerError({ title: "Could not send.", message: errorMessage(e) });
    },
  });

  const doSend = () => {
    const v = validateDraft(draft);
    setErrors(v);
    setServerError(null);
    if (Object.keys(v).length > 0) return;
    send.mutate();
  };

  const discard = () => {
    clearDraft(key);
    onClose();
  };

  const busy = send.isPending;
  const fromText = me ? fromLine(me.user.email, connections.data) : "";
  const previewData = previewQuery.data;

  return (
    <>
      {narrow ? (
        <DrawerHeader>
          <DrawerHeaderTitle
            action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss20Regular />} onClick={onClose} />}
          >
            {title}
          </DrawerHeaderTitle>
        </DrawerHeader>
      ) : (
        <div className={styles.titleBar}>
          <Text weight="semibold" size={400} as="h2" id="compose-title">
            {title}
          </Text>
          <Button appearance="subtle" aria-label="Close" icon={<Dismiss20Regular />} onClick={onClose} />
        </div>
      )}
      <Toolbar aria-label="Message commands" className={styles.commandBar}>
        <Button
          appearance="primary"
          icon={busy ? <Spinner size="tiny" /> : <Send20Filled />}
          disabled={busy}
          onClick={doSend}
        >
          Send
        </Button>
        <ToolbarButton icon={<Delete20Regular />} onClick={discard} disabled={busy}>
          Discard
        </ToolbarButton>
        <ToolbarDivider />
        <SearchablePicker
          label="Insert template"
          icon={loadingTemplate ? <Spinner size="extra-tiny" /> : <DocumentText20Regular />}
          groups={templateGroups}
          loading={templates.isPending}
          onPick={pickTemplate}
          searchPlaceholder="Search templates"
          emptyText="No templates for this context."
          disabled={busy}
        />
        <SearchablePicker
          label="Insert field"
          icon={<BracesVariable20Regular />}
          groups={fieldGroups}
          loading={mergeFields.isPending}
          onPick={insertField}
          searchPlaceholder="Search fields"
          emptyText="No matching fields."
          disabled={busy}
        />
        <ToolbarDivider />
        <Tooltip content="Preview with real values" relationship="description">
          <ToolbarToggleButton
            name="view"
            value="preview"
            icon={<Eye20Regular />}
            aria-pressed={preview}
            onClick={() => setPreview((p) => !p)}
          >
            Preview
          </ToolbarToggleButton>
        </Tooltip>
      </Toolbar>

      {narrow ? (
        <DrawerBody>
          {renderFields()}
        </DrawerBody>
      ) : (
        <div className={styles.body}>
          {renderFields()}
        </div>
      )}

      <ConfirmDialog
        open={pendingTemplate !== null}
        title="Replace your message?"
        confirmLabel="Replace"
        onClose={() => setPendingTemplate(null)}
        onConfirm={async () => {
          const id = pendingTemplate;
          setPendingTemplate(null);
          if (id) await applyTemplate(id);
        }}
      >
        Inserting this template replaces the subject and message you have written.
      </ConfirmDialog>
    </>
  );

  function renderFields() {
    return (
      <>
        {serverError && (
          <MessageBar intent="error" layout="multiline">
            <MessageBarBody>
              <MessageBarTitle>{serverError.title}</MessageBarTitle>
              {serverError.message}
            </MessageBarBody>
          </MessageBar>
        )}
        <div className={styles.fromRow}>
          <Text className={styles.fromLabel}>From</Text>
          <Text>{fromText || "…"}</Text>
        </div>
        <RecipientPicker
          label="To"
          value={draft.to}
          onChange={(to) => update({ to })}
          suggestions={context.suggested}
          bounced={bounced}
          validationMessage={errors.to}
          disabled={busy}
        />
        <RecipientPicker
          label="Cc"
          value={draft.cc}
          onChange={(cc) => update({ cc })}
          suggestions={context.suggested}
          bounced={bounced}
          disabled={busy}
        />
        <Field
          label="Subject"
          orientation="horizontal"
          className={styles.subjectField}
          validationState={errors.subject ? "error" : "none"}
          validationMessage={errors.subject}
        >
          <Input
            ref={subjectRef}
            appearance="underline"
            value={draft.subject}
            maxLength={500}
            disabled={busy}
            onFocus={() => {
              lastFocus.current = "subject";
            }}
            onChange={(_, d) => update({ subject: d.value })}
          />
        </Field>
        {preview && (
          <div aria-live="polite">
            {previewQuery.isPending ? (
              <Spinner size="small" label="Rendering preview…" />
            ) : previewQuery.isError ? (
              <MessageBar intent="error">
                <MessageBarBody>{errorMessage(previewQuery.error, "Could not render the preview.")}</MessageBarBody>
              </MessageBar>
            ) : previewData ? (
              <>
                {previewData.render_warnings.length > 0 && (
                  <MessageBar intent="warning" layout="multiline">
                    <MessageBarBody>
                      <MessageBarTitle>Some fields have no value</MessageBarTitle>
                      {previewData.render_warnings.join(", ")} will be empty.
                    </MessageBarBody>
                  </MessageBar>
                )}
                <iframe
                  title="Message preview"
                  className={styles.preview}
                  sandbox=""
                  srcDoc={previewDoc(previewData.subject, previewData.body_html)}
                />
              </>
            ) : null}
          </div>
        )}
        {/* The editor stays mounted while previewing so undo history and the cursor survive. */}
        <div hidden={preview}>
          <Field validationState={errors.body ? "error" : "none"} validationMessage={errors.body}>
            <div
              onFocusCapture={() => {
                lastFocus.current = "body";
              }}
            >
              <RichTextEditor
                ref={editorRef}
                value={draft.bodyHtml}
                onChange={(bodyHtml) => update({ bodyHtml })}
                ariaLabel="Message body"
                invalid={!!errors.body}
                minHeight={narrow ? 240 : 280}
                disabled={busy}
              />
            </div>
          </Field>
        </div>
      </>
    );
  }
}
