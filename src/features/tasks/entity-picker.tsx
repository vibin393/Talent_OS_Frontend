"use client";

import { Combobox, Dropdown, Field, makeStyles, Option, tokens } from "@fluentui/react-components";
import { useDeferredValue, useState } from "react";
import { usePermissions } from "@/features/auth/use-permission";
import { type EntityHit, type SearchableEntity, useEntitySearch } from "./entity-search";

const useStyles = makeStyles({
  row: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", "& > :last-child": { flex: "1 1 180px" } },
  type: { minWidth: "130px", width: "130px" },
});

const TYPES: { id: SearchableEntity; label: string; permission: string }[] = [
  { id: "candidate", label: "Candidate", permission: "candidate:read" },
  { id: "demand", label: "Demand", permission: "demand:read" },
  { id: "client", label: "Client", permission: "client:read" },
];

export type EntityValue = { type: SearchableEntity; id: string; label: string } | null;

/** Type `Dropdown` + search `Combobox` to link a record (candidate, demand or client). */
export function EntityPicker({
  label,
  value,
  onChange,
  types,
  disabled,
  hint,
  noneLabel = "Not linked",
}: {
  label: string;
  value: EntityValue;
  onChange: (value: EntityValue) => void;
  types?: SearchableEntity[];
  disabled?: boolean;
  hint?: string;
  noneLabel?: string;
}) {
  const styles = useStyles();
  const permissions = usePermissions();
  const available = TYPES.filter((t) => (!types || types.includes(t.id)) && t.permission in permissions);
  const [type, setType] = useState<SearchableEntity | null>(value?.type ?? available[0]?.id ?? null);
  const [search, setSearch] = useState<string | null>(null);
  const q = useDeferredValue(search ?? "");
  const results = useEntitySearch(type, q, search !== null);
  const hits: EntityHit[] = results.data ?? [];

  return (
    <Field label={label} hint={available.length === 0 ? "You cannot browse records to link." : hint}>
      <div className={styles.row}>
        <Dropdown
          className={styles.type}
          aria-label={`${label} type`}
          value={available.find((t) => t.id === type)?.label ?? ""}
          selectedOptions={type ? [type] : []}
          disabled={disabled || available.length === 0}
          onOptionSelect={(_, d) => {
            setType(d.optionValue as SearchableEntity);
            setSearch(null);
          }}
        >
          {available.map((t) => (
            <Option key={t.id} value={t.id}>
              {t.label}
            </Option>
          ))}
        </Dropdown>
        <Combobox
          freeform
          aria-label={label}
          placeholder={type ? `Search ${type}s` : ""}
          disabled={disabled || !type}
          value={search ?? (value?.label || "")}
          selectedOptions={value ? [value.id] : []}
          onFocus={() => setSearch((s) => s ?? "")}
          onBlur={() => setSearch(null)}
          onChange={(e) => setSearch(e.target.value)}
          onOptionSelect={(_, d) => {
            setSearch(null);
            if (d.optionValue === "__none__") {
              onChange(null);
              return;
            }
            const hit = hits.find((h) => h.id === d.optionValue);
            if (hit && type) onChange({ type, id: hit.id, label: hit.label });
          }}
        >
          {value && (
            <Option value="__none__" text={noneLabel}>
              {noneLabel}
            </Option>
          )}
          {hits.map((h) => (
            <Option key={h.id} value={h.id} text={h.label}>
              {h.secondary ? `${h.label} · ${h.secondary}` : h.label}
            </Option>
          ))}
          {results.isSuccess && hits.length === 0 && (
            <Option value="" disabled text="">
              No matches
            </Option>
          )}
        </Combobox>
      </div>
    </Field>
  );
}
