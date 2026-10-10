"use client";

import { Combobox, Field, Option, Tag, TagGroup } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { UserPicker, userLabel } from "@/features/admin/user-picker";
import { demandsApi } from "@/features/demands/api";
import { EMPTY_DEMAND_FILTERS } from "@/features/demands/query";
import { campusApi, campusKeys } from "./api";

/** Demand search `Combobox`: picking a Demand calls `onPick` and clears the box (used to add to a list). */
export function DemandPicker({
  label,
  onPick,
  excludeIds = [],
  disabled,
}: {
  label: string;
  onPick: (demand: { id: string; title: string; req_id?: string | null }) => void;
  excludeIds?: readonly string[];
  disabled?: boolean;
}) {
  const [search, setSearch] = useState<string | null>(null);
  const q = useDeferredValue((search ?? "").trim());
  const results = useQuery({
    queryKey: ["campus", "demand-picker", q],
    queryFn: ({ signal }) => demandsApi.list({ ...EMPTY_DEMAND_FILTERS, q }, 20, signal),
    enabled: search !== null && !disabled,
    placeholderData: (prev) => prev,
  });
  const options = (results.data?.items ?? []).filter((d) => !excludeIds.includes(d.id));
  return (
    <Field label={label}>
      <Combobox
        freeform
        placeholder="Search demands by title or ID"
        value={search ?? ""}
        disabled={disabled}
        onFocus={() => setSearch((s) => s ?? "")}
        onChange={(e) => setSearch(e.target.value)}
        onOptionSelect={(_, d) => {
          const picked = options.find((o) => o.id === d.optionValue);
          if (picked) onPick({ id: picked.id, title: picked.title, req_id: picked.req_id });
          setSearch("");
        }}
      >
        {options.length === 0 ? (
          <Option disabled value="" text="">
            {results.isFetching ? "Searching…" : "No matching demands"}
          </Option>
        ) : (
          options.map((d) => (
            <Option key={d.id} value={d.id} text={d.title}>
              {`${d.title} (${d.req_id})`}
            </Option>
          ))
        )}
      </Combobox>
    </Field>
  );
}

/** Active institution `Combobox` (type to filter). */
export function InstitutionPicker({
  label,
  value,
  onChange,
  excludeIds = [],
  disabled,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null, name: string | null) => void;
  excludeIds?: readonly string[];
  disabled?: boolean;
}) {
  const [search, setSearch] = useState<string | null>(null);
  const q = useDeferredValue((search ?? "").trim());
  const f = { q: q || undefined, status: "active" as const };
  const results = useQuery({
    queryKey: campusKeys.institutions(f),
    queryFn: ({ signal }) => campusApi.institutions(f, signal),
    enabled: !disabled,
    placeholderData: (prev) => prev,
  });
  const options = (results.data ?? []).filter((i) => !excludeIds.includes(i.id));
  const selected = results.data?.find((i) => i.id === value);
  return (
    <Field label={label}>
      <Combobox
        freeform
        placeholder="Search institutions"
        value={search ?? selected?.name ?? ""}
        selectedOptions={value ? [value] : []}
        disabled={disabled}
        onChange={(e) => setSearch(e.target.value)}
        onOptionSelect={(_, d) => {
          const picked = options.find((o) => o.id === d.optionValue);
          onChange(picked?.id ?? null, picked?.name ?? null);
          setSearch(null);
        }}
      >
        {options.length === 0 ? (
          <Option disabled value="" text="">
            {results.isFetching ? "Searching…" : "No matching institutions"}
          </Option>
        ) : (
          options.map((i) => (
            <Option key={i.id} value={i.id} text={i.name}>
              {i.city ? `${i.name} · ${i.city}` : i.name}
            </Option>
          ))
        )}
      </Combobox>
    </Field>
  );
}

export type PersonRef = { id: string; label: string };

/** Several internal Users (interviewers): a people search plus dismissible tags. Needs `user:read`. */
export function PeoplePicker({
  label,
  value,
  onChange,
  max = 10,
  disabled,
}: {
  label: string;
  value: PersonRef[];
  onChange: (people: PersonRef[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <UserPicker
        label={label}
        value={null}
        disabled={disabled || value.length >= max}
        excludeIds={value.map((p) => p.id)}
        onChange={(id, user) => id && user && onChange([...value, { id, label: userLabel(user) }])}
      />
      {value.length > 0 && (
        <TagGroup
          aria-label={label}
          onDismiss={(_, d) => onChange(value.filter((p) => p.id !== d.value))}
        >
          {value.map((p) => (
            <Tag key={p.id} value={p.id} dismissible={!disabled} dismissIcon={{ "aria-label": `Remove ${p.label}` }} size="small">
              {p.label}
            </Tag>
          ))}
        </TagGroup>
      )}
    </div>
  );
}
