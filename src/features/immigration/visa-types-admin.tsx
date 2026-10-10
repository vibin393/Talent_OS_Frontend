"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardFooter,
  CardHeader,
  Checkbox,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Subtitle2,
  Switch,
  Tab,
  TabList,
  type TableColumnDefinition,
  Tag,
  TagGroup,
  Text,
  Textarea,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import { Add20Regular, ArrowDown16Regular, ArrowLeft20Regular, ArrowUp16Regular, Delete16Regular } from "@fluentui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { ErrorBar, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { immigrationApi } from "./api";
import {
  addOffset,
  cleanDefinition,
  COLLECT_FROM_LABELS,
  countryName,
  type DefinitionIssue,
  DISCLAIMER,
  emptyDefinition,
  formatDate,
  setPrimary,
  STAGE_CATEGORIES,
  STAGE_CATEGORY_LABELS,
  validateDefinition,
} from "./logic";
import type {
  AppliesTo,
  CollectFrom,
  CounselOut,
  StageCategory,
  VisaCategory,
  VisaTemplateOut,
  VisaTypeDefinition,
  VisaTypeDetailOut,
  VisaTypeOut,
} from "./types";
import { DialogShell, useAction } from "./ui";
import { immigrationKeys, useCounsel, useImmigrationPermissions, useVisaTemplates, useVisaType, useVisaTypes } from "./use-immigration";

const useStyles = makeStyles({
  gallery: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: tokens.spacingHorizontalM },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  muted: { color: tokens.colorNeutralForeground3 },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalXL },
  rows: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  row: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  key: { width: "160px" },
  label: { flex: "1 1 200px", minWidth: "160px" },
  small: { width: "110px" },
  medium: { minWidth: "150px" },
  rowButtons: { display: "flex", gap: tokens.spacingHorizontalXXS, marginLeft: "auto" },
  checkbox: { paddingBottom: tokens.spacingVerticalXS },
  offsets: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: tokens.spacingHorizontalM },
  issues: { margin: 0, paddingLeft: tokens.spacingHorizontalL },
  headerRow: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: tokens.spacingHorizontalM },
  meta: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalL },
});

const CATEGORIES: VisaCategory[] = ["work", "dependent", "business_travel"];
const CATEGORY_LABELS: Record<string, string> = { work: "Work", dependent: "Dependent", business_travel: "Business travel" };
const APPLIES_TO: AppliesTo[] = ["principal", "dependant", "employer", "counsel"];
const COLLECT_FROM: CollectFrom[] = ["worker", "counsel", "internal"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** `/settings/immigration`: visa types (definition editor, versions), platform templates and the counsel directory. */
export function ImmigrationSettings() {
  const { canRead, canConfigure } = useImmigrationPermissions();
  const [tab, setTab] = useState("types");
  const [editing, setEditing] = useState<string | null>(null);
  if (!canRead) return <NoAccess what="immigration settings" />;
  if (editing) return <VisaTypeEditor id={editing} canConfigure={canConfigure} onBack={() => setEditing(null)} />;
  return (
    <>
      <PageHeader title="Immigration settings" subtitle="Visa types, platform templates and immigration counsel" />
      <MessageBar intent="warning" layout="multiline">
        <MessageBarBody>{DISCLAIMER}</MessageBarBody>
      </MessageBar>
      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))}>
        <Tab value="types">Visa types</Tab>
        <Tab value="templates">Template gallery</Tab>
        <Tab value="counsel">Counsel</Tab>
      </TabList>
      {tab === "types" && <VisaTypesList canConfigure={canConfigure} onOpen={setEditing} />}
      {tab === "templates" && <TemplateGallery canConfigure={canConfigure} onOpen={setEditing} />}
      {tab === "counsel" && <CounselDirectory canConfigure={canConfigure} />}
    </>
  );
}

// ---------------------------------------------------------------- visa types list
function VisaTypesList({ canConfigure, onOpen }: { canConfigure: boolean; onOpen: (id: string) => void }) {
  const admin = useAdminStyles();
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const list = useVisaTypes(archived);
  const columns: TableColumnDefinition<VisaTypeOut>[] = [
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Visa type", renderCell: (v) => v.name, compare: (a, b) => a.name.localeCompare(b.name) }),
    createTableColumn({ columnId: "country", renderHeaderCell: () => "Country", renderCell: (v) => `${countryName(v.country)} (${v.country})` }),
    createTableColumn({ columnId: "category", renderHeaderCell: () => "Category", renderCell: (v) => CATEGORY_LABELS[v.category] ?? v.category }),
    createTableColumn({ columnId: "version", renderHeaderCell: () => "Version", renderCell: (v) => (v.current_version_no != null ? `v${v.current_version_no}` : "—") }),
    createTableColumn({ columnId: "reviewed", renderHeaderCell: () => "Last reviewed", renderCell: (v) => formatDate(v.last_reviewed ?? v.template_last_reviewed) }),
    createTableColumn({ columnId: "open", renderHeaderCell: () => "Open cases", renderCell: (v) => v.open_cases }),
    createTableColumn({
      columnId: "state",
      renderHeaderCell: () => "State",
      renderCell: (v) =>
        v.archived_at ? (
          <Badge appearance="tint" color="subtle">
            Archived
          </Badge>
        ) : v.active ? (
          <Badge appearance="tint" color="success">
            Active
          </Badge>
        ) : (
          <Badge appearance="tint" color="warning">
            Inactive
          </Badge>
        ),
    }),
  ];
  return (
    <>
      <div className={admin.toolbar}>
        {canConfigure && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New visa type
          </Button>
        )}
        <Switch label="Show archived" checked={archived} onChange={(_, d) => setArchived(d.checked)} />
      </div>
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(v) => v.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No visa types yet. Adopt one from the template gallery or create your own."
        label="Visa types"
        sortable
        onRowClick={(v) => onOpen(v.id)}
      />
      {creating && <CreateVisaTypeDialog onClose={() => setCreating(false)} onCreated={onOpen} />}
    </>
  );
}

function CreateVisaTypeDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState<VisaCategory>("work");
  const { error, busy, run } = useAction(() => void qc.invalidateQueries({ queryKey: ["immigration", "visa-types"] }), onClose);
  const keyInvalid = key !== "" && !/^[a-z][a-z0-9_]{1,49}$/.test(key);
  const countryInvalid = country !== "" && !/^[A-Z]{2}$/.test(country);
  return (
    <DialogShell
      title="New visa type"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            appearance="primary"
            disabled={busy || !key || !name.trim() || !country || keyInvalid || countryInvalid}
            onClick={() =>
              void run(async () => {
                const v = await immigrationApi.createVisaType({ key, name: name.trim(), country, category, definition: cleanDefinition(emptyDefinition()) });
                onCreated(v.id);
              })
            }
          >
            Create
          </Button>
        </>
      }
    >
      <div className={admin.form}>
        <Field label="Name" required>
          <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Field label="Key" required hint="Lowercase, e.g. ie_critical_skills" validationMessage={keyInvalid ? "2–50 lowercase letters, digits or underscores, starting with a letter." : undefined}>
          <Input value={key} maxLength={50} onChange={(_, d) => setKey(d.value)} />
        </Field>
        <Field label="Country" required hint="ISO code, e.g. IE" validationMessage={countryInvalid ? "Use a 2-letter country code." : undefined}>
          <Input value={country} maxLength={2} onChange={(_, d) => setCountry(d.value.toUpperCase())} />
        </Field>
        <Field label="Category" required>
          <Dropdown value={CATEGORY_LABELS[category]} selectedOptions={[category]} onOptionSelect={(_, d) => setCategory(d.optionValue as VisaCategory)}>
            {CATEGORIES.map((c) => (
              <Option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Caption1>The visa type starts with one stage and one primary expiry field; edit the definition next.</Caption1>
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}

// ---------------------------------------------------------------- template gallery
function TemplateGallery({ canConfigure, onOpen }: { canConfigure: boolean; onOpen: (id: string) => void }) {
  const styles = useStyles();
  const templates = useVisaTemplates();
  const [adopting, setAdopting] = useState<VisaTemplateOut | null>(null);
  if (templates.isPending) return <Body1>Loading…</Body1>;
  if (templates.isError) return <ErrorBar title="Could not load templates." message={errorMessage(templates.error)} />;
  return (
    <>
      <div className={styles.gallery}>
        {templates.data.map((t) => (
          <Card key={t.key} className={styles.card}>
            <CardHeader
              header={<Subtitle2 as="h2">{t.name}</Subtitle2>}
              description={
                <Caption1>
                  {countryName(t.country)} · {CATEGORY_LABELS[t.category] ?? t.category} · template v{t.template_version}
                </Caption1>
              }
            />
            <Text weight="semibold">Last reviewed {formatDate(t.last_reviewed)}</Text>
            <Caption1 className={styles.muted}>{t.notice}</Caption1>
            <Caption1>
              {t.definition.stages.length} stages · {t.definition.checklist.length} checklist items · alerts at {t.definition.alert_offsets.join(", ")} days
            </Caption1>
            <CardFooter>
              {t.adopted_visa_type_id ? (
                <>
                  <Badge appearance="tint" color="success">
                    Adopted
                  </Badge>
                  <Button size="small" onClick={() => onOpen(t.adopted_visa_type_id ?? "")}>
                    Open
                  </Button>
                </>
              ) : (
                canConfigure && (
                  <Button appearance="primary" onClick={() => setAdopting(t)}>
                    Adopt
                  </Button>
                )
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
      {adopting && <AdoptDialog template={adopting} onClose={() => setAdopting(null)} onAdopted={onOpen} />}
    </>
  );
}

function AdoptDialog({ template, onClose, onAdopted }: { template: VisaTemplateOut; onClose: () => void; onAdopted: (id: string) => void }) {
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const [name, setName] = useState(template.name);
  const [key, setKey] = useState("");
  const keyInvalid = key !== "" && !/^[a-z][a-z0-9_]{1,49}$/.test(key);
  const { error, busy, run } = useAction(
    () => void qc.invalidateQueries({ queryKey: immigrationKeys.all }),
    onClose,
    (e) => (isApiError(e) && e.code === "visa_type_exists" ? "A visa type with this key already exists. Choose another key." : null),
  );
  return (
    <DialogShell
      title={`Adopt ${template.name}`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            appearance="primary"
            disabled={busy || !name.trim() || keyInvalid}
            onClick={() =>
              void run(async () => {
                const v = await immigrationApi.adopt(template.key, {
                  ...(name.trim() !== template.name ? { name: name.trim() } : {}),
                  ...(key ? { key } : {}),
                });
                onAdopted(v.id);
              })
            }
          >
            Adopt
          </Button>
        </>
      }
    >
      <div className={admin.form}>
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            Last reviewed {formatDate(template.last_reviewed)}. {template.notice}
          </MessageBarBody>
        </MessageBar>
        <Field label="Name" required>
          <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Field label="Key (optional)" hint="Defaults to the template key." validationMessage={keyInvalid ? "2–50 lowercase letters, digits or underscores." : undefined}>
          <Input value={key} maxLength={50} onChange={(_, d) => setKey(d.value)} />
        </Field>
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}

// ---------------------------------------------------------------- visa type editor
function definitionError(e: unknown): string | null {
  if (!isApiError(e)) return null;
  if (e.code === "visa_stage_category_invalid") return "Every stage needs a category: Preparing, Filed or Pending decision.";
  if (e.code === "visa_definition_invalid") return e.message || "The definition is not valid.";
  return null;
}

function VisaTypeEditor({ id, canConfigure, onBack }: { id: string; canConfigure: boolean; onBack: () => void }) {
  const q = useVisaType(id);
  if (q.isPending) return <Body1>Loading…</Body1>;
  if (q.isError) return <ErrorBar title="Could not load the visa type." message={errorMessage(q.error)} />;
  return <VisaTypeEditorLoaded key={`${q.data.id}:${q.data.current_version_no}`} v={q.data} canConfigure={canConfigure} onBack={onBack} />;
}

function VisaTypeEditorLoaded({ v, canConfigure, onBack }: { v: VisaTypeDetailOut; canConfigure: boolean; onBack: () => void }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const [def, setDef] = useState<VisaTypeDefinition>(v.definition);
  const [name, setName] = useState(v.name);
  const [reviewed, setReviewed] = useState(v.last_reviewed ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: immigrationKeys.visaType(v.id) });
    void qc.invalidateQueries({ queryKey: ["immigration", "visa-types"] });
  };
  const meta = useAction(refresh, () => undefined);
  const save = useAction(refresh, () => undefined, definitionError);
  const issues = validateDefinition(def);
  const readOnly = !canConfigure || Boolean(v.archived_at);
  const dirty = JSON.stringify(cleanDefinition(def)) !== JSON.stringify(cleanDefinition(v.definition));
  return (
    <>
      <Button appearance="subtle" icon={<ArrowLeft20Regular />} onClick={onBack}>
        Immigration settings
      </Button>
      <div className={styles.headerRow}>
        <PageHeader
          title={v.name}
          subtitle={`${countryName(v.country)} · ${CATEGORY_LABELS[v.category] ?? v.category} · version ${v.current_version_no ?? "—"} · ${v.open_cases} open case(s)`}
        />
        {v.archived_at ? (
          <Badge appearance="tint" color="subtle">
            Archived
          </Badge>
        ) : null}
      </div>
      <MessageBar intent="warning" layout="multiline">
        <MessageBarBody>
          {v.template_last_reviewed ? `Template last reviewed ${formatDate(v.template_last_reviewed)}. ` : ""}
          {v.disclaimer}
        </MessageBarBody>
      </MessageBar>
      <div className={styles.meta}>
        <Field label="Name">
          <Input value={name} disabled={readOnly} maxLength={200} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Field label="Last reviewed">
          <Input type="date" value={reviewed} disabled={readOnly} onChange={(_, d) => setReviewed(d.value)} />
        </Field>
        {!readOnly && (
          <>
            <Button
              disabled={meta.busy || (name.trim() === v.name && reviewed === (v.last_reviewed ?? "")) || !name.trim()}
              onClick={() => void meta.run(() => immigrationApi.patchVisaType(v.id, { name: name.trim(), ...(reviewed ? { last_reviewed: reviewed } : {}) }))}
            >
              Save details
            </Button>
            <Switch
              label="Active (new cases allowed)"
              checked={v.active}
              disabled={meta.busy}
              onChange={(_, d) => void meta.run(() => immigrationApi.patchVisaType(v.id, { active: d.checked }))}
            />
            <Button disabled={meta.busy} onClick={() => void meta.run(() => immigrationApi.archiveVisaType(v.id))}>
              Archive
            </Button>
          </>
        )}
      </div>
      <ErrorBar message={meta.error} />
      <DefinitionEditor def={def} onChange={setDef} readOnly={readOnly} issues={issues} />
      {!readOnly && (
        <div className={admin.toolbar}>
          <Button
            appearance="primary"
            disabled={save.busy || issues.length > 0 || !dirty}
            onClick={() =>
              void save.run(async () => {
                const out = await immigrationApi.saveDefinition(v.id, cleanDefinition(def));
                setSaved(`Saved as version ${out.current_version_no ?? ""}. Open cases keep the version they were opened on.`);
              })
            }
          >
            Save as new version
          </Button>
          <Button disabled={!dirty} onClick={() => setDef(v.definition)}>
            Discard changes
          </Button>
        </div>
      )}
      {saved && (
        <MessageBar intent="success" role="status">
          <MessageBarBody>{saved}</MessageBarBody>
        </MessageBar>
      )}
      <ErrorBar message={save.error} />
      <Subtitle2 as="h2">Versions</Subtitle2>
      <ul>
        {v.versions.map((ver) => (
          <li key={ver.id}>
            v{ver.version_no} · {formatDate(ver.created_at)}
          </li>
        ))}
      </ul>
    </>
  );
}

function issueFor(issues: DefinitionIssue[], path: string): string | undefined {
  return issues.find((i) => i.path === path)?.message;
}

function move<T>(list: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function RowButtons({ label, index, count, onMove, onRemove, disabled }: { label: string; index: number; count: number; onMove?: (d: number) => void; onRemove: () => void; disabled?: boolean }) {
  const styles = useStyles();
  return (
    <span className={styles.rowButtons}>
      {onMove && (
        <>
          <Tooltip content={`Move ${label} up`} relationship="label">
            <Button size="small" appearance="subtle" icon={<ArrowUp16Regular />} disabled={disabled || index === 0} onClick={() => onMove(-1)} />
          </Tooltip>
          <Tooltip content={`Move ${label} down`} relationship="label">
            <Button size="small" appearance="subtle" icon={<ArrowDown16Regular />} disabled={disabled || index === count - 1} onClick={() => onMove(1)} />
          </Tooltip>
        </>
      )}
      <Tooltip content={`Remove ${label}`} relationship="label">
        <Button size="small" appearance="subtle" icon={<Delete16Regular />} disabled={disabled} onClick={onRemove} />
      </Tooltip>
    </span>
  );
}

/** Definition editor: stages (category Dropdown), checklist table, expiry fields (one primary), alert offset chips, key dates. */
export function DefinitionEditor({
  def,
  onChange,
  readOnly,
  issues,
}: {
  def: VisaTypeDefinition;
  onChange: (def: VisaTypeDefinition) => void;
  readOnly: boolean;
  issues: DefinitionIssue[];
}) {
  const styles = useStyles();
  const [offsetDraft, setOffsetDraft] = useState("");
  const [offsetError, setOffsetError] = useState<string | null>(null);
  const set = (patch: Partial<VisaTypeDefinition>) => onChange({ ...def, ...patch });
  const sectionIssue = (path: string) => issueFor(issues, path);
  const addOffsetNow = () => {
    const r = addOffset(def.alert_offsets, offsetDraft);
    if ("error" in r) setOffsetError(r.error);
    else {
      setOffsetError(null);
      setOffsetDraft("");
      set({ alert_offsets: r.offsets });
    }
  };
  return (
    <>
      {issues.length > 0 && !readOnly && (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>
            Fix {issues.length} problem(s) before saving.
            <ul className={styles.issues}>
              {issues.slice(0, 6).map((i) => (
                <li key={`${i.path}:${i.message}`}>{i.message}</li>
              ))}
            </ul>
          </MessageBarBody>
        </MessageBar>
      )}
      {/* stages */}
      <section className={styles.section} aria-labelledby="def-stages">
        <Subtitle2 as="h2" id="def-stages">
          Stages
        </Subtitle2>
        {sectionIssue("stages") && <Caption1 role="alert">{sectionIssue("stages")}</Caption1>}
        <div className={styles.rows}>
          {def.stages.map((s, i) => {
            const upd = (patch: Partial<typeof s>) => set({ stages: def.stages.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className={styles.row}>
                <Field label="Key" className={styles.key} validationMessage={issueFor(issues, `stages.${i}.key`)}>
                  <Input value={s.key} disabled={readOnly} onChange={(_, d) => upd({ key: d.value })} />
                </Field>
                <Field label="Label" className={styles.label} validationMessage={issueFor(issues, `stages.${i}.label`)}>
                  <Input value={s.label} disabled={readOnly} onChange={(_, d) => upd({ label: d.value })} />
                </Field>
                <Field label="Category" className={styles.medium} validationMessage={issueFor(issues, `stages.${i}.category`)}>
                  <Dropdown
                    disabled={readOnly}
                    value={STAGE_CATEGORY_LABELS[s.category as StageCategory] ?? s.category}
                    selectedOptions={[s.category]}
                    onOptionSelect={(_, d) => upd({ category: String(d.optionValue) })}
                  >
                    {STAGE_CATEGORIES.map((c) => (
                      <Option key={c} value={c}>
                        {STAGE_CATEGORY_LABELS[c]}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="SLA (days)" className={styles.small} validationMessage={issueFor(issues, `stages.${i}.sla_days`)}>
                  <Input
                    type="number"
                    min={1}
                    max={730}
                    disabled={readOnly}
                    value={s.sla_days ? String(s.sla_days) : ""}
                    onChange={(_, d) => upd({ sla_days: d.value ? Number(d.value) : null })}
                  />
                </Field>
                {!readOnly && (
                  <RowButtons
                    label={s.label || "stage"}
                    index={i}
                    count={def.stages.length}
                    onMove={(delta) => set({ stages: move(def.stages, i, delta) })}
                    onRemove={() => set({ stages: def.stages.filter((_, j) => j !== i) })}
                  />
                )}
              </div>
            );
          })}
        </div>
        {!readOnly && (
          <div>
            <Button icon={<Add20Regular />} onClick={() => set({ stages: [...def.stages, { key: "", label: "", category: "preparing" }] })}>
              Add stage
            </Button>
          </div>
        )}
      </section>

      {/* checklist */}
      <section className={styles.section} aria-labelledby="def-checklist">
        <Subtitle2 as="h2" id="def-checklist">
          Document checklist
        </Subtitle2>
        {def.checklist.length === 0 && <Caption1 className={styles.muted}>No checklist items.</Caption1>}
        <div className={styles.rows}>
          {def.checklist.map((c, i) => {
            const upd = (patch: Partial<typeof c>) => set({ checklist: def.checklist.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className={styles.row}>
                <Field label="Key" className={styles.key} validationMessage={issueFor(issues, `checklist.${i}.key`)}>
                  <Input value={c.key} disabled={readOnly} onChange={(_, d) => upd({ key: d.value })} />
                </Field>
                <Field label="Label" className={styles.label} validationMessage={issueFor(issues, `checklist.${i}.label`)}>
                  <Input value={c.label} disabled={readOnly} onChange={(_, d) => upd({ label: d.value })} />
                </Field>
                <Field label="Document category" className={styles.key} validationMessage={issueFor(issues, `checklist.${i}.document_category`)}>
                  <Input value={c.document_category} maxLength={40} disabled={readOnly} onChange={(_, d) => upd({ document_category: d.value })} />
                </Field>
                <Field label="Applies to" className={styles.medium}>
                  <Dropdown disabled={readOnly} value={cap(c.applies_to)} selectedOptions={[c.applies_to]} onOptionSelect={(_, d) => upd({ applies_to: d.optionValue as AppliesTo })}>
                    {APPLIES_TO.map((a) => (
                      <Option key={a} value={a}>
                        {cap(a)}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="Collect from" className={styles.medium}>
                  <Dropdown
                    disabled={readOnly}
                    value={COLLECT_FROM_LABELS[c.collect_from]}
                    selectedOptions={[c.collect_from]}
                    onOptionSelect={(_, d) => upd({ collect_from: d.optionValue as CollectFrom })}
                  >
                    {COLLECT_FROM.map((a) => (
                      <Option key={a} value={a}>
                        {COLLECT_FROM_LABELS[a]}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Checkbox className={styles.checkbox} label="Mandatory" disabled={readOnly} checked={c.mandatory} onChange={(_, d) => upd({ mandatory: Boolean(d.checked) })} />
                {!readOnly && (
                  <RowButtons
                    label={c.label || "item"}
                    index={i}
                    count={def.checklist.length}
                    onMove={(delta) => set({ checklist: move(def.checklist, i, delta) })}
                    onRemove={() => set({ checklist: def.checklist.filter((_, j) => j !== i) })}
                  />
                )}
              </div>
            );
          })}
        </div>
        {!readOnly && (
          <div>
            <Button
              icon={<Add20Regular />}
              onClick={() =>
                set({
                  checklist: [...def.checklist, { key: "", label: "", document_category: "immigration", mandatory: true, applies_to: "principal", collect_from: "worker" }],
                })
              }
            >
              Add item
            </Button>
          </div>
        )}
      </section>

      {/* expiry fields */}
      <section className={styles.section} aria-labelledby="def-expiry">
        <Subtitle2 as="h2" id="def-expiry">
          Expiry fields
        </Subtitle2>
        <Caption1 className={styles.muted}>Exactly one field is primary: it becomes the permit expiry and drives the compliance credential.</Caption1>
        {sectionIssue("expiry_fields") && (
          <Caption1 role="alert" className={styles.muted}>
            {sectionIssue("expiry_fields")}
          </Caption1>
        )}
        <RadioGroup
          className={styles.rows}
          aria-label="Primary expiry field"
          disabled={readOnly}
          value={String(def.expiry_fields.findIndex((f) => f.primary))}
          onChange={(_, d) => set({ expiry_fields: setPrimary(def.expiry_fields, Number(d.value)) })}
        >
          {def.expiry_fields.map((f, i) => {
            const upd = (patch: Partial<typeof f>) => set({ expiry_fields: def.expiry_fields.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className={styles.row}>
                <Field label="Key" className={styles.key} validationMessage={issueFor(issues, `expiry_fields.${i}.key`)}>
                  <Input value={f.key} disabled={readOnly} onChange={(_, d) => upd({ key: d.value })} />
                </Field>
                <Field label="Label" className={styles.label} validationMessage={issueFor(issues, `expiry_fields.${i}.label`)}>
                  <Input value={f.label} disabled={readOnly} onChange={(_, d) => upd({ label: d.value })} />
                </Field>
                <Radio className={styles.checkbox} value={String(i)} label="Primary" />
                <Checkbox className={styles.checkbox} label="Required" disabled={readOnly} checked={f.required} onChange={(_, d) => upd({ required: Boolean(d.checked) })} />
                {!readOnly && (
                  <RowButtons label={f.label || "expiry field"} index={i} count={def.expiry_fields.length} onRemove={() => set({ expiry_fields: def.expiry_fields.filter((_, j) => j !== i) })} />
                )}
              </div>
            );
          })}
        </RadioGroup>
        {!readOnly && def.expiry_fields.length < 10 && (
          <div>
            <Button
              icon={<Add20Regular />}
              onClick={() => set({ expiry_fields: [...def.expiry_fields, { key: "", label: "", primary: def.expiry_fields.length === 0, required: false }] })}
            >
              Add expiry field
            </Button>
          </div>
        )}
      </section>

      {/* alert offsets */}
      <section className={styles.section} aria-labelledby="def-offsets">
        <Subtitle2 as="h2" id="def-offsets">
          Expiry alerts (days before expiry)
        </Subtitle2>
        {def.alert_offsets.length === 0 ? (
          <Caption1 className={styles.muted}>No alerts.</Caption1>
        ) : (
          <TagGroup
            aria-label="Alert offsets"
            onDismiss={readOnly ? undefined : (_, d) => set({ alert_offsets: def.alert_offsets.filter((o) => String(o) !== String(d.value)) })}
          >
            {def.alert_offsets.map((o) => (
              <Tag key={o} value={String(o)} dismissible={!readOnly} dismissIcon={{ "aria-label": `Remove ${o} days` }}>
                {o} days
              </Tag>
            ))}
          </TagGroup>
        )}
        {sectionIssue("alert_offsets") && <Caption1 role="alert">{sectionIssue("alert_offsets")}</Caption1>}
        {!readOnly && (
          <div className={styles.offsets}>
            <Field label="Add offset" validationMessage={offsetError ?? undefined} hint="1 to 365 days; kept in descending order.">
              <Input
                className={styles.small}
                type="number"
                min={1}
                max={365}
                value={offsetDraft}
                onChange={(_, d) => setOffsetDraft(d.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOffsetNow();
                  }
                }}
              />
            </Field>
            <Button onClick={addOffsetNow}>Add</Button>
          </div>
        )}
      </section>

      {/* key dates */}
      <section className={styles.section} aria-labelledby="def-keydates">
        <Subtitle2 as="h2" id="def-keydates">
          Key dates
        </Subtitle2>
        {def.key_dates.length === 0 && <Caption1 className={styles.muted}>No key dates.</Caption1>}
        <div className={styles.rows}>
          {def.key_dates.map((k, i) => {
            const upd = (patch: Partial<typeof k>) => set({ key_dates: def.key_dates.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className={styles.row}>
                <Field label="Key" className={styles.key} validationMessage={issueFor(issues, `key_dates.${i}.key`)}>
                  <Input value={k.key} disabled={readOnly} onChange={(_, d) => upd({ key: d.value })} />
                </Field>
                <Field label="Label" className={styles.label} validationMessage={issueFor(issues, `key_dates.${i}.label`)}>
                  <Input value={k.label} disabled={readOnly} onChange={(_, d) => upd({ label: d.value })} />
                </Field>
                {!readOnly && <RowButtons label={k.label || "key date"} index={i} count={def.key_dates.length} onRemove={() => set({ key_dates: def.key_dates.filter((_, j) => j !== i) })} />}
              </div>
            );
          })}
        </div>
        {!readOnly && (
          <div>
            <Button icon={<Add20Regular />} onClick={() => set({ key_dates: [...def.key_dates, { key: "", label: "" }] })}>
              Add key date
            </Button>
          </div>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------- counsel
function CounselDirectory({ canConfigure }: { canConfigure: boolean }) {
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<CounselOut | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useCounsel(archived);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["immigration", "counsel"] });
  const toggleArchive = async (c: CounselOut) => {
    setError(null);
    try {
      await immigrationApi.patchCounsel(c.id, { archived: !c.archived_at });
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const columns: TableColumnDefinition<CounselOut>[] = [
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Name", renderCell: (c) => c.name, compare: (a, b) => a.name.localeCompare(b.name) }),
    createTableColumn({ columnId: "firm", renderHeaderCell: () => "Firm", renderCell: (c) => c.firm ?? "—" }),
    createTableColumn({ columnId: "email", renderHeaderCell: () => "Email", renderCell: (c) => c.email ?? "—" }),
    createTableColumn({ columnId: "phone", renderHeaderCell: () => "Phone", renderCell: (c) => c.phone ?? "—" }),
    createTableColumn({
      columnId: "state",
      renderHeaderCell: () => "State",
      renderCell: (c) =>
        c.archived_at ? (
          <Badge appearance="tint" color="subtle">
            Archived
          </Badge>
        ) : null,
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => <span className={admin.muted}>Actions</span>,
      renderCell: (c) => (
        <RowActions
          label={c.name}
          actions={
            canConfigure
              ? [
                  { label: "Edit", onClick: () => setEditing(c) },
                  { label: c.archived_at ? "Restore" : "Archive", onClick: () => void toggleArchive(c) },
                ]
              : []
          }
        />
      ),
    }),
  ];
  return (
    <>
      <div className={admin.toolbar}>
        {canConfigure && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setEditing("new")}>
            Add counsel
          </Button>
        )}
        <Switch label="Show archived" checked={archived} onChange={(_, d) => setArchived(d.checked)} />
      </div>
      <ErrorBar message={error} />
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(c) => c.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No counsel yet. Counsel are contacts who receive Secure Links, not users."
        label="Immigration counsel"
        sortable
      />
      {editing && <CounselDialog counsel={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={refresh} />}
    </>
  );
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function CounselDialog({ counsel, onClose, onDone }: { counsel: CounselOut | null; onClose: () => void; onDone: () => void }) {
  const admin = useAdminStyles();
  const [name, setName] = useState(counsel?.name ?? "");
  const [firm, setFirm] = useState(counsel?.firm ?? "");
  const [email, setEmail] = useState(counsel?.email ?? "");
  const [phone, setPhone] = useState(counsel?.phone ?? "");
  const [notes, setNotes] = useState(counsel?.notes ?? "");
  const { error, busy, run } = useAction(onDone, onClose);
  const emailInvalid = email.trim() !== "" && !EMAIL_RE.test(email.trim());
  const body = { name: name.trim(), firm: firm.trim() || null, email: email.trim() || null, phone: phone.trim() || null, notes: notes.trim() || null };
  return (
    <DialogShell
      title={counsel ? `Edit ${counsel.name}` : "Add counsel"}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            appearance="primary"
            disabled={busy || !name.trim() || emailInvalid}
            onClick={() => void run(() => (counsel ? immigrationApi.patchCounsel(counsel.id, body) : immigrationApi.createCounsel(body)))}
          >
            Save
          </Button>
        </>
      }
    >
      <div className={admin.form}>
        <Field label="Name" required>
          <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Field label="Firm">
          <Input value={firm} maxLength={200} onChange={(_, d) => setFirm(d.value)} />
        </Field>
        <Field label="Email" validationMessage={emailInvalid ? "Enter a valid email address." : undefined}>
          <Input type="email" value={email} maxLength={320} onChange={(_, d) => setEmail(d.value)} />
        </Field>
        <Field label="Phone">
          <Input type="tel" value={phone} maxLength={40} onChange={(_, d) => setPhone(d.value)} />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} maxLength={4000} onChange={(_, d) => setNotes(d.value)} />
        </Field>
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}
