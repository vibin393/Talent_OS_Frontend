"use client";

import {
  Badge,
  Button,
  Checkbox,
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
  SpinButton,
  Spinner,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { ConfirmDialog, ErrorBar, formatDateTime, GridSkeleton, IdMultiSelect, IdSelect, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePublishedAssessments } from "@/features/assessments/use-assessments";
import { useDemands } from "@/features/demands/use-demands";
import { EMPTY_DEMAND_FILTERS } from "@/features/demands/query";
import { useStages } from "@/features/pipeline/use-pipeline";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { FairnessNav } from "./fairness-nav";
import {
  defaultRunDraft,
  formatDate,
  INTERSECTIONS,
  RUN_STATUS,
  runCreatePayload,
  runDraftErrors,
  type RunDraft,
  runParamsText,
  runSelectionPoints,
  SCREENING_SOURCES,
  SELECTION_POINT_LABELS,
  tableTitle,
} from "./logic";
import type { Intersection, SelectionPoint } from "./types";
import { useCreateRun, useFairnessPermissions, usePublications, useRuns, useSelectionPoints, useUnpublish } from "./use-fairness";

const useStyles = makeStyles({
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  section: { marginTop: tokens.spacingVerticalXL, marginBottom: tokens.spacingVerticalS },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: tokens.spacingHorizontalM },
  checks: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** `/fairness`: adverse-impact report runs and published summaries. */
export function FairnessReportsView() {
  const styles = useStyles();
  const admin = useAdminStyles();
  const { canRead, canConfigure } = useFairnessPermissions();
  const runs = useRuns(canRead);
  const [creating, setCreating] = useState(false);
  if (!canRead) return <NoAccess what="fairness reports" />;
  return (
    <>
      <PageHeader
        title="Fairness"
        subtitle="Adverse-impact reports from voluntary self-identification: aggregate only, small cells suppressed, unknown always shown."
      />
      <FairnessNav current="reports" />
      <div className={styles.toolbar}>
        <Subtitle2 as="h2">Report runs</Subtitle2>
        <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
          New report
        </Button>
      </div>
      {runs.isPending ? (
        <GridSkeleton rows={4} />
      ) : runs.isError ? (
        <ErrorBar title="Could not load report runs." message={errorMessage(runs.error)} />
      ) : runs.data.length === 0 ? (
        <div className={admin.empty}>No reports yet. Run one to see selection rates and impact ratios.</div>
      ) : (
        <div className={admin.surface}>
          <Table aria-label="Report runs" className={admin.grid}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Selection point</TableHeaderCell>
                <TableHeaderCell>Period</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Applicants</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.data.map((r) => {
                const s = RUN_STATUS[r.status] ?? { label: r.status, color: "subtle" as const };
                const params = runParamsText(r.selection_point, r.params);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className={admin.cellStack}>
                        <AppLink href={`/fairness/runs/${r.id}`}>{SELECTION_POINT_LABELS[r.selection_point] ?? r.selection_point}</AppLink>
                        {params && <Text size={200} className={styles.muted}>{params}</Text>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDate(r.date_from)} – {formatDate(r.date_to)}
                    </TableCell>
                    <TableCell>
                      <Badge appearance="tint" color={s.color} icon={r.status === "queued" || r.status === "running" ? <Spinner size="extra-tiny" /> : undefined}>
                        {s.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.total_applicants ?? "—"}</TableCell>
                    <TableCell>{formatDateTime(r.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Publications canConfigure={canConfigure} />
      {creating && <RunDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function Publications({ canConfigure }: { canConfigure: boolean }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const toast = useAppToast();
  const q = usePublications();
  const unpublish = useUnpublish();
  const [target, setTarget] = useState<string | null>(null);
  return (
    <>
      <Subtitle2 as="h2" className={styles.section} block>
        Published summaries
      </Subtitle2>
      {q.isPending ? (
        <GridSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorBar title="Could not load publications." message={errorMessage(q.error)} />
      ) : q.data.length === 0 ? (
        <div className={admin.empty}>Nothing published. Publish a summary from a completed report.</div>
      ) : (
        <div className={admin.surface}>
          <Table aria-label="Published summaries" className={admin.grid}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>AEDT</TableHeaderCell>
                <TableHeaderCell>Audit date</TableHeaderCell>
                <TableHeaderCell>Distribution date</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <AppLink href={`/fairness/runs/${p.run_id}`}>{p.aedt_name}</AppLink>
                  </TableCell>
                  <TableCell>{formatDate(p.audit_date)}</TableCell>
                  <TableCell>{formatDate(p.distribution_date)}</TableCell>
                  <TableCell>
                    {p.unpublished_at ? (
                      <Badge appearance="tint" color="subtle">
                        Unpublished {formatDate(p.unpublished_at)}
                      </Badge>
                    ) : (
                      <Badge appearance="tint" color="success">
                        Published {formatDate(p.published_at)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {canConfigure && !p.unpublished_at && (
                      <Button size="small" onClick={() => setTarget(p.id)}>
                        Unpublish
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <ConfirmDialog
        open={target !== null}
        title="Unpublish this summary?"
        confirmLabel="Unpublish"
        onClose={() => setTarget(null)}
        onConfirm={async () => {
          if (!target) return;
          try {
            await unpublish.mutateAsync(target);
            toast.success("Summary removed from the career site.");
          } catch (e) {
            toast.error(errorMessage(e));
            throw e;
          }
        }}
      >
        The summary is removed from the career site. The report and auditor pack stay available.
      </ConfirmDialog>
    </>
  );
}

function RunDialog({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const router = useRouter();
  const create = useCreateRun();
  const selectionPoints = useSelectionPoints();
  const points = runSelectionPoints(selectionPoints.data);
  const [d, setD] = useState<RunDraft>(() => defaultRunDraft());
  const [touched, setTouched] = useState(false);
  const errors = runDraftErrors(d);
  const set = <K extends keyof RunDraft>(k: K, v: RunDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  const canStages = usePermission("pipeline:read");
  const stages = useStages(false);
  const stageOptions = useMemo(
    () => (stages.data?.items ?? []).filter((s) => !s.archived_at).map((s) => ({ id: s.key, label: s.label })),
    [stages.data],
  );
  const assessments = usePublishedAssessments(d.selection_point === "assessment_pass");
  const assessmentOptions = useMemo(() => (assessments.data ?? []).map((a) => ({ id: a.id, label: a.name })), [assessments.data]);
  const demands = useDemands(EMPTY_DEMAND_FILTERS, 100);
  const demandOptions = useMemo(() => (demands.data?.items ?? []).map((x) => ({ id: x.id, label: `${x.req_id} · ${x.title}` })), [demands.data]);
  const clientOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of demands.data?.items ?? []) m.set(x.client_id, x.client_name ?? x.client_id);
    return [...m].map(([id, label]) => ({ id, label }));
  }, [demands.data]);

  const submit = () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    create.mutate(runCreatePayload(d), {
      onSuccess: (run) => {
        toast.success("Report queued.");
        onClose();
        router.push(`/fairness/runs/${run.id}`);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };
  const err = (k: keyof RunDraft) => (touched ? errors[k] : undefined);
  const toggleIntersection = (i: Intersection, on: boolean) =>
    set("intersections", on ? [...new Set([...d.intersections, i])] : d.intersections.filter((x) => x !== i));

  return (
    <Dialog open onOpenChange={(_, x) => !x.open && !create.isPending && onClose()}>
      <DialogSurface style={{ maxWidth: 720 }}>
        <DialogBody>
          <DialogTitle>New adverse-impact report</DialogTitle>
          <DialogContent className={styles.form}>
            <Field label="Selection point" required>
              <Dropdown
                value={SELECTION_POINT_LABELS[d.selection_point]}
                selectedOptions={[d.selection_point]}
                onOptionSelect={(_, x) => x.optionValue && set("selection_point", x.optionValue as SelectionPoint)}
              >
                {points.map((p) => (
                  <Option key={p} value={p}>
                    {SELECTION_POINT_LABELS[p]}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            {d.selection_point === "stage_transition" && (
              <div className={styles.grid}>
                <IdSelect label="From stage" options={stageOptions} value={d.from_stage_key} onChange={(v) => set("from_stage_key", v)} noneLabel="Any stage" disabled={!canStages} />
                <Field label="To stage" required validationState={err("to_stage_key") ? "error" : "none"} validationMessage={err("to_stage_key")}>
                  <Dropdown
                    value={stageOptions.find((s) => s.id === d.to_stage_key)?.label ?? ""}
                    selectedOptions={d.to_stage_key ? [d.to_stage_key] : []}
                    disabled={!canStages}
                    onOptionSelect={(_, x) => set("to_stage_key", x.optionValue ?? null)}
                  >
                    {stageOptions.map((s) => (
                      <Option key={s.id} value={s.id}>
                        {s.label}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              </div>
            )}
            {d.selection_point === "ai_match_threshold" && (
              <Field label="Minimum AI Match score (0–100)" required validationState={err("min_score") ? "error" : "none"} validationMessage={err("min_score")}>
                <SpinButton
                  min={0}
                  max={100}
                  value={d.min_score}
                  onChange={(_, x) => {
                    const v = x.value ?? (x.displayValue !== undefined ? Number.parseInt(x.displayValue, 10) : NaN);
                    set("min_score", Number.isFinite(v) ? (v as number) : null);
                  }}
                />
              </Field>
            )}
            {d.selection_point === "assessment_pass" && (
              <Field label="Assessment" required validationState={err("assessment_id") ? "error" : "none"} validationMessage={err("assessment_id")}>
                <Dropdown
                  value={assessmentOptions.find((a) => a.id === d.assessment_id)?.label ?? ""}
                  selectedOptions={d.assessment_id ? [d.assessment_id] : []}
                  onOptionSelect={(_, x) => set("assessment_id", x.optionValue ?? null)}
                >
                  {assessmentOptions.map((a) => (
                    <Option key={a.id} value={a.id}>
                      {a.label}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            )}
            {d.selection_point === "agent_screening_flag_advanced" && (
              <Field label="Source">
                <Dropdown
                  value={SCREENING_SOURCES.find((x) => x.value === d.source)?.label ?? ""}
                  selectedOptions={[d.source]}
                  onOptionSelect={(_, x) => x.optionValue && set("source", x.optionValue as RunDraft["source"])}
                >
                  {SCREENING_SOURCES.map((x) => (
                    <Option key={x.value} value={x.value}>
                      {x.label}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            )}
            {d.selection_point === "agent_draft_rating_accepted" && (
              <Field
                label="Minimum accepted share (0–1, optional)"
                validationState={err("min_accepted_share") ? "error" : "none"}
                validationMessage={err("min_accepted_share")}
              >
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={d.min_accepted_share === null ? "" : String(d.min_accepted_share)}
                  onChange={(_, x) => set("min_accepted_share", x.value.trim() === "" ? null : Number(x.value))}
                />
              </Field>
            )}
            <div className={styles.grid}>
              <Field label="From" required validationState={err("date_from") ? "error" : "none"} validationMessage={err("date_from")}>
                <Input type="date" value={d.date_from} onChange={(_, x) => set("date_from", x.value)} />
              </Field>
              <Field label="To" required validationState={err("date_to") ? "error" : "none"} validationMessage={err("date_to")}>
                <Input type="date" value={d.date_to} onChange={(_, x) => set("date_to", x.value)} />
              </Field>
            </div>
            <div className={styles.grid}>
              <IdMultiSelect label="Demands" options={demandOptions} value={d.demand_ids} onChange={(v) => set("demand_ids", v)} placeholder="All demands" />
              <IdSelect label="Client" options={clientOptions} value={d.client_id} onChange={(v) => set("client_id", v)} noneLabel="All clients" />
              <Field label="Job category">
                <Input value={d.job_category} onChange={(_, x) => set("job_category", x.value)} placeholder="All categories" />
              </Field>
            </div>
            <Field label="Intersections">
              <div className={styles.checks}>
                {INTERSECTIONS.map((i) => (
                  <Checkbox
                    key={i}
                    label={tableTitle(i.split("×"), i)}
                    checked={d.intersections.includes(i)}
                    onChange={(_, x) => toggleIntersection(i, !!x.checked)}
                  />
                ))}
              </div>
            </Field>
            <MessageBar intent="info" layout="multiline">
              <MessageBarBody>
                The report runs in the background on aggregate data only. Cells below the minimum size are suppressed together
                with a complementary cell so they cannot be derived.
              </MessageBarBody>
            </MessageBar>
          </DialogContent>
          <DialogActions>
            <Button disabled={create.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={create.isPending} icon={create.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
              Run report
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
