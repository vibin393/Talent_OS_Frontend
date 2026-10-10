"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Option,
  SpinButton,
  Subtitle2,
  Switch,
  type TableColumnDefinition,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowDown20Regular, ArrowUp20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DetailsDrawer, IdSelect, type IdOption, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { useTemplates } from "@/features/documents/api";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { onboardingApi, onboardingKeys } from "./api";
import { blankTask, INTERNAL_TYPES, KIND_LABELS, moveTask, TASK_KINDS, templateErrors } from "./logic";
import type { OnboardingTemplate, OwnerKind, TaskKind, TemplateIn, TemplateTask } from "./types";

const useStyles = makeStyles({
  toolbar: { display: "flex", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalM },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: tokens.spacingHorizontalM },
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  task: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, padding: tokens.spacingHorizontalM },
  taskHead: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  grow: { flexGrow: 1 },
  switches: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL },
  matchPreview: { display: "flex", alignItems: "end", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
});

const OWNER_LABELS: Record<OwnerKind, string> = {
  role: "A role",
  placement_account_manager: "Placement account manager",
  placement_recruiter: "Placement recruiter",
  case_owner: "Case owner (HR)",
};
const WORKER_TYPES = ["employee", "contractor", "consultant", "freelancer"];

type Named = { id: string; name: string };

function useOptions() {
  const clients = useQuery({
    queryKey: ["onboarding", "client-options"],
    queryFn: ({ signal }) => api.get<{ items: Named[] }>(`/api/v1/clients?page_size=100`, { signal }),
  });
  const entities = useQuery({
    queryKey: ["onboarding", "le-options"],
    queryFn: ({ signal }) => api.get<Named[]>(`/api/v1/legal-entities`, { signal }),
  });
  const docs = useTemplates(null, false);
  const toOpts = (rows: Named[] | undefined): IdOption[] => (rows ?? []).map((r) => ({ id: r.id, label: r.name }));
  return {
    clients: toOpts(clients.data?.items),
    entities: toOpts(entities.data),
    documents: (docs.data ?? []).filter((t) => t.current_version_id).map((t) => ({ id: t.id, label: `${t.name} (${t.kind})` })),
  };
}

/** `/admin/onboarding/templates`: templates with their match columns, and the task editor. */
export function OnboardingTemplatesAdmin() {
  const styles = useStyles();
  const canConfigure = usePermission("onboarding:configure");
  const [editing, setEditing] = useState<OnboardingTemplate | "new" | null>(null);
  const q = useQuery({
    queryKey: onboardingKeys.templates(false),
    queryFn: ({ signal }) => onboardingApi.templates(false, signal),
    enabled: canConfigure,
  });
  const opts = useOptions();
  if (!canConfigure) return <NoAccess what="onboarding templates" />;
  const name = (list: IdOption[], id: string | null) => (id ? (list.find((o) => o.id === id)?.label ?? "…") : "Any");
  const columns: TableColumnDefinition<OnboardingTemplate>[] = [
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Template", renderCell: (t) => t.name }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (t) => name(opts.clients, t.client_id) }),
    createTableColumn({ columnId: "le", renderHeaderCell: () => "Legal entity", renderCell: (t) => name(opts.entities, t.legal_entity_id) }),
    createTableColumn({ columnId: "wt", renderHeaderCell: () => "Worker type", renderCell: (t) => t.worker_type ?? "Any" }),
    createTableColumn({ columnId: "country", renderHeaderCell: () => "Country", renderCell: (t) => t.country ?? "Any" }),
    createTableColumn({ columnId: "tasks", renderHeaderCell: () => "Tasks", renderCell: (t) => t.tasks.length }),
    createTableColumn({ columnId: "version", renderHeaderCell: () => "Version", renderCell: (t) => `v${t.version}` }),
    createTableColumn({
      columnId: "active",
      renderHeaderCell: () => "Status",
      renderCell: (t) => (
        <Badge appearance="tint" color={t.active ? "success" : "subtle"}>
          {t.active ? "Active" : "Inactive"}
        </Badge>
      ),
    }),
  ];
  return (
    <>
      <PageHeader title="Onboarding templates" subtitle="Checklists matched to new placements by client, legal entity, worker type and country" />
      <div className={styles.toolbar}>
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
          New template
        </Button>
      </div>
      <AdminGrid
        items={q.data}
        columns={columns}
        getRowId={(t) => t.id}
        loading={q.isPending}
        error={q.error}
        emptyText="No onboarding templates yet."
        label="Onboarding templates"
        onRowClick={(t) => setEditing(t)}
      />
      {editing && <TemplateEditor key={editing === "new" ? "new" : editing.id} template={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function TemplateEditor({ template, onClose }: { template: OnboardingTemplate | null; onClose: () => void }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const opts = useOptions();
  const [form, setForm] = useState<TemplateIn>(() => ({
    name: template?.name ?? "",
    legal_entity_id: template?.legal_entity_id ?? null,
    client_id: template?.client_id ?? null,
    worker_type: template?.worker_type ?? null,
    country: template?.country ?? null,
    active: template?.active ?? true,
    tasks: template?.tasks.map((t) => ({ ...t, id: undefined, assignee: undefined, position: undefined })) ?? [],
  }));
  const [errors, setErrors] = useState<string[]>([]);
  const [newKind, setNewKind] = useState<TaskKind>("personal_details");
  const [previewId, setPreviewId] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      if (!template) return onboardingApi.createTemplate(form);
      const { tasks, ...fields } = form;
      await onboardingApi.patchTemplate(template.id, fields);
      return onboardingApi.putTasks(template.id, tasks);
    },
    onSuccess: () => {
      toast.success("Template saved");
      void qc.invalidateQueries({ queryKey: onboardingKeys.all });
      onClose();
    },
    onError: (e) => setErrors([errorMessage(e)]),
  });
  const archive = useMutation({
    mutationFn: () => onboardingApi.patchTemplate(template!.id, { archived: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: onboardingKeys.all });
      onClose();
    },
    onError: (e) => setErrors([errorMessage(e)]),
  });
  const runPreview = async () => {
    try {
      const r = await onboardingApi.match(previewId.trim());
      setPreview(r.template_name ? `Matches “${r.template_name}”` : "No template matches this placement");
    } catch (e) {
      setPreview(errorMessage(e));
    }
  };
  const setTask = (i: number, patch: Partial<TemplateTask>) =>
    setForm((f) => ({ ...f, tasks: f.tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  const setConfig = (i: number, key: string, value: unknown) =>
    setForm((f) => ({ ...f, tasks: f.tasks.map((t, j) => (j === i ? { ...t, config: { ...t.config, [key]: value } } : t)) }));
  const submit = () => {
    const errs = templateErrors(form.name, form.tasks);
    setErrors(errs);
    if (!errs.length) save.mutate();
  };
  return (
    <DetailsDrawer
      open
      size="large"
      title={template ? `Edit ${template.name}` : "New onboarding template"}
      onClose={onClose}
      footer={
        <>
          <Button appearance="primary" disabled={save.isPending} onClick={submit}>
            Save
          </Button>
          {template && (
            <Button disabled={archive.isPending} onClick={() => archive.mutate()}>
              Archive
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
        </>
      }
    >
      <div className={styles.stack}>
        {errors.length > 0 && (
          <MessageBar intent="error" layout="multiline">
            <MessageBarBody>
              {errors.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </MessageBarBody>
          </MessageBar>
        )}
        <Field label="Name" required>
          <Input value={form.name} onChange={(_, d) => setForm({ ...form, name: d.value })} />
        </Field>
        <Subtitle2>Matches placements with</Subtitle2>
        <div className={styles.grid}>
          <IdSelect label="Client" options={opts.clients} value={form.client_id} noneLabel="Any client" onChange={(v) => setForm({ ...form, client_id: v })} />
          <IdSelect
            label="Legal entity"
            options={opts.entities}
            value={form.legal_entity_id}
            noneLabel="Any legal entity"
            onChange={(v) => setForm({ ...form, legal_entity_id: v })}
          />
          <Field label="Worker type">
            <Dropdown
              value={form.worker_type ?? "Any"}
              selectedOptions={[form.worker_type ?? ""]}
              onOptionSelect={(_, d) => setForm({ ...form, worker_type: d.optionValue || null })}
            >
              <Option value="">Any</Option>
              {WORKER_TYPES.map((w) => (
                <Option key={w} value={w}>
                  {w}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Country (ISO code)">
            <Input
              value={form.country ?? ""}
              maxLength={2}
              placeholder="Any"
              onChange={(_, d) => setForm({ ...form, country: d.value.toUpperCase() || null })}
            />
          </Field>
        </div>
        <Switch checked={form.active} label="Active" onChange={(_, d) => setForm({ ...form, active: d.checked })} />
        <Subtitle2>Tasks</Subtitle2>
        {form.tasks.length === 0 && <Body1>No tasks yet. Add the first one below.</Body1>}
        {form.tasks.map((t, i) => (
          <Card key={`${t.key}-${i}`} className={styles.task}>
            <div className={styles.taskHead}>
              <Badge appearance="tint">{KIND_LABELS[t.kind]}</Badge>
              <Input className={styles.grow} aria-label="Label" value={t.label} onChange={(_, d) => setTask(i, { label: d.value })} />
              <Button aria-label="Move up" icon={<ArrowUp20Regular />} disabled={i === 0} onClick={() => setForm({ ...form, tasks: moveTask(form.tasks, i, i - 1) })} />
              <Button
                aria-label="Move down"
                icon={<ArrowDown20Regular />}
                disabled={i === form.tasks.length - 1}
                onClick={() => setForm({ ...form, tasks: moveTask(form.tasks, i, i + 1) })}
              />
              <Button aria-label="Remove" icon={<Delete20Regular />} onClick={() => setForm({ ...form, tasks: form.tasks.filter((_, j) => j !== i) })} />
            </div>
            <div className={styles.grid}>
              <Field label="Key">
                <Input value={t.key} onChange={(_, d) => setTask(i, { key: d.value })} />
              </Field>
              <Field label="Due (days from start; negative = before)">
                <SpinButton value={t.due_offset_days} min={-365} max={365} onChange={(_, d) => setTask(i, { due_offset_days: Number(d.value ?? d.displayValue ?? 0) || 0 })} />
              </Field>
              <TaskConfig task={t} index={i} documents={opts.documents} setTask={setTask} setConfig={setConfig} />
            </div>
            <Field label="Instructions">
              <Textarea value={t.instructions ?? ""} onChange={(_, d) => setTask(i, { instructions: d.value || null })} resize="vertical" />
            </Field>
            <div className={styles.switches}>
              <Switch checked={t.mandatory} label="Mandatory" onChange={(_, d) => setTask(i, { mandatory: d.checked })} />
              <Switch checked={t.auto_approve} label="Auto-approve" onChange={(_, d) => setTask(i, { auto_approve: d.checked })} />
              <Switch
                checked={t.reusable}
                disabled={t.kind === "esign" || t.kind === "internal"}
                label="Reuse for returning workers"
                onChange={(_, d) => setTask(i, { reusable: d.checked })}
              />
            </div>
          </Card>
        ))}
        <div className={styles.taskHead}>
          <Dropdown aria-label="Task kind" value={KIND_LABELS[newKind]} selectedOptions={[newKind]} onOptionSelect={(_, d) => setNewKind(d.optionValue as TaskKind)}>
            {TASK_KINDS.map((k) => (
              <Option key={k} value={k}>
                {KIND_LABELS[k]}
              </Option>
            ))}
          </Dropdown>
          <Button icon={<Add20Regular />} onClick={() => setForm({ ...form, tasks: [...form.tasks, blankTask(newKind, form.tasks.length)] })}>
            Add task
          </Button>
        </div>
        {template && (
          <>
            <Subtitle2>Preview</Subtitle2>
            <div className={mergeClasses(styles.matchPreview)}>
              <Field label="Placement id">
                <Input value={previewId} onChange={(_, d) => setPreviewId(d.value)} />
              </Field>
              <Button disabled={!previewId.trim()} onClick={() => void runPreview()}>
                Which template matches?
              </Button>
            </div>
            {preview && <Caption1>{preview}</Caption1>}
          </>
        )}
      </div>
    </DetailsDrawer>
  );
}

function TaskConfig({
  task,
  index,
  documents,
  setTask,
  setConfig,
}: {
  task: TemplateTask;
  index: number;
  documents: IdOption[];
  setTask: (i: number, patch: Partial<TemplateTask>) => void;
  setConfig: (i: number, key: string, value: unknown) => void;
}) {
  const cfg = task.config;
  switch (task.kind) {
    case "esign":
    case "policy_ack":
      return (
        <IdSelect
          label="Document template"
          options={documents}
          value={(cfg.document_template_id as string) ?? null}
          noneLabel="Pick a template"
          onChange={(v) => setConfig(index, "document_template_id", v)}
        />
      );
    case "document_upload":
      return (
        <>
          <Field label="Document category">
            <Input value={String(cfg.document_category ?? "")} onChange={(_, d) => setConfig(index, "document_category", d.value)} />
          </Field>
          <Switch checked={Boolean(cfg.aadhaar)} label="Masked Aadhaar capture" onChange={(_, d) => setConfig(index, "aadhaar", d.checked)} />
        </>
      );
    case "credential":
      return (
        <Field label="Credential type key">
          <Input value={String(cfg.credential_type_key ?? "")} onChange={(_, d) => setConfig(index, "credential_type_key", d.value)} />
        </Field>
      );
    case "tax_details":
      return (
        <Field label="Investment declaration">
          <Dropdown
            value={String(cfg.declaration_mode ?? "either")}
            selectedOptions={[String(cfg.declaration_mode ?? "either")]}
            onOptionSelect={(_, d) => setConfig(index, "declaration_mode", d.optionValue)}
          >
            <Option value="form">Form</Option>
            <Option value="upload">Upload</Option>
            <Option value="either">Either</Option>
          </Dropdown>
        </Field>
      );
    case "client_form":
      return (
        <Field label="Form fields (JSON)" hint='e.g. [{"name":"badge_photo","type":"file","required":true}]'>
          <Textarea
            defaultValue={JSON.stringify(cfg.fields ?? [])}
            onBlur={(e) => {
              try {
                setConfig(index, "fields", JSON.parse(e.currentTarget.value));
              } catch {
                /* invalid JSON is reported by the server on save */
              }
            }}
          />
        </Field>
      );
    case "internal":
      return (
        <>
          <Field label="Internal type">
            <Dropdown
              value={String(cfg.internal_type ?? "other")}
              selectedOptions={[String(cfg.internal_type ?? "other")]}
              onOptionSelect={(_, d) => setConfig(index, "internal_type", d.optionValue)}
            >
              {INTERNAL_TYPES.map((x) => (
                <Option key={x} value={x}>
                  {x.replace(/_/g, " ")}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Owner">
            <Dropdown
              value={task.owner_kind ? OWNER_LABELS[task.owner_kind] : ""}
              selectedOptions={task.owner_kind ? [task.owner_kind] : []}
              onOptionSelect={(_, d) => setTask(index, { owner_kind: d.optionValue as OwnerKind })}
            >
              {(Object.keys(OWNER_LABELS) as OwnerKind[]).map((k) => (
                <Option key={k} value={k}>
                  {OWNER_LABELS[k]}
                </Option>
              ))}
            </Dropdown>
          </Field>
          {task.owner_kind === "role" && (
            <Field label="Role key">
              <Input value={task.owner_role_key ?? ""} onChange={(_, d) => setTask(index, { owner_role_key: d.value || null })} />
            </Field>
          )}
        </>
      );
    default:
      return null;
  }
}
