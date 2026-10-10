"use client";

import {
  Field,
  Tag,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import type { TagOut } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";

const CREATE_PREFIX = "__create__:";

function useTagSearch(q: string, enabled: boolean) {
  const deferred = useDeferredValue(q.trim());
  return useQuery({
    queryKey: candidateKeys.tags(deferred),
    queryFn: ({ signal }) => candidatesApi.searchTags(deferred, signal),
    enabled,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}

/**
 * Multi-select of tag *names* (`TagPicker`): pick existing tags or type a new name and press Enter.
 * Used for "Add tags" (tags are created as needed by the API).
 */
export function TagNamesPicker({
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: readonly string[];
  onChange: (names: string[]) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [query, setQuery] = useState("");
  const search = useTagSearch(query, !disabled);
  const lower = new Set(value.map((v) => v.toLowerCase()));
  const options = (search.data?.items ?? []).filter((t) => !lower.has(t.name.toLowerCase()));
  const typed = query.trim().slice(0, 50);
  const canCreate = typed !== "" && !lower.has(typed.toLowerCase()) && !options.some((t) => t.name.toLowerCase() === typed.toLowerCase());

  const add = (name: string) => {
    const n = name.trim().slice(0, 50);
    if (n && !lower.has(n.toLowerCase())) onChange([...value, n]);
    setQuery("");
  };

  return (
    <Field label={label} hint={hint}>
      <TagPicker
        disabled={disabled}
        selectedOptions={[...value]}
        onOptionSelect={(_, data) => {
          if (!data.value) return;
          if (data.value.startsWith(CREATE_PREFIX)) {
            add(data.value.slice(CREATE_PREFIX.length));
            return;
          }
          // Removing a tag (dismiss) or picking an option.
          if (value.includes(data.value)) onChange(value.filter((v) => v !== data.value));
          else add(data.value);
        }}
      >
        <TagPickerControl>
          <TagPickerGroup aria-label={`Selected ${label.toLowerCase()}`}>
            {value.map((name) => (
              <Tag key={name} value={name} shape="rounded">
                {name}
              </Tag>
            ))}
          </TagPickerGroup>
          <TagPickerInput
            aria-label={label}
            value={query}
            placeholder={value.length ? "" : "Type to search or add"}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && typed && canCreate) {
                e.preventDefault();
                add(typed);
              }
            }}
          />
        </TagPickerControl>
        <TagPickerList>
          {canCreate && (
            <TagPickerOption value={`${CREATE_PREFIX}${typed}`} text={typed}>
              {`Add "${typed}"`}
            </TagPickerOption>
          )}
          {options.map((t) => (
            <TagPickerOption key={t.id} value={t.name} text={t.name}>
              {t.name}
            </TagPickerOption>
          ))}
        </TagPickerList>
      </TagPicker>
    </Field>
  );
}

/** Single tag filter (`TagPicker` restricted to one existing tag). */
export function TagFilter({
  value,
  onChange,
  className,
}: {
  value: TagOut | null;
  onChange: (tag: TagOut | null) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const search = useTagSearch(query, true);
  const options = (search.data?.items ?? []).filter((t) => t.id !== value?.id);
  return (
    <Field label="Tag" className={className}>
      <TagPicker
        selectedOptions={value ? [value.id] : []}
        onOptionSelect={(_, data) => {
          if (value && data.value === value.id) {
            onChange(null);
            return;
          }
          const tag = options.find((t) => t.id === data.value);
          if (tag) onChange(tag);
          setQuery("");
        }}
      >
        <TagPickerControl>
          <TagPickerGroup aria-label="Selected tag">
            {value && (
              <Tag value={value.id} shape="rounded">
                {value.name}
              </Tag>
            )}
          </TagPickerGroup>
          {!value && (
            <TagPickerInput
              aria-label="Filter by tag"
              placeholder="Any tag"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
        </TagPickerControl>
        <TagPickerList>
          {options.map((t) => (
            <TagPickerOption key={t.id} value={t.id} text={t.name}>
              {t.name}
            </TagPickerOption>
          ))}
        </TagPickerList>
      </TagPicker>
    </Field>
  );
}
