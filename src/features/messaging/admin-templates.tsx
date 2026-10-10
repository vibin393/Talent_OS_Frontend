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
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  TableCellLayout,
  type TableColumnDefinition,
  Text,
  Textarea,
  Toolbar,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowSync20Regular, BracesVariable20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime, useAdminStyles } from "@/features/admin/ui";
import { commsApi, commsKeys } from "@/features/comms/api";
import { type PickerGroup, SearchablePicker } from "@/features/comms/insert-menus";
import { token } from "@/features/comms/merge-tokens";
import { errorMessage, fieldErrors, isApiError } from "@/lib/api/errors";
import { messagingApi, messagingKeys } from "./api";
import {
  CHANNEL_LABELS,
  emptyTemplateDraft,
  PURPOSE_LABELS,
  SMS_MAX_LENGTH,
  type TemplateDraft,
  templatePayload,
  templateStatusBadge,
  templateToDraft,
  validateTemplate,
} from "./logic";
import { type Channel, type ChannelTemplate, TEMPLATE_PURPOSES, type TemplateStatus } from "./types";

const useStyles = makeStyles({
  surface: { width: "720px", maxWidth: "calc(100vw - 32px)" },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: tokens.spacingHorizontalM },
  body: { fontFamily: tokens.fontFamilyMonospace },
});

const STATUS_OPTIONS: { value: TemplateStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "registered", label: "Registered" },
  { value: "archived", label: "Archived" },
];

/** Admin → Messaging → Templates: SMS (DLT) and WhatsApp (approved) templates. */
export function TemplatesTab() {
  const styles = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<Channel>("sms");
  const [editing, setEditing] = useState<ChannelTemplate | "new" | null>(null);
  const list = useQuery({ queryKey: messagingKeys.templates(channel), queryFn: ({ signal }) => messagingApi.templates(channel, null, signal) });
  const sync = useMutation({
    mutationFn: () => messagingApi.syncWhatsapp(),
    onSuccess: (r) => {
      toast.success(`Synced from WhatsApp: ${r.created} new, ${r.updated} updated`);
      void queryClient.invalidateQueries({ queryKey: ["messaging", "templates"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const columns: TableColumnDefinition<ChannelTemplate>[] = [
    createTableColumn<ChannelTemplate>({
      columnId: "name",
      compare: (a, b) => a.name.localeCompare(b.name),
      renderHeaderCell: () => "Name",
      renderCell: (t) => (
        <TableCellLayout description={t.key}>
          <Text weight="semibold">{t.name}</Text>
        </TableCellLayout>
      ),
    }),
    createTableColumn<ChannelTemplate>({
      columnId: "purpose",
      renderHeaderCell: () => "Purpose",
      renderCell: (t) => PURPOSE_LABELS[t.purpose] ?? t.purpose,
    }),
    createTableColumn<ChannelTemplate>({
      columnId: "ref",
      renderHeaderCell: () => (channel === "sms" ? "DLT template ID" : "Template name"),
      renderCell: (t) => t.provider_template_ref ?? "—",
    }),
    createTableColumn<ChannelTemplate>({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (t) => {
        const b = templateStatusBadge(t);
        return (
          <Badge appearance="tint" color={b.color}>
            {b.label}
          </Badge>
        );
      },
    }),
    createTableColumn<ChannelTemplate>({
      columnId: "updated",
      compare: (a, b) => a.updated_at.localeCompare(b.updated_at),
      renderHeaderCell: () => "Updated",
      renderCell: (t) => `${formatDateTime(t.updated_at)} · v${t.version}`,
    }),
  ];

  return (
    <>
      <div className={styles.toolbar}>
        <Field label="Channel" className={styles.filter}>
          <Dropdown value={CHANNEL_LABELS[channel]} selectedOptions={[channel]} onOptionSelect={(_, d) => setChannel(d.optionValue as Channel)}>
            <Option value="sms">SMS</Option>
            <Option value="whatsapp">WhatsApp</Option>
          </Dropdown>
        </Field>
        <div className={styles.grow} />
        {channel === "whatsapp" && (
          <Button icon={sync.isPending ? <Spinner size="tiny" /> : <ArrowSync20Regular />} disabled={sync.isPending} onClick={() => sync.mutate()}>
            Sync from WhatsApp
          </Button>
        )}
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
          New template
        </Button>
      </div>
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(t) => t.id}
        loading={list.isPending}
        error={list.error}
        emptyText={`No ${CHANNEL_LABELS[channel]} templates yet.`}
        label={`${CHANNEL_LABELS[channel]} templates`}
        sortable
        onRowClick={(t) => setEditing(t)}
      />
      {editing && (
        <TemplateEditorDialog
          key={editing === "new" ? `new-${channel}` : editing.id}
          template={editing === "new" ? null : editing}
          channel={channel}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function TemplateEditorDialog({ template, channel, onClose }: { template: ChannelTemplate | null; channel: Channel; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [d, setD] = useState<TemplateDraft>(() => (template ? templateToDraft(template) : emptyTemplateDraft(channel)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fields = useQuery({
    queryKey: commsKeys.mergeFields("custom"),
    queryFn: ({ signal }) => commsApi.mergeFields("custom", signal),
    staleTime: 10 * 60_000,
    retry: false,
  });
  const groups: PickerGroup[] = (fields.data ?? []).map((g) => ({
    key: g.group,
    label: g.label,
    items: g.fields.map((f) => ({ value: f.path, label: f.label, secondary: f.sample })),
  }));
  const allowed = fields.data ? fields.data.flatMap((g) => g.fields.map((f) => f.path)) : undefined;

  const save = useMutation({
    mutationFn: (body: TemplateDraft) => (template ? messagingApi.updateTemplate(template.id, body) : messagingApi.createTemplate(body)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messaging", "templates"] });
      toast.success(template ? "Template saved" : "Template created");
      onClose();
    },
    onError: (e) => {
      if (isApiError(e) && e.status === 422) {
        const fe = fieldErrors(e);
        setErrors(fe);
        if (!Object.keys(fe).length) setFormError(e.message);
      } else setFormError(errorMessage(e));
    },
  });

  const set = <K extends keyof TemplateDraft>(k: K, v: TemplateDraft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  const insert = (path: string) => {
    const el = bodyRef.current;
    const t = token(path);
    const start = el?.selectionStart ?? d.body.length;
    const end = el?.selectionEnd ?? d.body.length;
    set("body", d.body.slice(0, start) + t + d.body.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + t.length, start + t.length);
    });
  };
  const submit = () => {
    setFormError(null);
    const e = validateTemplate(d, allowed);
    setErrors(e);
    if (Object.keys(e).length) return;
    save.mutate(templatePayload(d));
  };
  const isSms = d.channel === "sms";

  return (
    <Dialog open onOpenChange={(_, x) => !x.open && !save.isPending && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>{template ? `Edit ${template.name}` : `New ${CHANNEL_LABELS[d.channel]} template`}</DialogTitle>
          <DialogContent className={styles.form}>
            {formError && (
              <MessageBar intent="error" layout="multiline">
                <MessageBarBody>{formError}</MessageBarBody>
              </MessageBar>
            )}
            <div className={styles.grid2}>
              <Field label="Name" required validationMessage={errors.name || undefined}>
                <Input value={d.name} onChange={(_, x) => set("name", x.value)} maxLength={120} />
              </Field>
              <Field label="Key" required hint="Used by workflows, e.g. timesheet_reminder" validationMessage={errors.key || undefined}>
                <Input value={d.key} onChange={(_, x) => set("key", x.value)} maxLength={64} disabled={!!template} />
              </Field>
              <Field label="Purpose" hint="Transactional only — no marketing">
                <Dropdown
                  value={PURPOSE_LABELS[d.purpose]}
                  selectedOptions={[d.purpose]}
                  onOptionSelect={(_, x) => set("purpose", x.optionValue as TemplateDraft["purpose"])}
                >
                  {TEMPLATE_PURPOSES.map((p) => (
                    <Option key={p} value={p}>
                      {PURPOSE_LABELS[p]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Status">
                <Dropdown
                  value={STATUS_OPTIONS.find((s) => s.value === d.status)?.label}
                  selectedOptions={[d.status]}
                  onOptionSelect={(_, x) => set("status", x.optionValue as TemplateStatus)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <Option key={s.value} value={s.value}>
                      {s.label}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field
                label={isSms ? "DLT template ID" : "Approved template name"}
                hint={isSms ? "19 digits, from your DLT portal" : "As approved in WhatsApp Manager"}
                validationMessage={errors.provider_template_ref || undefined}
              >
                <Input value={d.provider_template_ref ?? ""} onChange={(_, x) => set("provider_template_ref", x.value)} maxLength={isSms ? 19 : 512} />
              </Field>
              {isSms ? (
                <Field label="Sender ID (header)" hint="6 characters, e.g. TALNOS" validationMessage={errors.sender_id || undefined}>
                  <Input value={d.sender_id ?? ""} onChange={(_, x) => set("sender_id", x.value)} maxLength={6} />
                </Field>
              ) : (
                <Field label="Language" hint="e.g. en, en_US, hi">
                  <Input value={d.language} onChange={(_, x) => set("language", x.value)} maxLength={10} />
                </Field>
              )}
            </div>
            <Field
              label="Message"
              required
              validationMessage={errors.body || undefined}
              hint={
                isSms
                  ? `${d.body.length}/${SMS_MAX_LENGTH} characters. The text must match the registered DLT template exactly.`
                  : "Must match the approved WhatsApp template. Merge fields fill its variables in order."
              }
            >
              <Textarea
                ref={bodyRef}
                className={styles.body}
                value={d.body}
                onChange={(_, x) => set("body", x.value)}
                rows={6}
                resize="vertical"
                maxLength={isSms ? SMS_MAX_LENGTH + 200 : 4096}
              />
            </Field>
            <Toolbar aria-label="Message tools" size="small">
              <SearchablePicker
                label="Insert field"
                icon={<BracesVariable20Regular />}
                groups={groups}
                loading={fields.isPending}
                onPick={insert}
                searchPlaceholder="Search fields"
                emptyText={fields.isError ? "Merge fields are unavailable." : "No matching fields."}
              />
            </Toolbar>
            {template && <Caption1>Saving a registered template creates version {template.version + 1}.</Caption1>}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button appearance="primary" onClick={submit} disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined}>
              Save
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
