"use client";

import {
  Body1,
  Button,
  Caption1,
  Card,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  SpinButton,
  Spinner,
  Subtitle2,
  Switch,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { FairnessNav } from "./fairness-nav";
import { clampMin, isAllowedDimension, MIN_K, MIN_NOTICE_DAYS, PREFER_NOT } from "./logic";
import type { CategorySetIn, DimensionOut, FairnessSettingsOut, FairnessSettingsPatch } from "./types";
import { useFairnessPermissions, useFairnessSettings, useSaveCategorySet, useSaveFairnessSettings } from "./use-fairness";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "880px" },
  card: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalL },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: tokens.spacingHorizontalM },
  dim: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  options: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
  footer: { display: "flex", gap: tokens.spacingHorizontalS, justifyContent: "flex-end" },
});

type Draft = Omit<FairnessSettingsOut, "category_set">;

function toDraft(s: FairnessSettingsOut): Draft {
  const { category_set: _ignored, ...rest } = s;
  void _ignored;
  return rest;
}

/** `/fairness/settings`: self-ID switches, category labels, k, LL144 texts and notice lead days. */
export function FairnessSettingsView() {
  const styles = useStyles();
  const { canRead, canConfigure } = useFairnessPermissions();
  const q = useFairnessSettings(canRead || canConfigure);
  if (!canRead && !canConfigure) return <NoAccess what="fairness settings" />;
  return (
    <>
      <PageHeader title="Fairness settings" subtitle="Voluntary self-identification, small-cell suppression and NYC Local Law 144." />
      <FairnessNav current="settings" />
      {q.isPending ? (
        <GridSkeleton rows={6} />
      ) : q.isError ? (
        <ErrorBar title="Could not load the settings." message={errorMessage(q.error)} />
      ) : (
        <div className={styles.stack}>
          <GeneralForm key={`g-${JSON.stringify(toDraft(q.data))}`} settings={q.data} readOnly={!canConfigure} />
          <CategoryEditor key={`c-${q.data.category_set.id}-${q.data.category_set.version}`} dimensions={q.data.category_set.dimensions} version={q.data.category_set.version} readOnly={!canConfigure} />
        </div>
      )}
    </>
  );
}

function GeneralForm({ settings, readOnly }: { settings: FairnessSettingsOut; readOnly: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const save = useSaveFairnessSettings();
  const [d, setD] = useState<Draft>(() => toDraft(settings));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const text = (k: "ll144_notice_text" | "alternative_process_text" | "data_retention_text" | "qualifications_text", label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <Textarea value={d[k] ?? ""} resize="vertical" rows={4} disabled={readOnly} onChange={(_, x) => set(k, x.value || null)} />
    </Field>
  );
  const submit = () => {
    const body: FairnessSettingsPatch = {
      ...d,
      k: clampMin(d.k, MIN_K),
      notice_lead_business_days: clampMin(d.notice_lead_business_days, MIN_NOTICE_DAYS),
    };
    save.mutate(body, { onSuccess: () => toast.success("Fairness settings saved."), onError: (e) => toast.error(errorMessage(e)) });
  };
  return (
    <>
      <Card className={styles.card}>
        <Subtitle2 as="h2">Self-identification</Subtitle2>
        <Body1 className={styles.muted}>
          Candidates may optionally share gender, age band and disability under a separate notice. Answers are stored encrypted,
          never shown to recruiters and used only in aggregate reports.
        </Body1>
        <Switch label="Enable self-identification" checked={d.self_id_enabled} disabled={readOnly} onChange={(_, x) => set("self_id_enabled", x.checked)} />
        <Switch label="Ask after a careers application" checked={d.self_id_on_apply} disabled={readOnly || !d.self_id_enabled} onChange={(_, x) => set("self_id_on_apply", x.checked)} />
        <Switch label="Show in the candidate portal" checked={d.self_id_in_portal} disabled={readOnly || !d.self_id_enabled} onChange={(_, x) => set("self_id_in_portal", x.checked)} />
        <Field label="Minimum cell size (k)" hint={`Counts below k are shown as "<k" in reports. At least ${MIN_K}.`}>
          <SpinButton
            min={MIN_K}
            max={100}
            value={d.k}
            disabled={readOnly}
            onChange={(_, x) => {
              const v = x.value ?? (x.displayValue !== undefined ? Number.parseInt(x.displayValue, 10) : NaN);
              if (Number.isFinite(v)) set("k", Math.max(MIN_K, v as number));
            }}
          />
        </Field>
      </Card>
      <Card className={styles.card}>
        <Subtitle2 as="h2">NYC Local Law 144</Subtitle2>
        <Switch label="Enable LL144 notices and score hiding" checked={d.ll144_enabled} disabled={readOnly} onChange={(_, x) => set("ll144_enabled", x.checked)} />
        <Field label="Notice lead time (business days)" hint={`Scores stay hidden for this long after the notice is published. At least ${MIN_NOTICE_DAYS}.`}>
          <SpinButton
            min={MIN_NOTICE_DAYS}
            max={60}
            value={d.notice_lead_business_days}
            disabled={readOnly}
            onChange={(_, x) => {
              const v = x.value ?? (x.displayValue !== undefined ? Number.parseInt(x.displayValue, 10) : NaN);
              if (Number.isFinite(v)) set("notice_lead_business_days", Math.max(MIN_NOTICE_DAYS, v as number));
            }}
          />
        </Field>
        {text("ll144_notice_text", "Notice text", "Shown to candidates on flagged postings and when applying.")}
        {text("qualifications_text", "Job qualifications and characteristics assessed")}
        {text("data_retention_text", "Data type, source and retention policy")}
        {text("alternative_process_text", "Alternative selection process or accommodation")}
      </Card>
      {!readOnly && (
        <div className={styles.footer}>
          <Button appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
            Save settings
          </Button>
        </div>
      )}
    </>
  );
}

function CategoryEditor({ dimensions, version, readOnly }: { dimensions: DimensionOut[]; version: number; readOnly: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const save = useSaveCategorySet();
  const [dims, setDims] = useState<DimensionOut[]>(() =>
    dimensions.filter((x) => isAllowedDimension(x.key)).sort((a, b) => a.position - b.position),
  );
  const patch = (key: string, p: Partial<DimensionOut>) => setDims((all) => all.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const setOption = (dimKey: string, optKey: string, label: string) =>
    setDims((all) => all.map((x) => (x.key === dimKey ? { ...x, options: x.options.map((o) => (o.key === optKey ? { ...o, label } : o)) } : x)));
  const invalid = dims.some((x) => !x.label.trim() || x.options.some((o) => !o.label.trim()));
  const submit = () => {
    const body: CategorySetIn = {
      dimensions: dims.map((x) => ({ key: x.key, label: x.label.trim(), enabled: x.enabled, options: x.options.map((o) => ({ key: o.key, label: o.label.trim() })) })),
    };
    save.mutate(body, { onSuccess: () => toast.success("Categories saved as a new version."), onError: (e) => toast.error(errorMessage(e)) });
  };
  return (
    <Card className={styles.card}>
      <Subtitle2 as="h2">Categories (version {version})</Subtitle2>
      <MessageBar intent="info" layout="multiline">
        <MessageBarBody>
          Only gender, age band and disability can be collected. You can rename categories and turn a dimension off; categories
          cannot be added. Caste, religion and race or ethnicity are never collected.
        </MessageBarBody>
      </MessageBar>
      {dims.map((x) => (
        <fieldset key={x.key} className={styles.dim}>
          <legend>
            <Caption1>{x.key}</Caption1>
          </legend>
          <div className={styles.grid}>
            <Field label="Question label" required>
              <Input value={x.label} disabled={readOnly} onChange={(_, v) => patch(x.key, { label: v.value })} />
            </Field>
            <Switch label="Ask this question" checked={x.enabled} disabled={readOnly} onChange={(_, v) => patch(x.key, { enabled: v.checked })} />
          </div>
          <div className={styles.options}>
            {x.options.map((o) => (
              <Field key={o.key} label={o.key === PREFER_NOT ? "Prefer not to say (default)" : `Option: ${o.key}`}>
                <Input value={o.label} disabled={readOnly} onChange={(_, v) => setOption(x.key, o.key, v.value)} />
              </Field>
            ))}
          </div>
        </fieldset>
      ))}
      {!readOnly && (
        <div className={styles.footer}>
          <Button appearance="primary" disabled={save.isPending || invalid} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
            Save categories
          </Button>
        </div>
      )}
    </Card>
  );
}
