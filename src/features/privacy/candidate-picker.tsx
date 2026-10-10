"use client";

import { Combobox, Field, Option } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { candidateKeys, candidatesApi } from "@/features/candidates/api";
import { EMPTY_CANDIDATE_FILTERS } from "@/features/candidates/query";
import type { CandidateOut } from "@/lib/api/types";

export function candidateLabel(c: Pick<CandidateOut, "full_name" | "human_id">): string {
  return `${c.full_name} (${c.human_id})`;
}

/** Candidate search `Combobox` (name, email or ID) used by DSRs and legal holds. */
export function CandidatePicker({
  label,
  value,
  valueLabel,
  onChange,
  required,
  validationMessage,
  hint,
}: {
  label: string;
  value: string | null;
  valueLabel?: string;
  onChange: (id: string | null, candidate: CandidateOut | null) => void;
  required?: boolean;
  validationMessage?: string;
  hint?: string;
}) {
  const [search, setSearch] = useState<string | null>(null);
  const q = useDeferredValue((search ?? "").trim());
  const filters = { ...EMPTY_CANDIDATE_FILTERS, q, includeArchived: true };
  const results = useQuery({
    queryKey: [...candidateKeys.all, "picker", q],
    queryFn: ({ signal }) => candidatesApi.list(filters, 1, 20, signal),
    enabled: search !== null,
    placeholderData: (prev) => prev,
  });
  const options = results.data?.items ?? [];
  return (
    <Field
      label={label}
      required={required}
      hint={hint}
      validationState={validationMessage ? "error" : "none"}
      validationMessage={validationMessage}
    >
      <Combobox
        freeform
        placeholder="Search candidates by name, email or ID"
        value={search ?? valueLabel ?? ""}
        selectedOptions={value ? [value] : []}
        onFocus={() => setSearch((s) => s ?? "")}
        onBlur={() => setSearch(null)}
        onChange={(e) => setSearch(e.target.value)}
        onOptionSelect={(_, d) => {
          if (!d.optionValue) return;
          setSearch(null);
          const c = options.find((o) => o.id === d.optionValue) ?? null;
          onChange(c?.id ?? null, c);
        }}
      >
        {options.map((c) => (
          <Option key={c.id} value={c.id} text={candidateLabel(c)}>
            {candidateLabel(c)}
          </Option>
        ))}
        {results.isSuccess && options.length === 0 && (
          <Option value="" disabled text="">
            No matching candidates
          </Option>
        )}
      </Combobox>
    </Field>
  );
}
