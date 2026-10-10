"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Label,
  makeStyles,
  Option,
  Rating,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Dismiss16Regular } from "@fluentui/react-icons";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { SkillPicker } from "@/features/candidates/skill-picker";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { workforceApi } from "./api";
import { isMonth, LINE_TYPE_LABELS, normaliseMoney, RATE_UNIT_LABELS, WORK_MODE_LABELS } from "./logic";
import type { LineIn, LineOut, LineRateUnit, LineSkillIn, LineType, LineUpdate, PlanOut, WorkMode } from "./types";

const useStyles = makeStyles({
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: tokens.spacingHorizontalM },
  skills: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  skillRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  skillName: { flex: 1, minWidth: 0 },
  surface: { maxWidth: "720px", width: "100%" },
});

type SkillDraft = { skill_key: string | null; name: string; min_proficiency: number | null };

type Draft = {
  role_title: string;
  line_type: LineType;
  headcount: string;
  location_text: string;
  work_mode: WorkMode | "";
  start_month: string;
  end_month: string;
  budget_amount: string;
  bill_rate_amount: string;
  rate_unit: LineRateUnit | "";
  notes: string;
  skills: SkillDraft[];
};

function toDraft(line: LineOut | null): Draft {
  return {
    role_title: line?.role_title ?? "",
    line_type: line?.line_type ?? "new",
    headcount: String(line?.headcount ?? 1),
    location_text: line?.location_text ?? "",
    work_mode: line?.work_mode ?? "",
    start_month: line?.start_month ?? "",
    end_month: line && line.period_end ? line.period_end.slice(0, 7) : "",
    budget_amount: line?.budget_amount ?? "",
    bill_rate_amount: line?.bill_rate_amount ?? "",
    rate_unit: line?.rate_unit ?? "",
    notes: line?.notes ?? "",
    skills: (line?.skills ?? []).map((s) => ({ skill_key: s.skill_key, name: s.name, min_proficiency: s.min_proficiency })),
  };
}

function skillsIn(skills: SkillDraft[]): LineSkillIn[] {
  return skills.map((s) => (s.skill_key ? { skill_key: s.skill_key, min_proficiency: s.min_proficiency } : { name: s.name, min_proficiency: s.min_proficiency }));
}

/** Add or edit a plan line: role, skills with min proficiency (1–5), headcount, months and Money as decimal strings. */
export function LineDialog({
  plan,
  line,
  maxHeadcount,
  onClose,
  onSaved,
}: {
  plan: PlanOut;
  line: LineOut | null;
  maxHeadcount?: number;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const id = useId();
  const original = toDraft(line);
  const [d, setD] = useState<Draft>(original);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const budget = normaliseMoney(d.budget_amount);
  const rate = normaliseMoney(d.bill_rate_amount);
  const hc = Number(d.headcount);
  const hcError = !/^\d+$/.test(d.headcount) || hc < 1 ? "At least 1" : maxHeadcount && hc > maxHeadcount ? `At most ${maxHeadcount}` : undefined;
  const startError = d.start_month && !isMonth(d.start_month) ? "Use YYYY-MM" : undefined;
  const endError = d.end_month && (!isMonth(d.end_month) || d.end_month < d.start_month) ? "Must be a month on or after the start" : undefined;
  const moneyMasked = plan.money_masked;

  const save = useMutation({
    mutationFn: async () => {
      const full: LineIn = {
        role_title: d.role_title.trim(),
        line_type: d.line_type,
        headcount: hc,
        location_text: d.location_text.trim() || null,
        work_mode: d.work_mode || null,
        start_month: d.start_month,
        end_month: d.end_month || null,
        notes: d.notes.trim() || null,
        skills: skillsIn(d.skills),
      };
      if (!moneyMasked) {
        full.budget_amount = budget.ok ? budget.value : null;
        full.bill_rate_amount = rate.ok ? rate.value : null;
        full.rate_unit = d.rate_unit || null;
      }
      if (!line) return workforceApi.addLine(plan.id, full);
      // PATCH only what changed (so a masked or untouched amount is never cleared).
      const body: LineUpdate = {};
      if (d.role_title !== original.role_title) body.role_title = full.role_title;
      if (d.line_type !== original.line_type) body.line_type = full.line_type;
      if (d.headcount !== original.headcount) body.headcount = full.headcount;
      if (d.location_text !== original.location_text) body.location_text = full.location_text;
      if (d.work_mode !== original.work_mode) body.work_mode = full.work_mode;
      if (d.start_month !== original.start_month) body.start_month = full.start_month;
      if (d.end_month !== original.end_month) body.end_month = full.end_month;
      if (d.notes !== original.notes) body.notes = full.notes;
      if (JSON.stringify(d.skills) !== JSON.stringify(original.skills)) body.skills = full.skills;
      if (!moneyMasked) {
        if (d.budget_amount !== original.budget_amount) body.budget_amount = full.budget_amount;
        if (d.bill_rate_amount !== original.bill_rate_amount) body.bill_rate_amount = full.bill_rate_amount;
        if (d.rate_unit !== original.rate_unit) body.rate_unit = full.rate_unit;
      }
      return workforceApi.updateLine(plan.id, line.id, body);
    },
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  const errors = fieldErrors(save.error);
  const valid =
    !!d.role_title.trim() && !hcError && !!d.start_month && !startError && !endError && (moneyMasked || (budget.ok && rate.ok));

  return (
    <Dialog open onOpenChange={(_, x) => !x.open && !save.isPending && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>{line ? `Edit "${line.role_title}"` : "Add line"}</DialogTitle>
          <DialogContent>
            <div className={admin.form}>
              <ErrorBar message={save.error && !Object.keys(errors).length ? errorMessage(save.error) : null} />
              <Field label="Role" required validationMessage={errors.role_title}>
                <Input value={d.role_title} onChange={(_, v) => set("role_title", v.value)} placeholder="e.g. Senior Java developer" />
              </Field>
              <div className={styles.grid2}>
                <Field label="Type">
                  <Dropdown
                    value={LINE_TYPE_LABELS[d.line_type]}
                    selectedOptions={[d.line_type]}
                    onOptionSelect={(_, v) => v.optionValue && set("line_type", v.optionValue as LineType)}
                  >
                    {(Object.keys(LINE_TYPE_LABELS) as LineType[]).map((t) => (
                      <Option key={t} value={t}>
                        {LINE_TYPE_LABELS[t]}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="Headcount" required validationMessage={hcError ?? errors.headcount}>
                  <Input type="number" min={1} value={d.headcount} onChange={(_, v) => set("headcount", v.value)} />
                </Field>
                <Field label="Start month" required validationMessage={startError ?? errors.start_month}>
                  <Input type="month" value={d.start_month} onChange={(_, v) => set("start_month", v.value)} placeholder="YYYY-MM" />
                </Field>
                <Field label="End month" validationMessage={endError ?? errors.end_month}>
                  <Input type="month" value={d.end_month} onChange={(_, v) => set("end_month", v.value)} placeholder="YYYY-MM" />
                </Field>
                <Field label="Location">
                  <Input value={d.location_text} onChange={(_, v) => set("location_text", v.value)} />
                </Field>
                <Field label="Work mode">
                  <Dropdown
                    value={d.work_mode ? WORK_MODE_LABELS[d.work_mode] : "Not set"}
                    selectedOptions={[d.work_mode]}
                    onOptionSelect={(_, v) => set("work_mode", (v.optionValue ?? "") as WorkMode | "")}
                  >
                    <Option value="">Not set</Option>
                    {(Object.keys(WORK_MODE_LABELS) as WorkMode[]).map((m) => (
                      <Option key={m} value={m}>
                        {WORK_MODE_LABELS[m]}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              </div>

              <div className={styles.skills}>
                <SkillPicker
                  label="Skills"
                  excludeKeys={d.skills.map((s) => s.skill_key ?? "")}
                  onPick={(skill, text) => {
                    const key = skill ? `${skill.kind}:${skill.id}` : null;
                    const name = skill?.name ?? text;
                    if (d.skills.some((s) => (key && s.skill_key === key) || s.name.toLowerCase() === name.toLowerCase())) return;
                    set("skills", [...d.skills, { skill_key: key, name, min_proficiency: 3 }]);
                  }}
                />
                {d.skills.map((s, i) => (
                  <div key={`${s.skill_key ?? s.name}-${i}`} className={styles.skillRow}>
                    <Label id={`${id}-sk-${i}`} className={styles.skillName}>
                      {s.name}
                      {!s.skill_key ? " (matched by name)" : ""}
                    </Label>
                    <Rating
                      aria-labelledby={`${id}-sk-${i}`}
                      max={5}
                      step={1}
                      size="medium"
                      value={s.min_proficiency ?? 0}
                      itemLabel={(n) => `Minimum proficiency ${n} of 5`}
                      onChange={(_, v) => set("skills", d.skills.map((x, j) => (j === i ? { ...x, min_proficiency: v.value } : x)))}
                    />
                    <Text size={200} aria-hidden>
                      {s.min_proficiency ? `${s.min_proficiency}/5` : "Any"}
                    </Text>
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Dismiss16Regular />}
                      aria-label={`Remove ${s.name}`}
                      onClick={() => set("skills", d.skills.filter((_, j) => j !== i))}
                    />
                  </div>
                ))}
              </div>

              {moneyMasked ? (
                <Text size={200} className={admin.muted}>
                  Budget and bill rate are hidden (you do not have compensation access).
                </Text>
              ) : (
                <div className={styles.grid2}>
                  <Field
                    label={`Budget (${plan.currency})`}
                    validationState={budget.ok ? "none" : "error"}
                    validationMessage={budget.ok ? errors.budget_amount : budget.error}
                  >
                    <Input inputMode="decimal" value={d.budget_amount} onChange={(_, v) => set("budget_amount", v.value)} placeholder="0.00" />
                  </Field>
                  <Field
                    label={`Bill rate (${plan.currency})`}
                    validationState={rate.ok ? "none" : "error"}
                    validationMessage={rate.ok ? errors.bill_rate_amount : rate.error}
                  >
                    <Input inputMode="decimal" value={d.bill_rate_amount} onChange={(_, v) => set("bill_rate_amount", v.value)} placeholder="0.00" />
                  </Field>
                  <Field label="Rate unit">
                    <Dropdown
                      value={d.rate_unit ? RATE_UNIT_LABELS[d.rate_unit] : "Not set"}
                      selectedOptions={[d.rate_unit]}
                      onOptionSelect={(_, v) => set("rate_unit", (v.optionValue ?? "") as LineRateUnit | "")}
                    >
                      <Option value="">Not set</Option>
                      {(Object.keys(RATE_UNIT_LABELS) as LineRateUnit[]).map((u) => (
                        <Option key={u} value={u}>
                          {RATE_UNIT_LABELS[u]}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                </div>
              )}
              <Field label="Notes">
                <Textarea value={d.notes} onChange={(_, v) => set("notes", v.value)} />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
              {line ? "Save line" : "Add line"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
