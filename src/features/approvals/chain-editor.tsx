"use client";

import {
  Button,
  Card,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Radio,
  RadioGroup,
  Subtitle2,
  Switch,
  Text,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowDown20Regular, ArrowUp20Regular, Delete20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { adminApi, adminKeys } from "@/features/admin/api";
import { UserPicker, userLabel } from "@/features/admin/user-picker";
import { IdSelect } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { ClientPicker } from "@/features/demands/client-picker";
import { EMPLOYMENT_LABELS, EMPLOYMENT_TYPES } from "@/features/demands/form";
import type { ApprovalSubjectType } from "@/lib/api/types";
import {
  type ChainDraft,
  type ChainErrors,
  CONDITION_FIELDS,
  type ConditionDraft,
  type ConditionField,
  type ConditionOp,
  type ConditionRow,
  emptyStep,
  FIELD_LABELS,
  moveItem,
  OP_LABELS,
  opsFor,
  rowError,
  type StepDraft,
} from "./conditions";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  step: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  stepHead: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
  grow: { flex: 1 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: tokens.spacingHorizontalM, alignItems: "end" },
  condRow: {
    display: "grid",
    gridTemplateColumns: "minmax(140px, 1fr) minmax(130px, 1fr) minmax(160px, 1.4fr) auto",
    gap: tokens.spacingHorizontalS,
    alignItems: "end",
    "@media (max-width: 599px)": { gridTemplateColumns: "1fr 1fr" },
  },
  muted: { color: tokens.colorNeutralForeground3 },
  error: { color: tokens.colorPaletteRedForeground1 },
});

export const SUBJECT_LABELS: Record<ApprovalSubjectType, string> = {
  demand: "Demands",
  offer: "Offers",
  margin_override: "Margin overrides",
};

function ValueInput({ row, onChange }: { row: ConditionRow; onChange: (value: string) => void }) {
  if (row.field === "employment_type" && row.op !== "in") {
    return (
      <Field label="Value" size="small">
        <Dropdown
          size="small"
          value={EMPLOYMENT_LABELS[row.value as keyof typeof EMPLOYMENT_LABELS] ?? row.value}
          selectedOptions={[row.value]}
          onOptionSelect={(_, d) => onChange(d.optionValue ?? "")}
        >
          {EMPLOYMENT_TYPES.map((t) => (
            <Option key={t} value={t}>
              {EMPLOYMENT_LABELS[t]}
            </Option>
          ))}
        </Dropdown>
      </Field>
    );
  }
  if (row.field === "client_id" && row.op !== "in") {
    return <ClientPicker label="Value" value={row.value || null} valueLabel={row.value ? "Selected client" : ""} onChange={(c) => onChange(c?.id ?? "")} />;
  }
  return (
    <Field label="Value" size="small" hint={row.op === "in" ? "Separate with commas" : undefined}>
      <Input size="small" value={row.value} onChange={(_, d) => onChange(d.value)} />
    </Field>
  );
}

function ConditionBuilder({ value, onChange }: { value: ConditionDraft; onChange: (v: ConditionDraft) => void }) {
  const styles = useStyles();
  const setRow = (i: number, patch: Partial<ConditionRow>) =>
    onChange({ ...value, rows: value.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <div className={styles.root}>
      <div className={styles.stepHead}>
        <Text weight="semibold">Condition</Text>
        {value.rows.length > 1 && (
          <Dropdown
            size="small"
            aria-label="Combine conditions"
            value={value.mode === "all" ? "All must match" : "Any may match"}
            selectedOptions={[value.mode]}
            onOptionSelect={(_, d) => onChange({ ...value, mode: d.optionValue === "any" ? "any" : "all" })}
          >
            <Option value="all">All must match</Option>
            <Option value="any">Any may match</Option>
          </Dropdown>
        )}
      </div>
      {value.rows.length === 0 && (
        <Text size={200} className={styles.muted}>
          No condition: the step always applies. Add one to skip the step when it does not match (a missing value never skips it).
        </Text>
      )}
      {value.rows.map((row, i) => {
        const err = rowError(row);
        return (
          <div key={i}>
            <div className={styles.condRow}>
              <Field label="Field" size="small">
                <Dropdown
                  size="small"
                  value={FIELD_LABELS[row.field]}
                  selectedOptions={[row.field]}
                  onOptionSelect={(_, d) => {
                    const field = d.optionValue as ConditionField;
                    const op = opsFor(field).includes(row.op) ? row.op : "eq";
                    setRow(i, { field, op, value: "" });
                  }}
                >
                  {CONDITION_FIELDS.map((f) => (
                    <Option key={f} value={f}>
                      {FIELD_LABELS[f]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Operator" size="small">
                <Dropdown
                  size="small"
                  value={OP_LABELS[row.op]}
                  selectedOptions={[row.op]}
                  onOptionSelect={(_, d) => setRow(i, { op: d.optionValue as ConditionOp })}
                >
                  {opsFor(row.field).map((o) => (
                    <Option key={o} value={o}>
                      {OP_LABELS[o]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              <ValueInput row={row} onChange={(v) => setRow(i, { value: v })} />
              <Button
                appearance="subtle"
                icon={<Delete20Regular />}
                aria-label={`Remove condition ${i + 1}`}
                onClick={() => onChange({ ...value, rows: value.rows.filter((_, j) => j !== i) })}
              />
            </div>
            {err && row.value !== "" && (
              <Text size={200} className={styles.error}>
                {err}
              </Text>
            )}
          </div>
        );
      })}
      <div>
        <Button
          size="small"
          appearance="subtle"
          icon={<Add20Regular />}
          onClick={() => onChange({ ...value, rows: [...value.rows, { field: "bill_rate", op: "gte", value: "" }] })}
        >
          Add condition
        </Button>
      </div>
    </div>
  );
}

function ApproverPicker({ step, onChange }: { step: StepDraft; onChange: (patch: Partial<StepDraft>) => void }) {
  const canUsers = usePermission("user:read");
  const canRoles = usePermission("role:read");
  const roles = useQuery({ queryKey: adminKeys.roles, queryFn: ({ signal }) => adminApi.listRoles(signal), enabled: canRoles });
  return (
    <>
      <Field label="Approver">
        <RadioGroup
          layout="horizontal"
          value={step.approverKind}
          onChange={(_, d) => onChange({ approverKind: d.value as StepDraft["approverKind"], approverId: null, approverLabel: "" })}
        >
          <Radio value="role" label="Anyone with a role" />
          <Radio value="user" label="A specific person" />
        </RadioGroup>
      </Field>
      {step.approverKind === "user" ? (
        canUsers ? (
          <UserPicker
            label="Person"
            value={step.approverId}
            valueLabel={step.approverLabel}
            onChange={(id, u) => onChange({ approverId: id, approverLabel: u ? userLabel(u) : "" })}
          />
        ) : (
          <Field label="Person" hint="You need permission to read users to pick a person.">
            <Input disabled value={step.approverLabel} />
          </Field>
        )
      ) : (
        <IdSelect
          label="Role"
          options={(roles.data ?? []).map((r) => ({ id: r.id, label: r.name }))}
          value={step.approverId}
          disabled={!canRoles}
          hint={!canRoles ? "You need permission to read roles." : undefined}
          onChange={(id) => onChange({ approverId: id, approverLabel: roles.data?.find((r) => r.id === id)?.name ?? "" })}
        />
      )}
    </>
  );
}

/**
 * Approval chain editor: name, subject, active flag and ordered steps (move up/down), each with a user
 * or role approver and an optional condition built from rows (field, operator, value).
 */
export function ChainEditor({
  value,
  onChange,
  errors,
  subjectLocked,
}: {
  value: ChainDraft;
  onChange: (next: ChainDraft) => void;
  errors: ChainErrors;
  subjectLocked?: boolean;
}) {
  const styles = useStyles();
  const setStep = (i: number, patch: Partial<StepDraft>) =>
    onChange({ ...value, steps: value.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <div className={styles.root}>
      <div className={styles.grid}>
        <Field label="Name" required validationState={errors.name ? "error" : "none"} validationMessage={errors.name}>
          <Input value={value.name} maxLength={200} onChange={(_, d) => onChange({ ...value, name: d.value })} />
        </Field>
        <Field label="Applies to">
          <Dropdown
            disabled={subjectLocked}
            value={SUBJECT_LABELS[value.subjectType]}
            selectedOptions={[value.subjectType]}
            onOptionSelect={(_, d) => d.optionValue && onChange({ ...value, subjectType: d.optionValue as ApprovalSubjectType })}
          >
            {(Object.keys(SUBJECT_LABELS) as ApprovalSubjectType[]).map((s) => (
              <Option key={s} value={s}>
                {SUBJECT_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
      </div>
      <Switch
        label="Active (one active chain per subject)"
        checked={value.isActive}
        onChange={(_, d) => onChange({ ...value, isActive: d.checked })}
      />

      <Subtitle2 as="h3">Steps</Subtitle2>
      {value.steps.map((step, i) => (
        <Card key={step.key} className={styles.step} appearance="outline">
          <div className={styles.stepHead}>
            <Text weight="semibold" className={styles.grow}>
              Step {i + 1}
            </Text>
            <Button
              appearance="subtle"
              icon={<ArrowUp20Regular />}
              aria-label={`Move step ${i + 1} up`}
              disabled={i === 0}
              onClick={() => onChange({ ...value, steps: moveItem(value.steps, i, -1) })}
            />
            <Button
              appearance="subtle"
              icon={<ArrowDown20Regular />}
              aria-label={`Move step ${i + 1} down`}
              disabled={i === value.steps.length - 1}
              onClick={() => onChange({ ...value, steps: moveItem(value.steps, i, 1) })}
            />
            <Button
              appearance="subtle"
              icon={<Delete20Regular />}
              aria-label={`Remove step ${i + 1}`}
              disabled={value.steps.length === 1}
              onClick={() => onChange({ ...value, steps: value.steps.filter((_, j) => j !== i) })}
            />
          </div>
          <Field label="Step name" required>
            <Input value={step.name} maxLength={200} placeholder="e.g. Finance review" onChange={(_, d) => setStep(i, { name: d.value })} />
          </Field>
          <ApproverPicker step={step} onChange={(patch) => setStep(i, patch)} />
          <ConditionBuilder value={step.condition} onChange={(condition) => setStep(i, { condition })} />
          {errors.steps[step.key] && (
            <Text size={200} role="alert" className={styles.error}>
              {errors.steps[step.key]}
            </Text>
          )}
        </Card>
      ))}
      <div>
        <Button icon={<Add20Regular />} disabled={value.steps.length >= 20} onClick={() => onChange({ ...value, steps: [...value.steps, emptyStep()] })}>
          Add step
        </Button>
      </div>
    </div>
  );
}
