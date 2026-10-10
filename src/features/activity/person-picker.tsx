"use client";

import { Combobox, Field, Option } from "@fluentui/react-components";
import { useDeferredValue, useState } from "react";
import { type Person, usePeopleSearch } from "./people";

const CLEAR = "__clear__";

/**
 * People search `Combobox` over the directory available to the signed-in user (see `usePeopleSearch`).
 * `valueLabel` is shown while nothing is typed; `clearLabel` adds an entry that selects `null`.
 * When no directory is available the field is disabled and `unavailableHint` is shown.
 */
export function PersonPicker({
  label,
  value,
  valueLabel,
  onChange,
  clearLabel,
  disabled,
  className,
  hint,
  unavailableHint = "You cannot browse people in this workspace.",
  placeholder = "Search people by name",
}: {
  label: string;
  value: string | null;
  valueLabel?: string;
  onChange: (person: Person | null) => void;
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
  hint?: string;
  unavailableHint?: string;
  placeholder?: string;
}) {
  const [search, setSearch] = useState<string | null>(null);
  const deferred = useDeferredValue(search ?? "");
  const people = usePeopleSearch(deferred, !disabled && search !== null);
  const off = disabled || !people.available;

  return (
    <Field label={label} className={className} hint={!people.available ? unavailableHint : hint}>
      <Combobox
        freeform
        placeholder={placeholder}
        disabled={off}
        value={search ?? valueLabel ?? ""}
        selectedOptions={value ? [value] : []}
        onFocus={() => setSearch((s) => s ?? "")}
        onBlur={() => setSearch(null)}
        onChange={(e) => setSearch(e.target.value)}
        onOptionSelect={(_, d) => {
          if (d.optionValue === undefined || d.optionValue === "") return;
          setSearch(null);
          if (d.optionValue === CLEAR) {
            onChange(null);
            return;
          }
          const person = people.people.find((p) => p.id === d.optionValue);
          if (person) onChange(person);
        }}
      >
        {clearLabel && (
          <Option value={CLEAR} text={clearLabel}>
            {clearLabel}
          </Option>
        )}
        {people.people.map((p) => (
          <Option key={p.id} value={p.id} text={p.name}>
            {p.secondary ? `${p.name} (${p.secondary})` : p.name}
          </Option>
        ))}
        {!people.loading && search !== null && people.people.length === 0 && (
          <Option value="" disabled text="">
            No matching people
          </Option>
        )}
      </Combobox>
    </Field>
  );
}
