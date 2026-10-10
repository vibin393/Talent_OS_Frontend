"use client";

import { Button, Dropdown, Field, Input, makeStyles, Option, tokens } from "@fluentui/react-components";
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { canAddFilter, FILTER_FIELD_LABELS } from "./logic";

const useStyles = makeStyles({
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "end", flexWrap: "wrap" },
  col: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
});

/** "Filters" (Epic 68, B3): up to 3 rows of "Field" + "Values" (ids or values, comma separated). */
export function FiltersEditor({
  value,
  allowed,
  onChange,
}: {
  value: Record<string, string[]>;
  allowed: string[];
  onChange: (next: Record<string, string[]>) => void;
}) {
  const styles = useStyles();
  const entries = Object.entries(value);
  const setField = (old: string, next: string) => {
    const out: Record<string, string[]> = {};
    for (const [k, v] of entries) out[k === old ? next : k] = v;
    onChange(out);
  };
  return (
    <div className={styles.col}>
      {entries.map(([field, values]) => (
        <div key={field} className={styles.row}>
          <Field label="Field">
            <Dropdown
              value={FILTER_FIELD_LABELS[field] ?? field}
              selectedOptions={[field]}
              onOptionSelect={(_, d) => d.optionValue && setField(field, d.optionValue)}
            >
              {allowed
                .filter((f) => f === field || !(f in value))
                .map((f) => (
                  <Option key={f} value={f}>
                    {FILTER_FIELD_LABELS[f] ?? f}
                  </Option>
                ))}
            </Dropdown>
          </Field>
          <Field label="Values" hint="Separate several values with commas">
            <Input
              value={values.join(", ")}
              onChange={(_, d) =>
                onChange({
                  ...value,
                  [field]: d.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 50),
                })
              }
            />
          </Field>
          <Button
            appearance="subtle"
            aria-label="Remove filter"
            icon={<Delete20Regular />}
            onClick={() => onChange(Object.fromEntries(entries.filter(([k]) => k !== field)))}
          />
        </div>
      ))}
      <div>
        <Button
          icon={<Add20Regular />}
          disabled={!canAddFilter(value, allowed)}
          onClick={() => {
            const next = allowed.find((f) => !(f in value));
            if (next) onChange({ ...value, [next]: [] });
          }}
        >
          Add filter
        </Button>
      </div>
    </div>
  );
}
