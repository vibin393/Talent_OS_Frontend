"use client";

import {
  Tag,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
} from "@fluentui/react-components";
import { useState } from "react";

/** Free-text tags (`TagPicker` without a list): Enter or comma adds, the chip's dismiss removes. */
export function TagsInput({
  value,
  onChange,
  ariaLabel,
  placeholder,
  max,
  disabled,
  invalid,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  ariaLabel: string;
  placeholder?: string;
  max?: number;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim().replace(/,$/, "").trim();
    if (!t || value.includes(t) || (max !== undefined && value.length >= max)) return;
    onChange([...value, t]);
    setText("");
  };
  return (
    <TagPicker
      noPopover
      selectedOptions={value}
      disabled={disabled}
      onOptionSelect={(_, d) => onChange(value.filter((v) => v !== d.value))}
    >
      <TagPickerControl aria-invalid={invalid || undefined}>
        <TagPickerGroup aria-label={`${ariaLabel} values`}>
          {value.map((v) => (
            <Tag key={v} value={v} shape="rounded">
              {v}
            </Tag>
          ))}
        </TagPickerGroup>
        <TagPickerInput
          aria-label={ariaLabel}
          value={text}
          placeholder={value.length === 0 ? placeholder : undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
        />
      </TagPickerControl>
    </TagPicker>
  );
}
