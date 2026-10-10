"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  InteractionTag,
  InteractionTagPrimary,
  InteractionTagSecondary,
  makeStyles,
  Spinner,
  TagGroup,
  tokens,
} from "@fluentui/react-components";
import { Edit20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { DetailsDrawer, ErrorBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { Candidate360Out, CandidateSkillIn, CandidateSkillOut } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { SkillRowsEditor } from "./candidate-form";
import { candidateErrorMessage } from "./errors";
import { formatDate } from "./format";
import { type FormErrors, type SkillRow, skillsBody } from "./form";
import { SkillPicker } from "./skill-picker";
import { useCandidateMutation } from "./use-candidates";
import { SkillProficiencySection } from "@/features/skills/evidence-panel";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "900px" },
  head: { display: "flex", gap: tokens.spacingHorizontalM, alignItems: "flex-end", flexWrap: "wrap" },
  picker: { flex: "1 1 280px", maxWidth: "420px" },
  muted: { color: tokens.colorNeutralForeground3 },
});

function toInput(s: CandidateSkillOut): CandidateSkillIn {
  return { ref: { kind: s.skill.kind, id: s.skill.id }, years: s.years, last_used: s.last_used, source: s.source };
}

function toRow(s: CandidateSkillOut): SkillRow {
  return {
    name: s.skill.name,
    ref: { kind: s.skill.kind, id: s.skill.id },
    years: s.years ?? "",
    last_used: s.last_used ?? "",
    source: s.source,
  };
}

function chipDetail(s: CandidateSkillOut): string {
  const parts: string[] = [];
  if (s.years) parts.push(`${Number(s.years)} yr${Number(s.years) === 1 ? "" : "s"}`);
  if (s.last_used) parts.push(`last used ${formatDate(s.last_used)}`);
  return parts.join(" · ");
}

/** Skill chips (years / last used), typeahead add and a details editor; every change PUTs the full set. */
export function SkillsTab({ c }: { c: Candidate360Out }) {
  const styles = useStyles();
  const canEdit = usePermission("candidate:update") && c.can_edit !== false;
  const [editing, setEditing] = useState(false);
  const save = useCandidateMutation({
    mutationFn: (skills: CandidateSkillIn[]) => candidatesApi.setSkills(c.id, skills),
    invalidate: [candidateKeys.detail(c.id)],
    toastErrors: true,
  });
  const current = c.skills.map(toInput);

  return (
    <div className={styles.root}>
      {canEdit && (
        <div className={styles.head}>
          <SkillPicker
            className={styles.picker}
            disabled={save.isPending}
            excludeKeys={c.skills.map((s) => `${s.skill.kind}:${s.skill.id}`)}
            onPick={(skill, text) =>
              save.mutate([
                ...current,
                skill ? { ref: { kind: skill.kind, id: skill.id }, source: "manual" } : { name: text, source: "manual" },
              ])
            }
          />
          <Button icon={<Edit20Regular />} disabled={c.skills.length === 0} onClick={() => setEditing(true)}>
            Edit years and dates
          </Button>
          {save.isPending && <Spinner size="tiny" label="Saving…" />}
        </div>
      )}
      {c.skills.length === 0 ? (
        <Body1 className={styles.muted}>No skills yet.</Body1>
      ) : (
        <TagGroup
          aria-label="Skills"
          style={{ flexWrap: "wrap", gap: 8 }}
          onDismiss={
            canEdit
              ? (_, d) => save.mutate(c.skills.filter((s) => s.id !== d.value).map(toInput))
              : undefined
          }
        >
          {c.skills.map((s) => (
            <InteractionTag key={s.id} value={s.id} shape="rounded" appearance={s.skill.status === "pending" ? "outline" : "filled"}>
              <InteractionTagPrimary
                hasSecondaryAction={canEdit}
                secondaryText={chipDetail(s) || undefined}
              >
                {s.skill.name}
                {s.source === "parsed" && (
                  <Badge size="tiny" appearance="tint" color="brand" style={{ marginLeft: 4 }} aria-label="from resume" />
                )}
              </InteractionTagPrimary>
              {canEdit && <InteractionTagSecondary aria-label={`Remove ${s.skill.name}`} />}
            </InteractionTag>
          ))}
        </TagGroup>
      )}
      <Caption1 className={styles.muted}>Outlined skills are pending review by an administrator.</Caption1>
      {/* Epic 37: proficiency, verification, evidence and suggestions */}
      <SkillProficiencySection candidateId={c.id} />
      {editing && <SkillDetailsDrawer c={c} onClose={() => setEditing(false)} />}
    </div>
  );
}

function SkillDetailsDrawer({ c, onClose }: { c: Candidate360Out; onClose: () => void }) {
  const [rows, setRows] = useState<SkillRow[]>(() => c.skills.map(toRow));
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const save = useCandidateMutation({
    mutationFn: (skills: CandidateSkillIn[]) => candidatesApi.setSkills(c.id, skills),
    invalidate: [candidateKeys.detail(c.id)],
    success: "Skills saved",
  });

  async function submit() {
    const errs: FormErrors = {};
    rows.forEach((r, i) => {
      const y = r.years.trim();
      if (y && (!Number.isFinite(Number(y)) || Number(y) < 0 || Number(y) > 60)) errs[`skills.${i}.years`] = "0–60";
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setError(null);
    try {
      await save.mutateAsync(skillsBody(rows) as CandidateSkillIn[]);
      onClose();
    } catch (e) {
      setError(candidateErrorMessage(e));
    }
  }

  return (
    <DetailsDrawer
      open
      size="medium"
      title="Edit skills"
      onClose={() => !save.isPending && onClose()}
      footer={
        <>
          <Button
            appearance="primary"
            disabled={save.isPending}
            icon={save.isPending ? <Spinner size="tiny" /> : undefined}
            onClick={submit}
          >
            Save
          </Button>
          <Button disabled={save.isPending} onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <ErrorBar message={error} />
      <SkillRowsEditor rows={rows} errors={errors} onChange={setRows} />
    </DetailsDrawer>
  );
}
