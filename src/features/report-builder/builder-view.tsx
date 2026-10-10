"use client";

import {
  Badge,
  Button,
  Caption1,
  Card,
  CardHeader,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Divider,
  Dropdown,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Subtitle2,
  Text,
  ToggleButton,
  Tooltip,
  tokens,
  Tree,
  TreeItem,
  TreeItemLayout,
} from "@fluentui/react-components";
import {
  Add16Regular,
  ArrowDownload20Regular,
  CalendarClock20Regular,
  Delete16Regular,
  DocumentCopy20Regular,
  Pin20Filled,
  Pin20Regular,
  Play20Regular,
  Save20Regular,
  Share20Regular,
} from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { reportBuilderApi, reportBuilderKeys, runDownloadUrl } from "./api";
import { FilterTree } from "./filter-tree";
import {
  AGG_LABELS,
  aggsFor,
  allowedViz,
  type BuilderState,
  emptyState,
  fieldMap,
  fieldTree,
  fromDefinition,
  MAX_GROUP_BY,
  MAX_MEASURES,
  measureErrors,
  measureKey,
  normalizeViz,
  outputKeys,
  ratioCandidates,
  removeMeasure,
  toDefinition,
  unavailableReason,
  VIZ_LABELS,
} from "./logic";
import { ReportChart } from "./report-chart";
import { ScheduleDrawer } from "./schedule-drawer";
import { ShareDialog } from "./share-dialog";
import type { Agg, Bucket, Definition, ExportFormat, FieldCatalog, Measure, ReportOut, RunResult, VizSpec, VizType } from "./types";

const useStyles = makeStyles({
  layout: { display: "grid", gridTemplateColumns: "260px minmax(0, 1fr) minmax(0, 1.1fr)", gap: tokens.spacingHorizontalL, alignItems: "start" },
  panel: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, minWidth: 0 },
  card: { padding: tokens.spacingHorizontalM },
  toolbar: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalM },
  name: { minWidth: "260px", flex: "1 1 260px", maxWidth: "420px" },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalS },
  chips: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  muted: { color: tokens.colorNeutralForeground3 },
  tree: { maxHeight: "520px", overflowY: "auto" },
  disabled: { color: tokens.colorNeutralForegroundDisabled },
  broken: { outline: `2px solid ${tokens.colorPaletteRedBorder2}`, borderRadius: tokens.borderRadiusMedium },
  measureKey: { width: "150px" },
});

const BUCKETS: (Bucket | "")[] = ["", "day", "week", "month", "quarter", "fy"];
const BUCKET_LABELS: Record<string, string> = { "": "No bucket", day: "Day", week: "Week", month: "Month", quarter: "Quarter", fy: "Financial year" };

function FieldTreePanel({ source, state, onPick }: { source: ReturnType<typeof fieldTree>; state: BuilderState; onPick: (f: FieldCatalog) => void }) {
  const styles = useStyles();
  return (
    <Tree aria-label="Fields" className={styles.tree} defaultOpenItems={["__root"]}>
      {source.map((group) => (
        <TreeItem key={group.value} itemType="branch" value={group.value}>
          <TreeItemLayout>{group.label}</TreeItemLayout>
          <Tree>
            {group.children.map((f) => {
              const use = state.mode === "rows" ? "display" : f.groupable && !f.masked ? "group" : "measure";
              const reason = unavailableReason(f, use);
              const item = (
                <TreeItem key={f.key} itemType="leaf" value={f.key} onClick={() => !reason && onPick(f)} aria-disabled={!!reason}>
                  <TreeItemLayout className={reason ? styles.disabled : undefined} aside={f.masked ? <Badge size="small" appearance="tint" color="warning">Hidden</Badge> : undefined}>
                    {f.label}
                  </TreeItemLayout>
                </TreeItem>
              );
              return reason ? (
                <Tooltip key={f.key} relationship="description" content={reason}>
                  {item}
                </Tooltip>
              ) : (
                item
              );
            })}
          </Tree>
        </TreeItem>
      ))}
    </Tree>
  );
}

function MeasureRow({
  m,
  index,
  measures,
  fields,
  error,
  onChange,
  onRemove,
}: {
  m: Measure;
  index: number;
  measures: Measure[];
  fields: FieldCatalog[];
  error?: string;
  onChange: (m: Measure) => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const field = fields.find((f) => f.key === m.field);
  const candidates = ratioCandidates(measures, index);
  const fnOptions: Agg[] = m.field ? aggsFor(field) : ["count", "pct_of_total", ...(candidates.length >= 2 ? (["ratio"] as Agg[]) : [])];
  const measurable = fields.filter((f) => !unavailableReason(f, "measure"));
  return (
    <div className={styles.row}>
      <Field validationState={error ? "error" : "none"} validationMessage={error}>
        <Input aria-label="Measure name" className={styles.measureKey} value={m.key} onChange={(_, d) => onChange({ ...m, key: d.value.toLowerCase() })} />
      </Field>
      <Dropdown aria-label="Function" value={AGG_LABELS[m.agg]} selectedOptions={[m.agg]} onOptionSelect={(_, d) => {
        const agg = d.optionValue as Agg;
        if (agg === "ratio") onChange({ key: m.key, agg, field: null, of: [candidates[0], candidates[1]] });
        else onChange({ ...m, agg, of: null });
      }}>
        {fnOptions.map((a) => (
          <Option key={a} value={a}>
            {AGG_LABELS[a]}
          </Option>
        ))}
      </Dropdown>
      {m.agg === "ratio" ? (
        <>
          {[0, 1].map((side) => (
            <Dropdown key={side} aria-label={side === 0 ? "Numerator" : "Denominator"} value={m.of?.[side] ?? ""} selectedOptions={m.of ? [m.of[side]] : []} onOptionSelect={(_, d) => {
              const of: [string, string] = [...(m.of ?? [candidates[0], candidates[1]])] as [string, string];
              of[side] = String(d.optionValue);
              onChange({ ...m, of });
            }}>
              {candidates.map((k) => (
                <Option key={k} value={k}>
                  {k}
                </Option>
              ))}
            </Dropdown>
          ))}
        </>
      ) : (
        <Dropdown aria-label="Field" placeholder="Rows" value={field?.label ?? (m.field ? m.field : "All rows")} selectedOptions={m.field ? [m.field] : ["__rows"]} onOptionSelect={(_, d) => {
          const next = d.optionValue === "__rows" ? null : String(d.optionValue);
          const nf = fields.find((f) => f.key === next);
          const agg = next === null ? (m.agg === "pct_of_total" ? "pct_of_total" : "count") : aggsFor(nf).includes(m.agg) ? m.agg : (aggsFor(nf)[0] ?? "count");
          onChange({ ...m, field: next, agg });
        }}>
          <Option value="__rows">All rows</Option>
          {measurable.map((f) => (
            <Option key={f.key} value={f.key}>
              {f.label}
            </Option>
          ))}
        </Dropdown>
      )}
      <Button appearance="subtle" icon={<Delete16Regular />} aria-label="Remove measure" onClick={onRemove} />
    </div>
  );
}

/** Epic 64: optional initial definition for a new report (`/reports/custom/new?from_answer=<id>`); `onCreated` runs after
 *  the first successful Save. Without it the builder behaves exactly as before. */
export type BuilderPrefill = { name: string; definition: Definition; viz: VizSpec; onCreated?: (reportId: string) => Promise<unknown> };

/** `/reports/custom/new` and `/reports/custom/[id]`: source + field tree, filters, group-by, measures, viz, preview. */
export function BuilderView({ reportId, prefill }: { reportId?: string; prefill?: BuilderPrefill }) {
  const styles = useStyles();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canRead = usePermission("report:read");
  const canBuild = usePermission("report:build");
  const canExport = usePermission("report:export");
  const canSchedule = usePermission("report:schedule");
  const sources = useQuery({ queryKey: reportBuilderKeys.sources(), queryFn: ({ signal }) => reportBuilderApi.sources(signal) });
  const saved = useQuery({ queryKey: reportBuilderKeys.report(reportId ?? ""), queryFn: ({ signal }) => reportBuilderApi.get(reportId as string, signal), enabled: !!reportId });
  const [draft, setDraft] = useState<BuilderState | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const report: ReportOut | undefined = saved.data;
  const state: BuilderState =
    draft ?? (report ? fromDefinition(report.definition, report.viz) : prefill ? fromDefinition(prefill.definition, prefill.viz) : emptyState(sources.data?.[0]?.key ?? ""));
  const reportName = name ?? report?.name ?? prefill?.name ?? "Untitled report";
  const source = sources.data?.find((s) => s.key === state.source);
  const fields = useMemo(() => fieldMap(source), [source]);
  const tree = useMemo(() => fieldTree(source), [source]);
  const viz = normalizeViz(state);
  const editable = !report || report.is_owner;
  const errors = measureErrors(state.mode === "aggregate" ? state.measures : []);
  const brokenPaths = new Set((report?.repair_issues ?? []).map((i) => i.field));

  const set = (patch: Partial<BuilderState>) => setDraft({ ...state, ...patch });
  const definition = toDefinition(state);

  const preview = useMutation({
    // A saved, unchanged report runs as the viewer (masked measures removed); a draft is previewed as its author.
    mutationFn: () => (report && !draft ? reportBuilderApi.run(report.id) : reportBuilderApi.preview(definition, viz)),
    onSuccess: setResult,
  });
  const saveMutation = useMutation({
    mutationFn: (asNew: string | null) =>
      asNew !== null || !report
        ? reportBuilderApi.create({ name: asNew ?? reportName, definition, viz })
        : reportBuilderApi.update(report.id, { name: reportName, definition, viz }),
    onSuccess: async (out) => {
      if (prefill?.onCreated && !report) await prefill.onCreated(out.id).catch(() => undefined);
      setDraft(null);
      setName(null);
      setSaveAsOpen(false);
      await queryClient.invalidateQueries({ queryKey: reportBuilderKeys.all });
      if (out.id !== reportId) router.push(`/reports/custom/${out.id}`);
      setNotice("Saved.");
    },
  });
  const exportMutation = useMutation({
    mutationFn: (format: ExportFormat) => reportBuilderApi.export(report?.id as string, format),
    onSuccess: (out) => {
      if (out.download_url) window.location.assign(runDownloadUrl(out.run_id));
      setNotice(out.mode === "async" ? "Large export queued: you will get a notification with the download link." : out.limit_hit ? out.limit_hit.message : null);
    },
  });
  const pinMutation = useMutation({
    mutationFn: () => (report?.pinned ? reportBuilderApi.unpin(report.id) : reportBuilderApi.pin(report?.id as string)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportBuilderKeys.all }),
  });

  if (!canRead && !canBuild) return <NoAccess what="custom reports" />;
  if (reportId && saved.isPending) return <Spinner label="Loading report" />;
  if (reportId && saved.error) return <ErrorBar title="Could not load the report." message={errorMessage(saved.error)} />;

  const pickField = (f: FieldCatalog) => {
    if (!editable) return;
    if (state.mode === "rows") {
      if (!state.fields.includes(f.key)) set({ fields: [...state.fields, f.key] });
    } else if (f.groupable && !f.masked && state.groupBy.length < MAX_GROUP_BY && !state.groupBy.some((g) => g.field === f.key)) {
      set({ groupBy: [...state.groupBy, { field: f.key, bucket: f.date_buckets ? "month" : null }] });
    } else if (f.aggs.length && state.measures.length < MAX_MEASURES) {
      const agg = (f.aggs.includes("sum") ? "sum" : f.aggs[0]) as Agg;
      set({ measures: [...state.measures, { key: measureKey(agg, f.key, state.measures.map((m) => m.key)), agg, field: f.key }] });
    }
  };
  const previewError = preview.error && isApiError(preview.error) ? preview.error : null;
  const errorPath = previewError && typeof previewError.details.path === "string" ? previewError.details.path : null;

  return (
    <>
      <PageHeader title={report ? report.name : "New custom report"} subtitle="Pick a source, fields, filters, group-bys and measures. Everyone who opens it sees only their own data." />
      <div className={styles.toolbar}>
        <Field label="Report name" className={styles.name}>
          <Input value={reportName} disabled={!editable} onChange={(_, d) => setName(d.value)} />
        </Field>
        {report?.status === "needs_repair" && (
          <Badge appearance="filled" color="danger" icon={undefined}>
            Needs repair
          </Badge>
        )}
        {editable && canBuild && (
          <Button appearance="primary" icon={<Save20Regular />} disabled={saveMutation.isPending || !state.source || Object.keys(errors).length > 0} onClick={() => saveMutation.mutate(null)}>
            Save
          </Button>
        )}
        {canBuild && report && (
          <Button icon={<DocumentCopy20Regular />} onClick={() => { setSaveAsName(`${reportName} (copy)`); setSaveAsOpen(true); }}>
            Save as
          </Button>
        )}
        {report?.is_owner && canBuild && (
          <Button icon={<Share20Regular />} onClick={() => setShareOpen(true)}>
            Share
          </Button>
        )}
        {report && canExport && (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button icon={<ArrowDownload20Regular />} disabled={exportMutation.isPending}>
                Export
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {(["xlsx", "csv", "pdf"] as ExportFormat[]).map((f) => (
                  <MenuItem key={f} onClick={() => exportMutation.mutate(f)}>
                    {f.toUpperCase()}
                  </MenuItem>
                ))}
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
        {report?.is_owner && canSchedule && (
          <Button icon={<CalendarClock20Regular />} onClick={() => setScheduleOpen(true)}>
            Schedule
          </Button>
        )}
        {report && (
          <Button icon={report.pinned ? <Pin20Filled /> : <Pin20Regular />} onClick={() => pinMutation.mutate()} disabled={pinMutation.isPending}>
            {report.pinned ? "Unpin" : "Pin to dashboard"}
          </Button>
        )}
      </div>
      {report?.status === "needs_repair" && (
        <MessageBar intent="error">
          <MessageBarBody>
            This report uses fields that no longer exist ({report.repair_issues.map((i) => i.field ?? i.path).join(", ")}). Remove or replace them and save to repair it.
          </MessageBarBody>
        </MessageBar>
      )}
      {[saveMutation.error, exportMutation.error, pinMutation.error].filter(Boolean).map((e, i) => (
        <ErrorBar key={i} message={errorMessage(e)} />
      ))}
      {notice && (
        <MessageBar intent="success">
          <MessageBarBody>{notice}</MessageBarBody>
        </MessageBar>
      )}
      <div className={styles.layout}>
        <Card className={mergeClasses(styles.card, styles.panel)}>
          <Field label="Source">
            <Dropdown
              disabled={!editable}
              value={source?.label ?? state.source}
              selectedOptions={[state.source]}
              onOptionSelect={(_, d) => setDraft({ ...emptyState(String(d.optionValue)), viz: { type: "table" } })}
            >
              {(sources.data ?? []).map((s) => (
                <Option key={s.key} value={s.key}>
                  {s.label}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Caption1 className={styles.muted}>Click a field to add it. Greyed fields need extra access.</Caption1>
          <FieldTreePanel source={tree} state={state} onPick={pickField} />
        </Card>

        <div className={styles.panel}>
          <Card className={styles.card}>
            <CardHeader header={<Subtitle2>Shape</Subtitle2>} />
            <div className={styles.row}>
              <ToggleButton checked={state.mode === "aggregate"} disabled={!editable} onClick={() => set({ mode: "aggregate", fields: [] })}>
                Summary (group &amp; measure)
              </ToggleButton>
              <ToggleButton checked={state.mode === "rows"} disabled={!editable} onClick={() => set({ mode: "rows", groupBy: [], measures: [] })}>
                List of rows
              </ToggleButton>
            </div>
            {state.mode === "rows" && (
              <div className={styles.chips}>
                {state.fields.length === 0 && <Text className={styles.muted}>Pick fields from the tree.</Text>}
                {state.fields.map((k) => (
                  <Button key={k} size="small" className={mergeClasses(brokenPaths.has(k) && styles.broken)} icon={<Delete16Regular />} iconPosition="after" disabled={!editable} onClick={() => set({ fields: state.fields.filter((f) => f !== k) })}>
                    {fields.get(k)?.label ?? k}
                  </Button>
                ))}
              </div>
            )}
          </Card>

          <Card className={styles.card}>
            <CardHeader header={<Subtitle2>Filters</Subtitle2>} />
            <FilterTree value={state.filters} fields={source?.fields ?? []} onChange={(filters) => editable && set({ filters })} />
          </Card>

          {state.mode === "aggregate" && (
            <>
              <Card className={styles.card}>
                <CardHeader header={<Subtitle2>Group by (up to {MAX_GROUP_BY})</Subtitle2>} />
                {state.groupBy.map((g, i) => (
                  <div key={g.field} className={mergeClasses(styles.row, brokenPaths.has(g.field) && styles.broken)}>
                    <Text>{fields.get(g.field)?.label ?? g.field}</Text>
                    {fields.get(g.field)?.date_buckets && (
                      <Dropdown aria-label="Date bucket" value={BUCKET_LABELS[g.bucket ?? ""]} selectedOptions={[g.bucket ?? ""]} disabled={!editable} onOptionSelect={(_, d) => set({ groupBy: state.groupBy.map((x, j) => (j === i ? { ...x, bucket: (d.optionValue || null) as Bucket | null } : x)) })}>
                        {BUCKETS.map((b) => (
                          <Option key={b} value={b}>
                            {BUCKET_LABELS[b]}
                          </Option>
                        ))}
                      </Dropdown>
                    )}
                    <Button appearance="subtle" icon={<Delete16Regular />} aria-label="Remove group-by" disabled={!editable} onClick={() => set({ groupBy: state.groupBy.filter((_, j) => j !== i) })} />
                  </div>
                ))}
                {state.groupBy.length === 0 && <Text className={styles.muted}>No group-by: one total row (KPI).</Text>}
              </Card>
              <Card className={styles.card}>
                <CardHeader
                  header={<Subtitle2>Measures (up to {MAX_MEASURES})</Subtitle2>}
                  action={
                    <Button size="small" icon={<Add16Regular />} disabled={!editable || state.measures.length >= MAX_MEASURES} onClick={() => set({ measures: [...state.measures, { key: measureKey("count", null, state.measures.map((m) => m.key)), agg: "count" }] })}>
                      Measure
                    </Button>
                  }
                />
                {state.measures.map((m, i) => (
                  <MeasureRow
                    key={i}
                    m={m}
                    index={i}
                    measures={state.measures}
                    fields={source?.fields ?? []}
                    error={errors[i]}
                    onChange={(next) => editable && set({ measures: state.measures.map((x, j) => (j === i ? next : x)) })}
                    onRemove={() => editable && set({ measures: removeMeasure(state.measures, m.key) })}
                  />
                ))}
              </Card>
            </>
          )}
          <Card className={styles.card}>
            <CardHeader header={<Subtitle2>Sort</Subtitle2>} />
            <div className={styles.row}>
              <Dropdown
                aria-label="Sort by"
                placeholder="Default order"
                value={state.sort[0] ? (fields.get(state.sort[0].key)?.label ?? state.sort[0].key) : ""}
                selectedOptions={state.sort[0] ? [state.sort[0].key] : []}
                disabled={!editable}
                onOptionSelect={(_, d) => set({ sort: d.optionValue ? [{ key: String(d.optionValue), desc: state.sort[0]?.desc ?? false }] : [] })}
              >
                {outputKeys(state).map((k) => (
                  <Option key={k} value={k}>
                    {fields.get(k)?.label ?? k}
                  </Option>
                ))}
              </Dropdown>
              <ToggleButton checked={!!state.sort[0]?.desc} disabled={!state.sort[0] || !editable} onClick={() => set({ sort: state.sort.map((s, i) => (i === 0 ? { ...s, desc: !s.desc } : s)) })}>
                Descending
              </ToggleButton>
            </div>
          </Card>
        </div>

        <div className={styles.panel}>
          <Card className={styles.card}>
            <CardHeader header={<Subtitle2>Visualisation</Subtitle2>} />
            <div className={styles.row}>
              {allowedViz(state).map((t: VizType) => (
                <ToggleButton key={t} size="small" checked={viz.type === t} onClick={() => set({ viz: { ...state.viz, type: t } })}>
                  {VIZ_LABELS[t]}
                </ToggleButton>
              ))}
            </div>
            {(viz.type === "bar" || viz.type === "line" || viz.type === "pivot") && state.groupBy.length > 1 && (
              <Field label={viz.type === "pivot" ? "Columns" : "Series"}>
                <Dropdown value={fields.get(viz.series ?? "")?.label ?? ""} selectedOptions={viz.series ? [viz.series] : []} onOptionSelect={(_, d) => set({ viz: { ...viz, series: String(d.optionValue) } })}>
                  {state.groupBy.filter((g) => g.field !== viz.x).map((g) => (
                    <Option key={g.field} value={g.field}>
                      {fields.get(g.field)?.label ?? g.field}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            )}
            {viz.type !== "table" && state.measures.length > 1 && (
              <Field label="Value">
                <Dropdown value={viz.value ?? ""} selectedOptions={viz.value ? [viz.value] : []} onOptionSelect={(_, d) => set({ viz: { ...viz, value: String(d.optionValue) } })}>
                  {state.measures.map((m) => (
                    <Option key={m.key} value={m.key}>
                      {m.key}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            )}
            <Divider />
            <div className={styles.row}>
              <Button appearance="primary" icon={<Play20Regular />} disabled={!state.source || preview.isPending || Object.keys(errors).length > 0} onClick={() => preview.mutate()}>
                {report && !draft ? "Run" : "Preview"}
              </Button>
              <Caption1 className={styles.muted}>Preview shows up to 500 rows.</Caption1>
            </div>
            {preview.isPending && <Spinner size="tiny" label="Running" />}
            {previewError && (
              <MessageBar intent="error">
                <MessageBarBody>
                  {previewError.code === "semantic_field_forbidden"
                    ? "This report filters or groups by a field you cannot use."
                    : previewError.code === "report_needs_repair"
                      ? "This report needs repair before it can run."
                      : previewError.message}
                  {errorPath ? ` (${errorPath})` : ""}
                </MessageBarBody>
              </MessageBar>
            )}
            {result && <ReportChart result={result} viz={result.viz ?? viz} fields={fields} bucket={state.groupBy.find((g) => g.field === viz.x)?.bucket ?? null} />}
          </Card>
        </div>
      </div>
      {report && shareOpen && <ShareDialog report={report} open={shareOpen} onClose={() => setShareOpen(false)} />}
      {report && scheduleOpen && <ScheduleDrawer report={report} open={scheduleOpen} onClose={() => setScheduleOpen(false)} />}
      <Dialog open={saveAsOpen} onOpenChange={(_, d) => setSaveAsOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Save as a new report</DialogTitle>
            <DialogContent>
              <Field label="Name">
                <Input value={saveAsName} onChange={(_, d) => setSaveAsName(d.value)} />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSaveAsOpen(false)}>Cancel</Button>
              <Button appearance="primary" disabled={!saveAsName.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate(saveAsName.trim())}>
                Save
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
