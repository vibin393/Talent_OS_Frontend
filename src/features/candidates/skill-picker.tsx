"use client";

import { Badge, Combobox, Field, Option } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import type { SkillOut } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";

/**
 * Skill typeahead over `GET /skills?q=` (global + tenant, pending included). Picking an option returns the
 * catalog skill; the "Add …" option returns `null` + the typed text (resolved or created as pending by
 * the API).
 */
export function SkillPicker({
  label = "Add skill",
  onPick,
  excludeKeys = [],
  disabled,
  className,
  allowNew = true,
}: {
  label?: string;
  /** Offer "Add …" for text that is not in the catalog. */
  allowNew?: boolean;
  onPick: (skill: SkillOut | null, text: string) => void;
  excludeKeys?: readonly string[];
  disabled?: boolean;
  className?: string;
}) {
  const [text, setText] = useState("");
  const deferred = useDeferredValue(text.trim());
  const skills = useQuery({
    queryKey: candidateKeys.skills(deferred),
    queryFn: ({ signal }) => candidatesApi.searchSkills(deferred, signal),
    enabled: !disabled && deferred.length > 0,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
  const options = deferred ? (skills.data?.items ?? []).filter((s) => !excludeKeys.includes(`${s.kind}:${s.id}`)) : [];
  const exact = options.some((s) => s.name.toLowerCase() === deferred.toLowerCase());

  return (
    <Field label={label} className={className} hint={allowNew ? "Pick from the catalog, or choose Add to use a new skill." : undefined}>
      <Combobox
        freeform
        disabled={disabled}
        placeholder="e.g. React, Azure Data Factory"
        value={text}
        selectedOptions={[]}
        onChange={(e) => setText(e.target.value)}
        onOptionSelect={(_, d) => {
          if (!d.optionValue) return;
          if (d.optionValue.startsWith("new:")) {
            onPick(null, d.optionValue.slice(4));
          } else {
            const skill = options.find((s) => `${s.kind}:${s.id}` === d.optionValue);
            if (skill) onPick(skill, skill.name);
          }
          setText("");
        }}
      >
        {allowNew && deferred && !exact && (
          <Option value={`new:${deferred}`} text={deferred}>
            {`Add "${deferred}"`}
          </Option>
        )}
        {options.map((s) => (
          <Option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`} text={s.name}>
            {s.name}
            {s.category ? ` · ${s.category}` : ""}
            {s.status === "pending" && (
              <Badge size="small" appearance="tint" color="warning" style={{ marginLeft: 6 }}>
                pending
              </Badge>
            )}
          </Option>
        ))}
      </Combobox>
    </Field>
  );
}
