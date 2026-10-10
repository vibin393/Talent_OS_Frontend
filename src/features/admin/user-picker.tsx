"use client";

import { Combobox, Field, Option } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import type { AdminUserOut } from "@/lib/api/types";
import { adminApi, adminKeys } from "./api";
import { EMPTY_USER_FILTERS } from "./query";

const CLEAR = "__clear__";

export function userLabel(u: Pick<AdminUserOut, "name" | "email">): string {
  return u.name || u.email;
}

/**
 * People search `Combobox` over `GET /admin/users?q=` (needs `user:read`; callers gate it).
 * `valueLabel` is shown while nothing is typed; `clearLabel` adds an entry that selects `null`.
 */
export function UserPicker({
  label,
  value,
  valueLabel,
  onChange,
  placeholder = "Search people by name or email",
  clearLabel,
  disabled,
  className,
  excludeIds,
  activeOnly = true,
}: {
  label: string;
  value: string | null;
  valueLabel?: string;
  onChange: (id: string | null, user: AdminUserOut | null) => void;
  placeholder?: string;
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
  excludeIds?: readonly string[];
  activeOnly?: boolean;
}) {
  const [search, setSearch] = useState<string | null>(null);
  const deferred = useDeferredValue((search ?? "").trim());
  const users = useQuery({
    queryKey: [...adminKeys.userSearch(deferred), activeOnly],
    queryFn: ({ signal }) =>
      adminApi.listUsers(
        { ...EMPTY_USER_FILTERS, q: deferred, status: activeOnly ? "active" : "all" },
        1,
        20,
        signal,
      ),
    enabled: !disabled && search !== null,
    placeholderData: (prev) => prev,
  });
  const options = (users.data?.items ?? []).filter((u) => !excludeIds?.includes(u.id));

  return (
    <Field label={label} className={className}>
      <Combobox
        freeform
        placeholder={placeholder}
        disabled={disabled}
        value={search ?? valueLabel ?? ""}
        selectedOptions={value ? [value] : []}
        onFocus={() => setSearch((s) => s ?? "")}
        onBlur={() => setSearch(null)}
        onChange={(e) => setSearch(e.target.value)}
        onOptionSelect={(_, d) => {
          if (d.optionValue === undefined) return;
          setSearch(null);
          if (d.optionValue === CLEAR) {
            onChange(null, null);
            return;
          }
          const user = options.find((u) => u.id === d.optionValue) ?? null;
          if (user) onChange(user.id, user);
        }}
      >
        {clearLabel && (
          <Option value={CLEAR} text={clearLabel}>
            {clearLabel}
          </Option>
        )}
        {options.map((u) => (
          <Option key={u.id} value={u.id} text={userLabel(u)}>
            {u.name ? `${u.name} (${u.email})` : u.email}
          </Option>
        ))}
        {users.isSuccess && options.length === 0 && (
          <Option value="" disabled text="">
            No matching people
          </Option>
        )}
      </Combobox>
    </Field>
  );
}
