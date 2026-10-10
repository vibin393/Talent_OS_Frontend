"use client";

import { Combobox, Field, Option } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { clientsApi } from "@/features/clients/api";
import { EMPTY_CLIENT_FILTERS } from "@/features/clients/query";
import { usePermission } from "@/features/auth/use-permission";

const CLEAR = "__clear__";

/** Client search `Combobox` over `GET /clients?q=` (active clients only). */
export function ClientPicker({
  label = "Client",
  value,
  valueLabel,
  onChange,
  clearLabel,
  required,
  disabled,
  className,
  validationMessage,
  hint,
}: {
  label?: string;
  value: string | null;
  valueLabel?: string;
  onChange: (client: { id: string; name: string } | null) => void;
  clearLabel?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  validationMessage?: string;
  hint?: string;
}) {
  const canRead = usePermission("client:read");
  const [search, setSearch] = useState<string | null>(null);
  const deferred = useDeferredValue((search ?? "").trim());
  const clients = useQuery({
    queryKey: ["clients", "picker", deferred],
    queryFn: ({ signal }) =>
      clientsApi.list({ ...EMPTY_CLIENT_FILTERS, q: deferred }, { field: "name", direction: "ascending" }, 1, 20, signal),
    enabled: canRead && !disabled && search !== null,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
  const options = clients.data?.items ?? [];

  return (
    <Field
      label={label}
      required={required}
      className={className}
      hint={!canRead ? "You cannot browse clients." : hint}
      validationState={validationMessage ? "error" : "none"}
      validationMessage={validationMessage}
    >
      <Combobox
        freeform
        placeholder="Search clients"
        disabled={disabled || !canRead}
        value={search ?? valueLabel ?? ""}
        selectedOptions={value ? [value] : []}
        onFocus={() => setSearch((s) => s ?? "")}
        onBlur={() => setSearch(null)}
        onChange={(e) => setSearch(e.target.value)}
        onOptionSelect={(_, d) => {
          if (!d.optionValue) return;
          setSearch(null);
          if (d.optionValue === CLEAR) return onChange(null);
          const c = options.find((o) => o.id === d.optionValue);
          if (c) onChange({ id: c.id, name: c.name });
        }}
      >
        {clearLabel && (
          <Option value={CLEAR} text={clearLabel}>
            {clearLabel}
          </Option>
        )}
        {options.map((c) => (
          <Option key={c.id} value={c.id} text={c.name}>
            {c.name}
          </Option>
        ))}
        {clients.isSuccess && options.length === 0 && (
          <Option value="" disabled text="">
            No matching clients
          </Option>
        )}
      </Combobox>
    </Field>
  );
}
