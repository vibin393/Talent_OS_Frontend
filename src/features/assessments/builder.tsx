"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Combobox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  Radio,
  RadioGroup,
  Slider,
  SpinButton,
  Spinner,
  Subtitle2,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowDown16Regular, ArrowSync20Regular, ArrowUp16Regular, Delete16Regular, Delete20Regular, PeopleAdd20Regular, Save20Regular } from "@fluentui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { assessmentsApi } from "./api";
import { InviteDialog } from "./invite-dialog";
import {
  DELIVERY_LABELS,
  ITEM_KIND_LABELS,
  moveInList,
  newSection,
  type SectionForm,
  sectionErrors,
  sectionsFromDraft,
  type SettingsForm,
  settingsErrors,
  settingsFromDetail,
  toDraft,
  toSettingsBody,
} from "./logic";
import type { AssessmentDetailOut, Delivery, ItemOut, PublishOut } from "./types";
import { AssessmentStatusBadge, DialogShell, ListInput, useAsmStyles } from "./ui";
import { assessmentKeys, useAssessment, useAssessmentPermissions, useItems, useProviderTests } from "./use-assessments";

const useStyles = makeStyles({
  layout: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1100px" },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: tokens.spacingHorizontalL,
    alignItems: "end",
  },
  switches: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL },
  pickedList: { listStyleType: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  picked: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  pickedText: { flex: 1, minWidth: "160px" },
  pts: { width: "80px" },
  slider: { minWidth: "200px" },
  stickyBar: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  spacer: { flex: 1 },
  fieldset: { border: 0, padding: 0, margin: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

/** `/assessments/[id]`: settings, sections (fixed items or draw rules), draft save, publish, versions and invites. */
export function AssessmentBuilder({ id }: { id: string }) {
  const { canRead, canAuthor } = useAssessmentPermissions();
  const q = useAssessment(id, canRead || canAuthor);
  if (!canRead && !canAuthor) return <NoAccess what="assessments" />;
  if (q.isPending) return <GridSkeleton rows={6} />;
  if (q.isError) return <ErrorBar title="Could not load the assessment." message={errorMessage(q.error)} />;
  return <BuilderForm key={`${q.data.id}:${q.data.updated_at}`} a={q.data} canAuthor={canAuthor} />;
}

function BuilderForm({ a, canAuthor }: { a: AssessmentDetailOut; canAuthor: boolean }) {
  const styles = useStyles();
  const asm = useAsmStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const { canInvite } = useAssessmentPermissions();
  const [settings, setSettings] = useState<SettingsForm>(() => settingsFromDetail(a));
  const [sections, setSections] = useState<SectionForm[]>(() => sectionsFromDraft(a.draft_sections));
  const [errors, setErrors] = useState<string[]>([]);
  const [secErrors, setSecErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [published, setPublished] = useState<PublishOut | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const readOnly = !canAuthor || a.status === "archived";
  const builtin = settings.delivery === "builtin";
  const setS = (patch: Partial<SettingsForm>) => setSettings((s) => ({ ...s, ...patch }));
  const updateSection = (uid: string, patch: Partial<SectionForm>) => setSections((list) => list.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));
  const refresh = () => void qc.invalidateQueries({ queryKey: assessmentKeys.all });

  const validate = () => {
    const e = settingsErrors(settings);
    const se = builtin ? sectionErrors(sections) : {};
    setErrors(e);
    setSecErrors(se);
    return e.length === 0 && Object.keys(se).length === 0;
  };

  const saveDraft = async (): Promise<boolean> => {
    if (!validate()) return false;
    setError(null);
    await assessmentsApi.patch(a.id, toSettingsBody(settings));
    if (builtin) await assessmentsApi.saveDraft(a.id, toDraft(sections));
    return true;
  };

  const onSave = async () => {
    setBusy("save");
    try {
      if (await saveDraft()) {
        toast.success("Draft saved");
        refresh();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const onPublish = async () => {
    setBusy("publish");
    try {
      if (!(await saveDraft())) throw new Error("invalid");
      const out = await assessmentsApi.publish(a.id);
      setPublished(out);
    } catch (e) {
      if (!(e instanceof Error && e.message === "invalid")) setError(errorMessage(e));
      throw e;
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.layout}>
      <div className={asm.headerRow}>
        <PageHeader
          title={a.name}
          subtitle={
            <span className={asm.rowCenter}>
              <AppLink href="/assessments">Assessments</AppLink>
              <AssessmentStatusBadge status={a.status} />
              <Caption1>
                {DELIVERY_LABELS[a.delivery]}
                {a.current_version_no != null ? ` · current version v${a.current_version_no}` : " · not published"}
              </Caption1>
            </span>
          }
        />
      </div>
      <div className={styles.stickyBar} role="toolbar" aria-label="Assessment actions">
        {!readOnly && (
          <>
            <Button icon={busy === "save" ? <Spinner size="tiny" /> : <Save20Regular />} disabled={Boolean(busy)} onClick={() => void onSave()}>
              Save draft
            </Button>
            <Button appearance="primary" disabled={Boolean(busy)} onClick={() => validate() && setConfirmPublish(true)}>
              Publish…
            </Button>
          </>
        )}
        {canInvite && a.status === "published" && (
          <Button icon={<PeopleAdd20Regular />} onClick={() => setInviting(true)}>
            Invite candidates
          </Button>
        )}
        <span className={styles.spacer} />
        {canAuthor && a.status !== "archived" && (
          <Button appearance="subtle" icon={<Delete20Regular />} onClick={() => setArchiving(true)}>
            Archive
          </Button>
        )}
      </div>
      {errors.length > 0 && (
        <MessageBar intent="warning" layout="multiline">
          <MessageBarBody>
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </MessageBarBody>
        </MessageBar>
      )}
      <ErrorBar message={error} />

      <SettingsCard s={settings} set={setS} readOnly={readOnly} />

      {builtin ? (
        <>
          <Subtitle2 as="h2">Sections</Subtitle2>
          {sections.length === 0 && <Body1 className={asm.muted}>No sections yet. Add a section of fixed items or a random draw from the bank.</Body1>}
          {sections.map((s, i) => (
            <SectionCard
              key={s.uid}
              s={s}
              index={i}
              count={sections.length}
              error={secErrors[s.uid]}
              readOnly={readOnly}
              onChange={(patch) => updateSection(s.uid, patch)}
              onMove={(to) => setSections((list) => moveInList(list, i, to))}
              onRemove={() => setSections((list) => list.filter((x) => x.uid !== s.uid))}
            />
          ))}
          {!readOnly && (
            <div>
              <Button icon={<Add20Regular />} disabled={sections.length >= 20} onClick={() => setSections((list) => [...list, newSection(list.length)])}>
                Add section
              </Button>
            </div>
          )}
        </>
      ) : (
        <MessageBar intent="info">
          <MessageBarBody>Provider assessments are taken on the provider&apos;s site. Results are imported, or recorded manually from Candidate 360.</MessageBarBody>
        </MessageBar>
      )}

      <VersionsCard a={a} />

      <ConfirmDialog open={confirmPublish} title="Publish this assessment?" confirmLabel="Publish" onClose={() => setConfirmPublish(false)} onConfirm={onPublish}>
        The draft is saved and frozen as a new version. Invitations already sent keep their version; new invitations use this one.
      </ConfirmDialog>
      {published && <PublishedDialog out={published} onClose={() => { setPublished(null); refresh(); }} />}
      <ConfirmDialog
        open={archiving}
        title="Archive this assessment?"
        confirmLabel="Archive"
        onClose={() => setArchiving(false)}
        onConfirm={async () => {
          try {
            await assessmentsApi.archive(a.id);
            toast.success("Assessment archived");
            refresh();
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        No new invitations can be sent. Existing invitations and results are kept.
      </ConfirmDialog>
      {inviting && <InviteDialog assessmentId={a.id} context={{ kind: "pick" }} onClose={() => setInviting(false)} />}
    </div>
  );
}

function SettingsCard({ s, set, readOnly }: { s: SettingsForm; set: (p: Partial<SettingsForm>) => void; readOnly: boolean }) {
  const styles = useStyles();
  const numOrNull = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h2">Settings</Subtitle2>} />
      <fieldset disabled={readOnly} className={styles.fieldset}>
        <div className={styles.grid}>
          <Field label="Name" required>
            <Input value={s.name} maxLength={200} onChange={(_, d) => set({ name: d.value })} />
          </Field>
          <Field label="Delivery">
            <RadioGroup layout="horizontal" value={s.delivery} onChange={(_, d) => set({ delivery: d.value as Delivery })}>
              <Radio value="builtin" label="Built-in" />
              <Radio value="provider" label="Provider" />
            </RadioGroup>
          </Field>
          <Field label="Time limit (minutes)" hint="Empty for no limit">
            <Input type="number" min={1} value={s.timeLimit == null ? "" : String(s.timeLimit)} onChange={(_, d) => set({ timeLimit: numOrNull(d.value) })} />
          </Field>
          <Field label="Pass mark (%)">
            <Input inputMode="decimal" value={s.passMark} onChange={(_, d) => set({ passMark: d.value })} />
          </Field>
          <Field label="Attempts limit">
            <SpinButton
              value={s.attemptsLimit}
              min={1}
              max={10}
              onChange={(_, d) => {
                const v = d.value ?? Number(d.displayValue);
                if (Number.isFinite(v)) set({ attemptsLimit: Math.round(Number(v)) });
              }}
            />
          </Field>
          <Field label="Auto-pass threshold (%)" hint="Non-gating only; empty to always review.">
            <Input inputMode="decimal" value={s.autoPass} onChange={(_, d) => set({ autoPass: d.value })} />
          </Field>
        </div>
        <div className={styles.switches}>
          <Switch label="Shuffle items" checked={s.shuffleItems} onChange={(_, d) => set({ shuffleItems: d.checked })} />
          <Switch label="Shuffle options" checked={s.shuffleOptions} onChange={(_, d) => set({ shuffleOptions: d.checked })} />
          <Switch label="Gating by default (a human must decide Pass/Fail)" checked={s.gatingDefault} onChange={(_, d) => set({ gatingDefault: d.checked })} />
        </div>
        <ListInput label="Skills measured" value={s.skillKeys} onChange={(v) => set({ skillKeys: v })} />
        <Field label="Description">
          <Textarea value={s.description} rows={2} resize="vertical" onChange={(_, d) => set({ description: d.value })} />
        </Field>
        <Field label="Instructions for candidates" hint="Shown on the start screen. Markdown is allowed.">
          <Textarea value={s.instructions} rows={4} resize="vertical" onChange={(_, d) => set({ instructions: d.value })} />
        </Field>
        {s.delivery === "provider" && <ProviderTestPicker s={s} set={set} />}
      </fieldset>
    </Card>
  );
}

function ProviderTestPicker({ s, set }: { s: SettingsForm; set: (p: Partial<SettingsForm>) => void }) {
  const asm = useAsmStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const tests = useProviderTests(null);
  const [syncing, setSyncing] = useState(false);
  const selected = tests.data?.find((t) => t.external_ref === s.providerTestRef && (!s.providerConfigId || t.config_id === s.providerConfigId));
  const sync = async () => {
    if (!s.providerConfigId) return;
    setSyncing(true);
    try {
      const list = await assessmentsApi.syncProviderCatalogue(s.providerConfigId);
      qc.setQueryData(assessmentKeys.providerTests(null), list);
      toast.success("Provider catalogue synced");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSyncing(false);
    }
  };
  return (
    <div className={asm.row}>
      <Field
        label="Provider test"
        required
        className={asm.grow}
        validationState={tests.isError ? "error" : "none"}
        validationMessage={tests.isError ? errorMessage(tests.error) : tests.data?.length === 0 ? "No provider tests synced yet." : undefined}
      >
        <Dropdown
          value={selected ? selected.name : (s.providerTestRef ?? "")}
          placeholder={tests.isPending ? "Loading…" : "Choose a provider test"}
          selectedOptions={selected ? [selected.id] : []}
          onOptionSelect={(_, d) => {
            const t = tests.data?.find((x) => x.id === d.optionValue);
            if (t) set({ providerConfigId: t.config_id, providerTestRef: t.external_ref });
          }}
        >
          {(tests.data ?? []).map((t) => (
            <Option key={t.id} value={t.id} text={t.name}>
              {t.name}
              {t.duration_minutes ? ` · ${t.duration_minutes} min` : ""}
              {t.skills.length ? ` · ${t.skills.join(", ")}` : ""}
            </Option>
          ))}
        </Dropdown>
      </Field>
      {s.providerConfigId && (
        <Button icon={syncing ? <Spinner size="tiny" /> : <ArrowSync20Regular />} disabled={syncing} onClick={() => void sync()}>
          Sync catalogue
        </Button>
      )}
    </div>
  );
}

function SectionCard({
  s,
  index,
  count,
  error,
  readOnly,
  onChange,
  onMove,
  onRemove,
}: {
  s: SectionForm;
  index: number;
  count: number;
  error?: string;
  readOnly: boolean;
  onChange: (patch: Partial<SectionForm>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const asm = useAsmStyles();
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h3">{s.title || `Section ${index + 1}`}</Subtitle2>}
        description={<Caption1>{s.mode === "draw" ? `Random draw of ${s.count}` : `${s.items.length} fixed item${s.items.length === 1 ? "" : "s"}`}</Caption1>}
        action={
          readOnly ? undefined : (
            <span className={asm.rowCenter}>
              <Button size="small" appearance="subtle" icon={<ArrowUp16Regular />} aria-label={`Move ${s.title} up`} disabled={index === 0} onClick={() => onMove(index - 1)} />
              <Button size="small" appearance="subtle" icon={<ArrowDown16Regular />} aria-label={`Move ${s.title} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)} />
              <Button size="small" appearance="subtle" icon={<Delete16Regular />} aria-label={`Remove ${s.title}`} onClick={onRemove} />
            </span>
          )
        }
      />
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <fieldset disabled={readOnly} className={styles.fieldset}>
        <div className={styles.grid}>
          <Field label="Key">
            <Input value={s.key} maxLength={40} onChange={(_, d) => onChange({ key: d.value })} />
          </Field>
          <Field label="Title">
            <Input value={s.title} maxLength={200} onChange={(_, d) => onChange({ title: d.value })} />
          </Field>
          <Field label="Section time limit (minutes)" hint="Optional">
            <Input
              type="number"
              min={1}
              value={s.timeLimit == null ? "" : String(s.timeLimit)}
              onChange={(_, d) => onChange({ timeLimit: d.value.trim() === "" ? null : Math.round(Number(d.value)) })}
            />
          </Field>
          <Field label="Items">
            <RadioGroup layout="horizontal" value={s.mode} onChange={(_, d) => onChange({ mode: d.value as SectionForm["mode"] })}>
              <Radio value="fixed" label="Fixed items" />
              <Radio value="draw" label="Draw rule" />
            </RadioGroup>
          </Field>
        </div>
        {s.mode === "fixed" ? <FixedItems s={s} onChange={onChange} readOnly={readOnly} /> : <DrawRuleForm s={s} onChange={onChange} />}
      </fieldset>
    </Card>
  );
}

function itemLabel(i: ItemOut | undefined, id: string): string {
  if (!i) return id;
  const stem = i.version.stem.length > 80 ? `${i.version.stem.slice(0, 80)}…` : i.version.stem;
  return `${i.human_id} · ${ITEM_KIND_LABELS[i.kind]} · ${stem}`;
}

function FixedItems({ s, onChange, readOnly }: { s: SectionForm; onChange: (patch: Partial<SectionForm>) => void; readOnly: boolean }) {
  const styles = useStyles();
  const asm = useAsmStyles();
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const all = useItems({});
  const results = useItems({ q: q || undefined });
  const byId = new Map((all.data ?? []).map((i) => [i.id, i]));
  const picked = new Set(s.items.map((i) => i.item_id));
  const options = (results.data ?? []).filter((i) => !i.archived_at && !picked.has(i.id)).slice(0, 30);
  return (
    <div className={asm.stack}>
      {!readOnly && (
        <Field label="Add an item from the bank">
          <Combobox
            freeform
            value={search}
            placeholder="Search by stem, tag or skill"
            onChange={(e) => setSearch(e.target.value)}
            onOptionSelect={(_, d) => {
              if (d.optionValue) onChange({ items: [...s.items, { item_id: d.optionValue, points: "" }] });
              setSearch("");
            }}
          >
            {options.map((i) => (
              <Option key={i.id} value={i.id} text={i.human_id}>
                {itemLabel(i, i.id)}
              </Option>
            ))}
            {options.length === 0 && <Option disabled value="__none__">{results.isPending ? "Loading…" : "No matching items"}</Option>}
          </Combobox>
        </Field>
      )}
      <ol className={styles.pickedList} aria-label="Items in this section">
        {s.items.map((it, i) => (
          <li key={it.item_id} className={styles.picked}>
            <Text className={styles.pickedText}>
              {i + 1}. {itemLabel(byId.get(it.item_id), it.item_id)}
            </Text>
            <Input
              className={styles.pts}
              aria-label="Points override"
              placeholder={byId.get(it.item_id)?.version.points ?? "pts"}
              value={it.points}
              inputMode="decimal"
              onChange={(_, d) => onChange({ items: s.items.map((x, j) => (j === i ? { ...x, points: d.value } : x)) })}
            />
            {!readOnly && (
              <>
                <Button size="small" appearance="subtle" icon={<ArrowUp16Regular />} aria-label="Move item up" disabled={i === 0} onClick={() => onChange({ items: moveInList(s.items, i, i - 1) })} />
                <Button size="small" appearance="subtle" icon={<ArrowDown16Regular />} aria-label="Move item down" disabled={i === s.items.length - 1} onClick={() => onChange({ items: moveInList(s.items, i, i + 1) })} />
                <Button size="small" appearance="subtle" icon={<Delete16Regular />} aria-label="Remove item" onClick={() => onChange({ items: s.items.filter((_, j) => j !== i) })} />
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function DrawRuleForm({ s, onChange }: { s: SectionForm; onChange: (patch: Partial<SectionForm>) => void }) {
  const styles = useStyles();
  const [lo, hi] = s.difficulty;
  return (
    <div className={styles.grid}>
      <ListInput label="Tags" value={s.drawTags} onChange={(v) => onChange({ drawTags: v })} />
      <ListInput label="Skills" value={s.drawSkills} onChange={(v) => onChange({ drawSkills: v })} />
      <Field label={`Minimum difficulty: ${lo}`}>
        <Slider className={styles.slider} min={1} max={5} step={1} value={lo} onChange={(_, d) => onChange({ difficulty: [d.value, Math.max(d.value, hi)] })} />
      </Field>
      <Field label={`Maximum difficulty: ${hi}`}>
        <Slider className={styles.slider} min={1} max={5} step={1} value={hi} onChange={(_, d) => onChange({ difficulty: [Math.min(lo, d.value), d.value] })} />
      </Field>
      <Field label="Number of items to draw">
        <SpinButton
          value={s.count}
          min={1}
          max={100}
          onChange={(_, d) => {
            const v = d.value ?? Number(d.displayValue);
            if (Number.isFinite(v)) onChange({ count: Math.round(Number(v)) });
          }}
        />
      </Field>
    </div>
  );
}

function VersionsCard({ a }: { a: AssessmentDetailOut }) {
  const styles = useStyles();
  const asm = useAsmStyles();
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h2">Versions</Subtitle2>} />
      {a.versions.length === 0 ? (
        <Body1 className={asm.muted}>Not published yet.</Body1>
      ) : (
        <Table size="small" aria-label="Published versions">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Version</TableHeaderCell>
              <TableHeaderCell>Published</TableHeaderCell>
              <TableHeaderCell>Total points</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...a.versions]
              .sort((x, y) => y.version - x.version)
              .map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    v{v.version}{" "}
                    {v.id === a.current_version_id && (
                      <Badge appearance="tint" color="success" size="small">
                        Current
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDateTime(v.published_at)}</TableCell>
                  <TableCell>{v.total_points}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function PublishedDialog({ out, onClose }: { out: PublishOut; onClose: () => void }) {
  const asm = useAsmStyles();
  const v = out.version;
  return (
    <DialogShell
      title={`Published v${v.version}`}
      onClose={onClose}
      wide
      actions={
        <Button appearance="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className={asm.stack}>
        {out.warnings.length > 0 && (
          <MessageBar intent="warning" layout="multiline">
            <MessageBarBody>
              <MessageBarTitle>Warnings</MessageBarTitle>
              <ul>
                {out.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </MessageBarBody>
          </MessageBar>
        )}
        <Body1>
          Frozen on {formatDateTime(v.published_at)} · {v.total_points} points in total.
        </Body1>
        <Table size="small" aria-label="Frozen sections">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Section</TableHeaderCell>
              <TableHeaderCell>Kind</TableHeaderCell>
              <TableHeaderCell>Items</TableHeaderCell>
              <TableHeaderCell>Points</TableHeaderCell>
              <TableHeaderCell>Time limit</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {v.sections.map((s) => (
              <TableRow key={s.key}>
                <TableCell>
                  {s.title} <Caption1 className={asm.muted}>({s.key})</Caption1>
                </TableCell>
                <TableCell>{s.kind === "draw" ? `Draw${s.pool_size != null ? ` from ${s.pool_size}` : ""}` : "Fixed"}</TableCell>
                <TableCell>{s.item_count}</TableCell>
                <TableCell>{s.points}</TableCell>
                <TableCell>{s.time_limit_minutes ? `${s.time_limit_minutes} min` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DialogShell>
  );
}
