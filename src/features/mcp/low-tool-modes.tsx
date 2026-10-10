"use client";

import { Caption1, Dropdown, Field, makeStyles, Option, tokens } from "@fluentui/react-components";
import type { LowToolMode } from "./api";
import { LOW_MODE_LABELS, LOW_TOOLS } from "./logic";

const useStyles = makeStyles({ root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS, maxWidth: "480px" } });

/** "Creating items" (spec B2): the four creating tools, "Ask for approval" (default) or "Run without approval". */
export function LowToolModes({ value, disabled, onChange }: { value: Record<string, LowToolMode>; disabled: boolean; onChange: (v: Record<string, LowToolMode>) => void }) {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      {LOW_TOOLS.map((t) => {
        const mode = value[t.key] ?? "suggest";
        return (
          <Field key={t.key} label={t.label} orientation="horizontal">
            <Dropdown
              value={LOW_MODE_LABELS[mode]}
              selectedOptions={[mode]}
              disabled={disabled}
              onOptionSelect={(_, d) => onChange({ ...value, [t.key]: (d.optionValue as LowToolMode) ?? "suggest" })}
            >
              <Option value="suggest">{LOW_MODE_LABELS.suggest}</Option>
              <Option value="auto">{LOW_MODE_LABELS.auto}</Option>
            </Dropdown>
          </Field>
        );
      })}
      <Caption1>Anything that sends messages or changes candidates always needs approval.</Caption1>
    </div>
  );
}
