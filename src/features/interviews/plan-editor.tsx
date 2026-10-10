"use client";

import {
  Badge,
  Button,
  Caption1,
  Card,
  CardHeader,
  Combobox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  SpinButton,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowDown20Regular, ArrowUp20Regular, Delete20Regular, DocumentBulletList20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { blockingInterviewIds, interviewError } from "./errors";
import { KIND_LABELS, STAGE_KINDS } from "./format";
import { moveRow, newRow, planChanged, type PlanRow, type PlanStageKind, rowsFromPlan, scheduledCount, toPlanSave, totalCount, validatePlan } from "./plan";
import type { InterviewOut, PlanOut, PlanStageIn } from "./types";
import { StageAssessmentPicker } from "@/features/assessments/integrations";
import { useApplyTemplate, useInterviewPlan, useKits, useSavePlan, useStageTemplates } from "./use-interview-plan";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  row: {
    display: "grid",
    gridTemplateColumns: "32px minmax(160px, 2fr) minmax(120px, 1fr) minmax(160px, 1.5fr) 110px auto",
    alignItems: "end",
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    "@media (max-width: 900px)": { gridTemplateColumns: "32px 1fr 1fr" },
  },
  pos: { alignSelf: "center", fontWeight: tokens.fontWeightSemibold, textAlign: "center" },
  buttons: { display: "flex", gap: tokens.spacingHorizontalXXS, alignItems: "center" },
  footer: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", alignItems: "center" },
  muted: { color: tokens.colorNeutralForeground3 },
  fullRow: { gridColumn: "1 / -1" },
});

const NO_KIT = "__none__";
// Epic 40: "assessment" stages pick a published assessment instead of scheduling interviews.
const PLAN_KINDS: PlanStageKind[] = [...STAGE_KINDS, "assessment"];
const kindLabel = (k: PlanStageKind) => (k === "assessment" ? "Assessment" : KIND_LABELS[k]);

/**
 * Demand interview plan: ordered stages with name, kind, kit and default duration; move up/down buttons
 * (keyboard accessible), "Apply template" while no interviews exist, and the server's 409 when removing a
 * stage that still has scheduled interviews.
 */
export function PlanEditor({ demandId, interviews }: { demandId: string; interviews?: readonly InterviewOut[] }) {
  const q = useInterviewPlan(demandId);
  if (q.isPending) return <GridSkeleton rows={3} />;
  if (q.isError)
    return (
      <MessageBar intent="error">
        <MessageBarBody>Could not load the interview plan. {errorMessage(q.error)}</MessageBarBody>
      </MessageBar>
    );
  return <PlanEditorForm key={JSON.stringify(q.data.stages.map((s) => [s.id, s.position, s.name]))} demandId={demandId} plan={q.data} interviews={interviews} />;
}

function PlanEditorForm({ demandId, plan, interviews }: { demandId: string; plan: PlanOut; interviews?: readonly InterviewOut[] }) {
  const styles = useStyles();
  const toast = useAppToast();
  const kits = useKits();
  const templates = useStageTemplates();
  const save = useSavePlan(demandId);
  const applyTemplate = useApplyTemplate(demandId);
  const [rows, setRows] = useState<PlanRow[]>(() => rowsFromPlan(plan));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [blocking, setBlocking] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const dirty = planChanged(rows, plan);
  const kitOptions = (kits.data ?? []).filter((k) => !k.archived_at);

  const update = (key: string, patch: Partial<PlanRow>) => {
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const move = (index: number, delta: number, focusId: string) => {
    setRows((r) => moveRow(r, index, delta));
    // Keep keyboard focus on the moved stage's button.
    requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  };

  const onSave = async () => {
    setError(null);
    setBlocking([]);
    const e = validatePlan(rows);
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    try {
      // The generated PlanStageIn predates "assessment" stages and `assessment_id`.
      await save.mutateAsync(toPlanSave(rows) as PlanStageIn[]);
      toast.success("Interview plan saved");
    } catch (err) {
      const ids = blockingInterviewIds(err);
      if (ids.length) setBlocking(ids);
      else setError(interviewError(err));
    }
  };

  const describe = (id: string) => {
    const i = interviews?.find((x) => x.id === id);
    return i ? `${i.human_id} · ${i.candidate_name ?? "Candidate"} · ${i.stage_name} · ${i.display_time}` : id;
  };

  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">Interview plan</Subtitle2>}
        description={<Caption1 className={styles.muted}>Stages every candidate on this demand goes through, in order. The last stage is final.</Caption1>}
        action={
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button icon={applyTemplate.isPending ? <Spinner size="tiny" /> : <DocumentBulletList20Regular />} disabled={plan.has_interviews || applyTemplate.isPending}>
                Apply template
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {(templates.data ?? [])
                  .filter((t) => !t.archived_at)
                  .map((t) => (
                    <MenuItem
                      key={t.id}
                      secondaryContent={t.is_default ? "Default" : undefined}
                      onClick={() =>
                        applyTemplate.mutate(t.id, {
                          onSuccess: () => toast.success(`Applied “${t.name}”`),
                          onError: (e) => toast.error(interviewError(e)),
                        })
                      }
                    >
                      {t.name}
                    </MenuItem>
                  ))}
                {templates.data?.length === 0 && <MenuItem disabled>No templates yet</MenuItem>}
              </MenuList>
            </MenuPopover>
          </Menu>
        }
      />
      {plan.has_interviews && <Caption1 className={styles.muted}>Templates can only be applied before the first interview is scheduled.</Caption1>}
      {blocking.length > 0 && (
        <MessageBar intent="error" layout="multiline" role="alert">
          <MessageBarBody>
            A stage you removed still has scheduled interviews. Cancel or reschedule them first:
            <ul style={{ margin: `${tokens.spacingVerticalXS} 0 0`, paddingInlineStart: tokens.spacingHorizontalXL }}>
              {blocking.map((id) => (
                <li key={id}>{describe(id)}</li>
              ))}
            </ul>
          </MessageBarBody>
        </MessageBar>
      )}
      {error && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <ol className={styles.list} aria-label="Interview stages">
        {rows.map((row, index) => {
          const kit = kitOptions.find((k) => k.id === row.kitId);
          const total = totalCount(row);
          const err = errors[row.key];
          return (
            <li key={row.key} className={styles.row}>
              <Text className={styles.pos} aria-hidden>
                {index + 1}
              </Text>
              <Field label="Stage name" size="small" validationState={err ? "error" : "none"} validationMessage={err || undefined}>
                <Input size="small" value={row.name} maxLength={200} onChange={(_, d) => update(row.key, { name: d.value })} aria-label={`Stage ${index + 1} name`} />
              </Field>
              <Field label="Kind" size="small">
                <Dropdown size="small" value={kindLabel(row.kind)} selectedOptions={[row.kind]} onOptionSelect={(_, d) => d.optionValue && update(row.key, { kind: d.optionValue as PlanStageKind })}>
                  {PLAN_KINDS.map((k) => (
                    <Option key={k} value={k}>
                      {kindLabel(k)}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Interview kit" size="small">
                <Combobox
                  size="small"
                  value={kit?.name ?? (row.kitId ? "Archived kit" : "No kit (overall rating)")}
                  selectedOptions={[row.kitId ?? NO_KIT]}
                  onOptionSelect={(_, d) => update(row.key, { kitId: d.optionValue === NO_KIT || !d.optionValue ? null : d.optionValue })}
                >
                  <Option value={NO_KIT}>No kit (overall rating)</Option>
                  {kitOptions.map((k) => (
                    <Option key={k.id} value={k.id}>
                      {k.name}
                    </Option>
                  ))}
                </Combobox>
              </Field>
              <Field label="Minutes" size="small">
                <SpinButton
                  size="small"
                  value={row.duration}
                  min={15}
                  max={480}
                  step={15}
                  onChange={(_, d) => {
                    const v = d.value ?? Number(d.displayValue);
                    if (Number.isFinite(v)) update(row.key, { duration: Number(v) });
                  }}
                />
              </Field>
              <div className={styles.buttons}>
                <Button
                  id={`plan-up-${row.key}`}
                  size="small"
                  appearance="subtle"
                  icon={<ArrowUp20Regular />}
                  aria-label={`Move ${row.name || `stage ${index + 1}`} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1, `plan-up-${row.key}`)}
                />
                <Button
                  id={`plan-down-${row.key}`}
                  size="small"
                  appearance="subtle"
                  icon={<ArrowDown20Regular />}
                  aria-label={`Move ${row.name || `stage ${index + 1}`} down`}
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1, `plan-down-${row.key}`)}
                />
                <Button
                  size="small"
                  appearance="subtle"
                  icon={<Delete20Regular />}
                  aria-label={`Remove ${row.name || `stage ${index + 1}`}`}
                  title={scheduledCount(row) ? "Has scheduled interviews" : total ? "Kept as archived with its interviews" : "Remove stage"}
                  onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
                />
                {total > 0 && (
                  <Badge size="small" appearance="tint" color={scheduledCount(row) ? "warning" : "informative"} title={`${total} interview(s)`}>
                    {total}
                  </Badge>
                )}
              </div>
              {row.kind === "assessment" && (
                <div className={styles.fullRow}>
                  <StageAssessmentPicker value={row.assessmentId ?? null} onChange={(id) => update(row.key, { assessmentId: id })} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {rows.length === 0 && <Caption1 className={styles.muted}>No stages. Add a stage or apply a template.</Caption1>}

      <div className={styles.footer}>
        <Button icon={<Add20Regular />} disabled={rows.length >= 20} onClick={() => setRows((r) => [...r, newRow()])}>
          Add stage
        </Button>
        <span style={{ flex: 1 }} />
        {dirty && (
          <Button
            appearance="subtle"
            onClick={() => {
              setRows(rowsFromPlan(plan));
              setErrors({});
              setBlocking([]);
            }}
          >
            Discard changes
          </Button>
        )}
        <Button appearance="primary" disabled={!dirty || save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={onSave}>
          Save plan
        </Button>
      </div>
    </Card>
  );
}
