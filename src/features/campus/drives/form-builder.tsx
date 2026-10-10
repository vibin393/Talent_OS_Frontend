"use client";

import {
  Badge,
  Button,
  Caption1,
  Checkbox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  Option,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowDown20Regular, ArrowUp20Regular, Delete20Regular, LockClosed16Regular } from "@fluentui/react-icons";
import { FIELD_KIND_LABELS, FIELD_KINDS, isProtectedKey, keyFromLabel, MAX_CUSTOM_FIELDS, STANDARD_KEYS, validateFormSchema } from "../logic";
import type { FieldKind, FormField } from "../types";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  standard: { backgroundColor: tokens.colorNeutralBackground2 },
  invalid: { border: `${tokens.strokeWidthThick} solid ${tokens.colorPaletteRedBorder2}` },
  head: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, flexWrap: "wrap" },
  grow: { flex: 1 },
  grid: { display: "grid", gap: tokens.spacingHorizontalM, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" },
  error: { color: tokens.colorPaletteRedForeground1 },
  muted: { color: tokens.colorNeutralForeground3 },
});

/**
 * Registration form builder (`form_schema.fields`). Standard fields (program, branch, CGPA, percentage, backlogs,
 * graduation year) are always present and typed; up to 20 custom fields. Protected characteristics (caste,
 * religion, gender, age, …) are refused as keys.
 */
export function FormBuilder({
  fields,
  onChange,
  disabled,
}: {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const errors = validateFormSchema(fields);
  const customCount = fields.filter((f) => !STANDARD_KEYS.has(f.key)).length;
  const set = (i: number, patch: Partial<FormField>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, by: number) => {
    const next = [...fields];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item);
    onChange(next);
  };
  const firstCustom = fields.findIndex((f) => !STANDARD_KEYS.has(f.key));

  return (
    <div className={styles.root}>
      <Caption1 className={styles.muted}>
        Candidates also give their name, email and phone. Never collect protected characteristics: caste, religion, race,
        ethnicity, gender, age, date of birth, disability or marital status.
      </Caption1>
      {fields.map((f, i) => {
        const standard = STANDARD_KEYS.has(f.key) && !!f.standard;
        const err = errors[i];
        const keyProtected = isProtectedKey(f.key);
        return (
          <section
            key={standard ? f.key : `custom-${i}`}
            className={mergeClasses(styles.field, standard && styles.standard, err && styles.invalid)}
            aria-label={`Field ${f.label || i + 1}`}
          >
            <div className={styles.head}>
              <Text weight="semibold" className={styles.grow}>
                {f.label || "New field"}
              </Text>
              {standard ? (
                <Badge appearance="outline" icon={<LockClosed16Regular />}>
                  Standard
                </Badge>
              ) : (
                <>
                  <Button
                    appearance="subtle"
                    icon={<ArrowUp20Regular />}
                    aria-label={`Move ${f.label || "field"} up`}
                    disabled={disabled || i <= firstCustom}
                    onClick={() => move(i, -1)}
                  />
                  <Button
                    appearance="subtle"
                    icon={<ArrowDown20Regular />}
                    aria-label={`Move ${f.label || "field"} down`}
                    disabled={disabled || i === fields.length - 1}
                    onClick={() => move(i, 1)}
                  />
                  <Button
                    appearance="subtle"
                    icon={<Delete20Regular />}
                    aria-label={`Remove ${f.label || "field"}`}
                    disabled={disabled}
                    onClick={() => onChange(fields.filter((_, j) => j !== i))}
                  />
                </>
              )}
            </div>
            <div className={styles.grid}>
              <Field label="Label" required>
                <Input
                  value={f.label}
                  maxLength={200}
                  disabled={disabled}
                  onChange={(_, d) => {
                    // The key follows the label until it is edited by hand.
                    const auto = !standard && (f.key === "" || f.key === keyFromLabel(f.label));
                    set(i, auto ? { label: d.value, key: keyFromLabel(d.value) } : { label: d.value });
                  }}
                />
              </Field>
              <Field
                label="Key"
                hint={standard ? undefined : "a–z, 0–9 and _"}
                validationState={keyProtected ? "error" : "none"}
                validationMessage={keyProtected ? "Protected characteristic: not allowed." : undefined}
              >
                <Input value={f.key} maxLength={40} disabled={disabled || standard} onChange={(_, d) => set(i, { key: d.value.toLowerCase() })} />
              </Field>
              <Field label="Type">
                <Dropdown
                  value={FIELD_KIND_LABELS[f.type]}
                  selectedOptions={[f.type]}
                  disabled={disabled || standard}
                  onOptionSelect={(_, d) => set(i, { type: d.optionValue as FieldKind })}
                >
                  {FIELD_KINDS.map((k) => (
                    <Option key={k} value={k}>
                      {FIELD_KIND_LABELS[k]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
              {(f.type === "number" || f.type === "decimal") && (
                <>
                  <Field label="Minimum">
                    <Input
                      type="number"
                      value={f.min == null ? "" : String(f.min)}
                      disabled={disabled || standard}
                      onChange={(_, d) => set(i, { min: d.value })}
                    />
                  </Field>
                  <Field label="Maximum">
                    <Input
                      type="number"
                      value={f.max == null ? "" : String(f.max)}
                      disabled={disabled || standard}
                      onChange={(_, d) => set(i, { max: d.value })}
                    />
                  </Field>
                </>
              )}
            </div>
            {(f.type === "select" || f.type === "multiselect") &&
              (standard ? (
                <Caption1 className={styles.muted}>
                  {f.key === "program" ? "Options come from the Institutions' programs." : "Options are the chosen program's branches."}
                </Caption1>
              ) : (
                <Field label="Options" hint="One per line">
                  <Textarea
                    value={(f.options ?? []).join("\n")}
                    resize="vertical"
                    disabled={disabled}
                    onChange={(_, d) => set(i, { options: d.value.split("\n") })}
                  />
                </Field>
              ))}
            <Field label="Help text">
              <Input value={f.help ?? ""} maxLength={500} disabled={disabled} onChange={(_, d) => set(i, { help: d.value })} />
            </Field>
            <Checkbox label="Required" checked={!!f.required} disabled={disabled} onChange={(_, d) => set(i, { required: Boolean(d.checked) })} />
            {err && (
              <Text role="alert" className={styles.error}>
                {err}
              </Text>
            )}
          </section>
        );
      })}
      <div>
        <Button
          icon={<Add20Regular />}
          disabled={disabled || customCount >= MAX_CUSTOM_FIELDS}
          onClick={() => onChange([...fields, { key: "", label: "", type: "text", required: false, standard: false }])}
        >
          Add field
        </Button>{" "}
        <Caption1 className={styles.muted}>
          {customCount} of {MAX_CUSTOM_FIELDS} custom fields
        </Caption1>
      </div>
    </div>
  );
}
