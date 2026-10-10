"use client";

import { Field, makeStyles, SpinButton, Switch, tokens } from "@fluentui/react-components";
import { type LimitsForm, limitErrors, tierHint } from "./logic";

const useStyles = makeStyles({
  root: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: tokens.spacingHorizontalM },
});

const FIELDS: { key: keyof LimitsForm; label: string; min: number; max: (tier: number) => number }[] = [
  { key: "calls_per_minute", label: "Tool calls per session per minute", min: 5, max: (t) => Math.min(120, t) },
  { key: "calls_per_user_day", label: "Tool calls per person per day", min: 100, max: () => 2000 },
  { key: "proposals_per_hour", label: "Proposals per session per hour", min: 1, max: () => 25 },
  { key: "bulk_read_threshold", label: "Pause a session after reading this many candidates in an hour", min: 50, max: () => 500 },
  { key: "max_results", label: "Maximum records per tool result", min: 10, max: () => 50 },
];

/** "Limits" (spec B2). */
export function LimitsFormView({
  value,
  tier,
  notify,
  disabled,
  onChange,
  onNotify,
}: {
  value: LimitsForm;
  tier: number;
  notify: boolean;
  disabled: boolean;
  onChange: (v: LimitsForm) => void;
  onNotify: (v: boolean) => void;
}) {
  const styles = useStyles();
  const errors = limitErrors(value, tier);
  return (
    <div className={styles.root}>
      {FIELDS.map((f) => (
        <Field
          key={f.key}
          label={f.label}
          hint={f.key === "calls_per_minute" ? tierHint(tier) : undefined}
          validationMessage={errors[f.key]}
          validationState={errors[f.key] ? "error" : "none"}
        >
          <SpinButton
            value={value[f.key]}
            min={f.min}
            max={f.max(tier)}
            disabled={disabled}
            onChange={(_, d) => {
              const n = d.value ?? Number(d.displayValue);
              if (Number.isFinite(n)) onChange({ ...value, [f.key]: Number(n) });
            }}
          />
        </Field>
      ))}
      <Switch
        label="Tell people when an assistant connects as them for the first time"
        checked={notify}
        disabled={disabled}
        onChange={(_, d) => onNotify(d.checked)}
      />
    </div>
  );
}
