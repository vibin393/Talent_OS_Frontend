"use client";

import { Button, Caption1, Field, Input, makeStyles, tokens } from "@fluentui/react-components";
import { Dismiss16Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { originError } from "./logic";

const useStyles = makeStyles({
  row: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-end", flexWrap: "wrap" },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  item: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS },
});

/** "Browser-based assistants" (spec B2): the allowed origins (https only, max 10). */
export function OriginsEditor({ value, disabled, onChange }: { value: string[]; disabled: boolean; onChange: (v: string[]) => void }) {
  const styles = useStyles();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    const e = originError(draft, value);
    setError(e);
    if (!e) {
      onChange([...value, draft.trim().replace(/\/$/, "").toLowerCase()]);
      setDraft("");
    }
  };
  return (
    <div>
      <ul className={styles.list} aria-label="Allowed origins">
        {value.map((o) => (
          <li key={o} className={styles.item}>
            {o}
            <Button
              size="small"
              appearance="subtle"
              icon={<Dismiss16Regular />}
              aria-label={`Remove ${o}`}
              disabled={disabled}
              onClick={() => onChange(value.filter((x) => x !== o))}
            />
          </li>
        ))}
      </ul>
      <div className={styles.row}>
        <Field label="Allowed origins" validationMessage={error ?? undefined} validationState={error ? "error" : "none"}>
          <Input value={draft} placeholder="https://assistant.example.com" disabled={disabled} onChange={(_, d) => setDraft(d.value)} />
        </Field>
        <Button disabled={disabled || !draft.trim()} onClick={add}>
          Add
        </Button>
      </div>
      <Caption1>Desktop assistants don&apos;t need this.</Caption1>
    </div>
  );
}
