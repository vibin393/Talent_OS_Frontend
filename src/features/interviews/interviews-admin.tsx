"use client";

import {
  Badge,
  Button,
  Card,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Spinner,
  SpinButton,
  Switch,
  Tab,
  TabList,
  type TableColumnDefinition,
  TableCellLayout,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowDown20Regular, ArrowUp20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ConfirmDialog, DetailsDrawer, ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { interviewKeys, interviewsApi } from "./api";
import { KIND_LABELS, STAGE_KINDS } from "./format";
import { KitEditor } from "./kit-editor";
import type { InterviewSettingsOut, KitOut, StageKind, StageTemplateOut, TemplateStage } from "./types";
import { useKits, useStageTemplates } from "./use-interview-plan";

const useStyles = makeStyles({
  tabs: { marginBottom: tokens.spacingVerticalM },
  toolbar: { display: "flex", justifyContent: "flex-end", marginBottom: tokens.spacingVerticalM, gap: tokens.spacingHorizontalS },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, maxWidth: "560px", padding: tokens.spacingHorizontalL },
  stage: {
    display: "grid",
    gridTemplateColumns: "1fr 130px 1fr 100px auto",
    gap: tokens.spacingHorizontalS,
    alignItems: "end",
    padding: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    "@media (max-width: 700px)": { gridTemplateColumns: "1fr 1fr" },
  },
});

type Tabs = "kits" | "templates" | "settings";

/** `/admin/interviews`: interview kits, stage templates and interview settings (reminders, scorecards). */
export function InterviewsAdmin() {
  const styles = useStyles();
  const allowed = usePermission("interview:configure");
  const [tab, setTab] = useState<Tabs>("kits");
  if (!allowed) return <NoAccess what="interview settings" />;
  return (
    <>
      <PageHeader title="Interviews" subtitle="Interview kits with competencies and questions, reusable stage templates, reminders and scorecard settings." />
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as Tabs)} aria-label="Interview settings">
        <Tab value="kits">Interview kits</Tab>
        <Tab value="templates">Stage templates</Tab>
        <Tab value="settings">Reminders &amp; scorecards</Tab>
      </TabList>
      {tab === "kits" && <KitsTab />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "settings" && <SettingsTab />}
    </>
  );
}

function KitsTab() {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const kits = useKits(showArchived);
  const settings = useQuery({ queryKey: interviewKeys.settings, queryFn: ({ signal }) => interviewsApi.settings(signal) });
  const [editing, setEditing] = useState<KitOut | "new" | null>(null);
  const [archiving, setArchiving] = useState<KitOut | null>(null);

  const columns: TableColumnDefinition<KitOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Kit",
      renderCell: (k) => (
        <TableCellLayout truncate description={k.description ?? undefined}>
          {k.name} {k.archived_at && <Badge appearance="outline" color="subtle">Archived</Badge>}
        </TableCellLayout>
      ),
    }),
    createTableColumn({ columnId: "competencies", renderHeaderCell: () => "Competencies", renderCell: (k) => k.competencies.map((c) => c.label).join(", ") }),
    createTableColumn({ columnId: "questions", renderHeaderCell: () => "Questions", renderCell: (k) => k.questions.length }),
    createTableColumn({ columnId: "scale", renderHeaderCell: () => "Scale", renderCell: (k) => `1–${k.rating_scale}` }),
    createTableColumn({ columnId: "version", renderHeaderCell: () => "Version", renderCell: (k) => `v${k.version} · ${formatDateTime(k.updated_at)}` }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (k) =>
        k.archived_at ? null : (
          <Button size="small" appearance="subtle" onClick={(e) => {
              e.stopPropagation();
              setArchiving(k);
            }}>
            Archive
          </Button>
        ),
    }),
  ];

  return (
    <>
      <div className={styles.toolbar}>
        <Switch label="Show archived" checked={showArchived} onChange={(_, d) => setShowArchived(d.checked)} />
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
          New kit
        </Button>
      </div>
      <AdminGrid
        items={kits.data}
        columns={columns}
        getRowId={(k) => k.id}
        loading={kits.isPending}
        error={kits.error}
        emptyText="No interview kits yet. Kits give interviewers competencies to rate and questions to ask."
        label="Interview kits"
        onRowClick={(k) => !k.archived_at && setEditing(k)}
      />
      {editing && <KitEditor kit={editing === "new" ? null : editing} defaultScale={settings.data?.rating_scale ?? 5} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!archiving}
        title={`Archive “${archiving?.name ?? ""}”?`}
        confirmLabel="Archive"
        onClose={() => setArchiving(null)}
        onConfirm={async () => {
          if (!archiving) return;
          try {
            await interviewsApi.archiveKit(archiving.id);
            await qc.invalidateQueries({ queryKey: interviewKeys.kits });
            toast.success(`Archived “${archiving.name}”`);
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        Stages that use it keep working, and scorecards keep their copy of the kit. It can no longer be picked for new stages.
      </ConfirmDialog>
    </>
  );
}

function TemplatesTab() {
  const styles = useStyles();
  const templates = useStageTemplates(false);
  const [editing, setEditing] = useState<StageTemplateOut | "new" | null>(null);
  const columns: TableColumnDefinition<StageTemplateOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Template",
      renderCell: (t) => (
        <TableCellLayout truncate>
          {t.name}{" "}
          {t.is_default && (
            <Badge appearance="tint" color="brand">
              Default
            </Badge>
          )}
        </TableCellLayout>
      ),
    }),
    createTableColumn({
      columnId: "stages",
      renderHeaderCell: () => "Stages",
      renderCell: (t) => <TableCellLayout truncate>{t.stages.map((s) => s.name).join(" → ")}</TableCellLayout>,
    }),
  ];
  return (
    <>
      <div className={styles.toolbar}>
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
          New template
        </Button>
      </div>
      <AdminGrid
        items={templates.data}
        columns={columns}
        getRowId={(t) => t.id}
        loading={templates.isPending}
        error={templates.error}
        emptyText="No stage templates yet."
        label="Stage templates"
        onRowClick={(t) => setEditing(t)}
      />
      {editing && <TemplateDrawer template={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function TemplateDrawer({ template, onClose }: { template: StageTemplateOut | null; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const kits = useKits();
  const [name, setName] = useState(template?.name ?? "");
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false);
  const [stages, setStages] = useState<TemplateStage[]>(template?.stages ?? [{ name: "", kind: "technical", kit_id: null, default_duration_minutes: 60 }]);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), is_default: isDefault, stages: stages.map((s) => ({ ...s, name: s.name.trim() })) };
      return template ? interviewsApi.updateTemplate(template.id, body) : interviewsApi.createTemplate(body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: interviewKeys.templates }),
  });
  const setStage = (i: number, patch: Partial<TemplateStage>) => setStages((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) =>
    setStages((s) => {
      const t = i + d;
      if (t < 0 || t >= s.length) return s;
      const n = [...s];
      [n[i], n[t]] = [n[t], n[i]];
      return n;
    });

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Name the template.");
    if (!stages.length || stages.some((s) => !s.name.trim())) return setError("Every stage needs a name.");
    try {
      await save.mutateAsync();
      toast.success(template ? "Template saved" : "Template created");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <DetailsDrawer
      open
      size="large"
      title={template ? `Edit template · ${template.name}` : "New stage template"}
      onClose={onClose}
      footer={
        <>
          <Button appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
            Save template
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
        <ErrorBar message={error} />
        <Field label="Name" required>
          <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Switch label="Default for new demands" checked={isDefault} onChange={(_, d) => setIsDefault(d.checked)} />
        {stages.map((s, i) => (
          <div key={i} className={styles.stage}>
            <Field label={`Stage ${i + 1}`} size="small">
              <Input size="small" value={s.name} maxLength={200} onChange={(_, d) => setStage(i, { name: d.value })} />
            </Field>
            <Field label="Kind" size="small">
              <Dropdown size="small" value={KIND_LABELS[s.kind ?? "other"]} selectedOptions={[s.kind ?? "other"]} onOptionSelect={(_, d) => setStage(i, { kind: d.optionValue as StageKind })}>
                {STAGE_KINDS.map((k) => (
                  <Option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="Kit" size="small">
              <Dropdown
                size="small"
                value={kits.data?.find((k) => k.id === s.kit_id)?.name ?? "No kit"}
                selectedOptions={[s.kit_id ?? "none"]}
                onOptionSelect={(_, d) => setStage(i, { kit_id: d.optionValue === "none" ? null : (d.optionValue ?? null) })}
              >
                <Option value="none">No kit</Option>
                {(kits.data ?? [])
                  .filter((k) => !k.archived_at)
                  .map((k) => (
                    <Option key={k.id} value={k.id}>
                      {k.name}
                    </Option>
                  ))}
              </Dropdown>
            </Field>
            <Field label="Minutes" size="small">
              <SpinButton
                size="small"
                value={s.default_duration_minutes ?? 60}
                min={15}
                max={480}
                step={15}
                onChange={(_, d) => {
                  const v = d.value ?? Number(d.displayValue);
                  if (Number.isFinite(v)) setStage(i, { default_duration_minutes: Number(v) });
                }}
              />
            </Field>
            <div style={{ display: "flex" }}>
              <Button size="small" appearance="subtle" icon={<ArrowUp20Regular />} aria-label={`Move stage ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} />
              <Button
                size="small"
                appearance="subtle"
                icon={<ArrowDown20Regular />}
                aria-label={`Move stage ${i + 1} down`}
                disabled={i === stages.length - 1}
                onClick={() => move(i, 1)}
              />
              <Button
                size="small"
                appearance="subtle"
                icon={<Delete20Regular />}
                aria-label={`Remove stage ${i + 1}`}
                disabled={stages.length <= 1}
                onClick={() => setStages((x) => x.filter((_, j) => j !== i))}
              />
            </div>
          </div>
        ))}
        <Button
          icon={<Add20Regular />}
          style={{ alignSelf: "flex-start" }}
          disabled={stages.length >= 20}
          onClick={() => setStages((s) => [...s, { name: "", kind: "other", kit_id: null, default_duration_minutes: 60 }])}
        >
          Add stage
        </Button>
      </div>
    </DetailsDrawer>
  );
}

const OFFSET_CHOICES = [10080, 2880, 1440, 240, 120, 60, 30, 15];

function offsetLabel(m: number): string {
  if (m % 1440 === 0) return `${m / 1440} day${m === 1440 ? "" : "s"} before`;
  if (m % 60 === 0) return `${m / 60} hour${m === 60 ? "" : "s"} before`;
  return `${m} minutes before`;
}

function SettingsTab() {
  const q = useQuery({ queryKey: interviewKeys.settings, queryFn: ({ signal }) => interviewsApi.settings(signal) });
  if (q.isPending) return <GridSkeleton rows={4} />;
  if (q.isError) return <ErrorBar title="Could not load settings." message={errorMessage(q.error)} />;
  return <SettingsForm key={JSON.stringify(q.data)} settings={q.data} />;
}

function SettingsForm({ settings }: { settings: InterviewSettingsOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [v, setV] = useState(settings);
  const save = useMutation({
    mutationFn: () => interviewsApi.updateSettings(v),
    onSuccess: (s) => {
      qc.setQueryData(interviewKeys.settings, s);
      toast.success("Interview settings saved");
    },
  });
  const errs = fieldErrors(save.error);
  const num = (key: keyof InterviewSettingsOut, min: number, max: number) => (
    <SpinButton
      value={v[key] as number}
      min={min}
      max={max}
      onChange={(_, d) => {
        const n = d.value ?? Number(d.displayValue);
        if (Number.isFinite(n)) setV((x) => ({ ...x, [key]: Number(n) }));
      }}
    />
  );
  const offsets = [...new Set([...OFFSET_CHOICES, ...v.reminder_offsets_minutes])].sort((a, b) => b - a);
  return (
    <Card className={styles.form}>
      <ErrorBar message={save.error && !Object.keys(errs).length ? errorMessage(save.error) : null} />
      <Field label="Reminders to candidate and interviewers" hint="Up to 5. Sent by email in each recipient's time zone." validationMessage={errs.reminder_offsets_minutes}>
        <Dropdown
          multiselect
          value={v.reminder_offsets_minutes
            .slice()
            .sort((a, b) => b - a)
            .map(offsetLabel)
            .join(", ")}
          selectedOptions={v.reminder_offsets_minutes.map(String)}
          onOptionSelect={(_, d) => setV((x) => ({ ...x, reminder_offsets_minutes: d.selectedOptions.map(Number).slice(0, 5) }))}
        >
          {offsets.map((m) => (
            <Option key={m} value={String(m)}>
              {offsetLabel(m)}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Field label="Scorecard reminder after (hours)" hint="One reminder to interviewers who have not submitted after the interview ends." validationMessage={errs.scorecard_reminder_after_hours}>
        {num("scorecard_reminder_after_hours", 1, 720)}
      </Field>
      <Field label="External scorecard links stay open (days after the interview)" validationMessage={errs.external_scorecard_link_days_after}>
        {num("external_scorecard_link_days_after", 1, 90)}
      </Field>
      <Field label="Default interview length (minutes)" validationMessage={errs.default_duration_minutes}>
        {num("default_duration_minutes", 15, 480)}
      </Field>
      <Field label="Default rating scale for new kits" validationMessage={errs.rating_scale}>
        {num("rating_scale", 3, 10)}
      </Field>
      <div>
        <Button appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => save.mutate()}>
          Save settings
        </Button>
      </div>
    </Card>
  );
}
