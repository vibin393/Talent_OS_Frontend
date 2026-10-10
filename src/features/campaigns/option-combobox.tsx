"use client";

import { Combobox, Field, Option } from "@fluentui/react-components";
import { useState } from "react";
import type { PickerOption } from "./types";
import { optionLabel } from "./use-marketing";

/** Searchable `Combobox` over picker options. With `value` it is a single select; without, it adds and clears. */
export function OptionCombobox({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  hint,
  validationMessage,
  required,
  className,
}: {
  label: string;
  options: readonly PickerOption[];
  value?: string | null;
  onChange: (option: PickerOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  validationMessage?: string;
  required?: boolean;
  className?: string;
}) {
  const controlled = value !== undefined;
  const selected = controlled ? options.find((o) => o.id === value) : undefined;
  const [query, setQuery] = useState<string | null>(null);
  const text = query ?? (selected ? optionLabel(selected) : "");
  const q = (query ?? "").trim().toLowerCase();
  const shown = q ? options.filter((o) => optionLabel(o).toLowerCase().includes(q)) : options;
  return (
    <Field
      label={label}
      hint={hint}
      required={required}
      className={className}
      validationState={validationMessage ? "error" : "none"}
      validationMessage={validationMessage}
    >
      <Combobox
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        selectedOptions={selected ? [selected.id] : []}
        onChange={(e) => setQuery(e.target.value)}
        onOptionSelect={(_, d) => {
          const o = options.find((x) => x.id === d.optionValue) ?? null;
          setQuery(null);
          onChange(o);
        }}
        onBlur={() => setQuery(null)}
      >
        {shown.length === 0 ? (
          <Option value="" disabled text="">
            No matches
          </Option>
        ) : (
          shown.map((o) => (
            <Option key={o.id} value={o.id} text={optionLabel(o)}>
              {optionLabel(o)}
            </Option>
          ))
        )}
      </Combobox>
    </Field>
  );
}
