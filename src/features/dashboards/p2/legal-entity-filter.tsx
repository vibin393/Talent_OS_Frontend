"use client";

import { Combobox, Field, Input, makeStyles, Option, tokens } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { LegalEntityOption } from "./types";

const useStyles = makeStyles({
  root: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "end" },
  combo: { minWidth: "220px", maxWidth: "100%" },
  date: { minWidth: "160px" },
});

export function useLegalEntityOptions(enabled = true) {
  return useQuery({
    queryKey: ["reporting", "legal-entities"],
    queryFn: ({ signal }) => api.get<LegalEntityOption[]>("/api/v1/legal-entities", { signal }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Legal Entity multi-select (hidden when the tenant has a single LE) and an optional "As of" date. */
export function LegalEntityFilter({
  entities,
  selected,
  onChange,
  asOf,
  onAsOfChange,
}: {
  entities: readonly LegalEntityOption[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  asOf?: string | null;
  onAsOfChange?: (value: string | null) => void;
}) {
  const styles = useStyles();
  const names = new Map(entities.map((e) => [e.id, e.name]));
  const showLe = entities.length > 1;
  if (!showLe && !onAsOfChange) return null;
  return (
    <div className={styles.root}>
      {showLe && (
        <Field label="Legal entity">
          <Combobox
            className={styles.combo}
            multiselect
            placeholder="All legal entities"
            selectedOptions={[...selected]}
            value={selected.map((id) => names.get(id) ?? id).join(", ")}
            onOptionSelect={(_, d) => onChange(d.selectedOptions)}
            aria-label="Filter by legal entity"
          >
            {entities.map((e) => (
              <Option key={e.id} value={e.id}>
                {e.name}
              </Option>
            ))}
          </Combobox>
        </Field>
      )}
      {onAsOfChange && (
        <Field label="As of">
          <Input
            className={styles.date}
            type="date"
            value={asOf ?? ""}
            onChange={(_, d) => onAsOfChange(d.value || null)}
            aria-label="As of date"
          />
        </Field>
      )}
    </div>
  );
}
