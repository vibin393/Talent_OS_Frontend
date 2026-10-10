"use client";

import {
  Button,
  Caption1,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Spinner,
  SpinButton,
  Subtitle2,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { DetailsDrawer, ErrorBar } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { interviewKeys, interviewsApi } from "./api";
import { emptyKit, type KitDraft, kitDraftFrom, toKitPayload, validateKit } from "./kit";
import type { KitOut } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  item: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  itemHead: { display: "flex", alignItems: "flex-end", gap: tokens.spacingHorizontalS },
  grow: { flex: 1 },
  muted: { color: tokens.colorNeutralForeground3 },
});

const NO_COMPETENCY = "__none__";

/** Kit editor drawer: competencies with guidance, questions with guidance (optionally tied to a competency), rating scale. */
export function KitEditor({ kit, defaultScale = 5, onClose }: { kit: KitOut | null; defaultScale?: number; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<KitDraft>(() => (kit ? kitDraftFrom(kit) : emptyKit(defaultScale)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => {
      const body = toKitPayload(draft);
      return kit ? interviewsApi.updateKit(kit.id, body) : interviewsApi.createKit(body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: interviewKeys.kits }),
  });

  const submit = async () => {
    const e = validateKit(draft);
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      const saved = await save.mutateAsync();
      toast.success(kit ? `Saved “${saved.name}” (version ${saved.version})` : `Created “${saved.name}”`);
      onClose();
    } catch {
      // shown in the drawer
    }
  };

  const setComp = (i: number, patch: Partial<KitDraft["competencies"][number]>) =>
    setDraft((d) => ({ ...d, competencies: d.competencies.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const setQ = (i: number, patch: Partial<KitDraft["questions"][number]>) =>
    setDraft((d) => ({ ...d, questions: d.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }));

  return (
    <DetailsDrawer
      open
      size="large"
      title={kit ? `Edit kit · ${kit.name}` : "New interview kit"}
      onClose={onClose}
      footer={
        <>
          <Button appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={submit}>
            Save kit
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </>
      }
    >
      <div className={styles.form}>
        {kit && <Caption1 className={styles.muted}>Saving creates version {kit.version + 1}. Scorecards already started keep the version they were created with.</Caption1>}
        <ErrorBar message={save.error ? errorMessage(save.error) : null} />
        <Field label="Name" required validationState={errors.name ? "error" : "none"} validationMessage={errors.name}>
          <Input value={draft.name} maxLength={200} onChange={(_, d) => setDraft((x) => ({ ...x, name: d.value }))} />
        </Field>
        <Field label="Description">
          <Textarea value={draft.description} maxLength={4000} onChange={(_, d) => setDraft((x) => ({ ...x, description: d.value }))} />
        </Field>
        <Field label="Rating scale" hint="Interviewers rate each competency from 1 to this number." validationState={errors.ratingScale ? "error" : "none"} validationMessage={errors.ratingScale}>
          <SpinButton
            value={draft.ratingScale}
            min={3}
            max={10}
            onChange={(_, d) => {
              const v = d.value ?? Number(d.displayValue);
              if (Number.isFinite(v)) setDraft((x) => ({ ...x, ratingScale: Number(v) }));
            }}
          />
        </Field>

        <Subtitle2 as="h3">Competencies</Subtitle2>
        {errors.competencies && <Caption1 style={{ color: tokens.colorPaletteRedForeground1 }}>{errors.competencies}</Caption1>}
        {draft.competencies.map((c, i) => (
          <div key={i} className={styles.item}>
            <div className={styles.itemHead}>
              <Field label={`Competency ${i + 1}`} className={styles.grow}>
                <Input value={c.label} maxLength={200} onChange={(_, d) => setComp(i, { label: d.value })} />
              </Field>
              <Button
                appearance="subtle"
                icon={<Delete20Regular />}
                aria-label={`Remove competency ${i + 1}`}
                disabled={draft.competencies.length <= 1}
                onClick={() => setDraft((d) => ({ ...d, competencies: d.competencies.filter((_, j) => j !== i) }))}
              />
            </div>
            <Field label="Guidance for interviewers" size="small">
              <Textarea value={c.guidance} maxLength={4000} onChange={(_, d) => setComp(i, { guidance: d.value })} />
            </Field>
          </div>
        ))}
        <Button
          icon={<Add20Regular />}
          disabled={draft.competencies.length >= 30}
          onClick={() => setDraft((d) => ({ ...d, competencies: [...d.competencies, { key: "", label: "", guidance: "" }] }))}
          style={{ alignSelf: "flex-start" }}
        >
          Add competency
        </Button>

        <Subtitle2 as="h3">Questions</Subtitle2>
        {draft.questions.length === 0 && <Caption1 className={styles.muted}>Optional. Interviewers write a note per question.</Caption1>}
        {draft.questions.map((q, i) => {
          const comps = draft.competencies.filter((c) => c.label.trim());
          const current = comps.find((c) => (c.key || c.label) === q.competencyKey);
          return (
            <div key={i} className={styles.item}>
              <div className={styles.itemHead}>
                <Field label={`Question ${i + 1}`} className={styles.grow} validationState={errors[`question-${i}`] ? "error" : "none"} validationMessage={errors[`question-${i}`]}>
                  <Textarea value={q.text} maxLength={2000} onChange={(_, d) => setQ(i, { text: d.value })} />
                </Field>
                <Button
                  appearance="subtle"
                  icon={<Delete20Regular />}
                  aria-label={`Remove question ${i + 1}`}
                  onClick={() => setDraft((d) => ({ ...d, questions: d.questions.filter((_, j) => j !== i) }))}
                />
              </div>
              <Field label="Competency" size="small">
                <Dropdown
                  size="small"
                  value={current?.label ?? "Any"}
                  selectedOptions={[q.competencyKey ?? NO_COMPETENCY]}
                  onOptionSelect={(_, d) => setQ(i, { competencyKey: d.optionValue === NO_COMPETENCY ? null : (d.optionValue ?? null) })}
                >
                  <Option value={NO_COMPETENCY}>Any</Option>
                  {comps
                    .filter((c) => c.key)
                    .map((c) => (
                      <Option key={c.key} value={c.key}>
                        {c.label}
                      </Option>
                    ))}
                </Dropdown>
              </Field>
              <Field label="Guidance" size="small">
                <Textarea value={q.guidance} maxLength={4000} onChange={(_, d) => setQ(i, { guidance: d.value })} />
              </Field>
            </div>
          );
        })}
        <Button
          icon={<Add20Regular />}
          disabled={draft.questions.length >= 100}
          onClick={() => setDraft((d) => ({ ...d, questions: [...d.questions, { key: "", competencyKey: null, text: "", guidance: "" }] }))}
          style={{ alignSelf: "flex-start" }}
        >
          Add question
        </Button>
      </div>
    </DetailsDrawer>
  );
}
