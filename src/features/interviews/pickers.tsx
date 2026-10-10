"use client";

import {
  Combobox,
  Field,
  Option,
  Tag,
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
} from "@fluentui/react-components";
import { DatePicker } from "@fluentui/react-datepicker-compat";
import { useDeferredValue, useMemo, useState } from "react";
import { usePeopleSearch } from "@/features/activity/people";
import { useNowMs } from "@/lib/time/use-now";
import { listTimeZones, zoneLabel } from "@/lib/time/zones";
import { isEmail, type Person } from "./schedule-form";

const MAX_ZONE_OPTIONS = 60;

/** Searchable IANA time-zone `Combobox` showing the UTC offset; `preferred` zones are listed first. */
export function TimeZoneField({
  label = "Time zone",
  value,
  onChange,
  preferred = [],
  validationMessage,
  at,
}: {
  label?: string;
  value: string;
  onChange: (tz: string) => void;
  preferred?: readonly (string | null | undefined)[];
  validationMessage?: string;
  /** Instant used for the offsets shown (DST); defaults to now. */
  at?: string | number;
}) {
  const [query, setQuery] = useState<string | null>(null);
  const deferred = useDeferredValue((query ?? "").trim().toLowerCase().replace(/\s+/g, "_"));
  const zones = useMemo(() => listTimeZones(value, ...preferred), [value, preferred]);
  const options = useMemo(() => {
    const filtered = deferred ? zones.filter((z) => z.toLowerCase().includes(deferred)) : zones;
    return filtered.slice(0, MAX_ZONE_OPTIONS);
  }, [zones, deferred]);
  const now = useNowMs(10 * 60_000);
  const when = at ?? now;
  return (
    <Field label={label} required validationState={validationMessage ? "error" : "none"} validationMessage={validationMessage}>
      <Combobox
        freeform
        aria-label={label}
        value={query ?? zoneLabel(value, when)}
        selectedOptions={[value]}
        onFocus={() => setQuery((q) => q ?? "")}
        onBlur={() => setQuery(null)}
        onChange={(e) => setQuery(e.target.value)}
        onOptionSelect={(_, d) => {
          if (d.optionValue) onChange(d.optionValue);
          setQuery(null);
        }}
        placeholder="Search time zones"
      >
        {options.map((z) => (
          <Option key={z} value={z} text={zoneLabel(z, when)}>
            {zoneLabel(z, when)}
          </Option>
        ))}
        {options.length === 0 && (
          <Option value="" disabled text="">
            No matching time zone
          </Option>
        )}
      </Combobox>
    </Field>
  );
}

function parseDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `DatePicker` over a `YYYY-MM-DD` string (a calendar date, no time zone). */
export function DateField({
  label,
  value,
  onChange,
  required,
  validationMessage,
  minDate,
  hint,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  validationMessage?: string;
  minDate?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label} required={required} hint={hint} validationState={validationMessage ? "error" : "none"} validationMessage={validationMessage}>
      <DatePicker
        value={parseDate(value)}
        disabled={disabled}
        minDate={minDate ? (parseDate(minDate) ?? undefined) : undefined}
        onSelectDate={(d) => onChange(d ? toIsoDate(d) : "")}
        formatDate={(d) => (d ? d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "")}
        placeholder="Select a date"
        allowTextInput={false}
      />
    </Field>
  );
}

/** Internal people `TagPicker` (interviewers) over the tenant directory the viewer can read. */
export function PeoplePicker({
  label,
  value,
  onChange,
  validationMessage,
  excludeIds = [],
}: {
  label: string;
  value: readonly Person[];
  onChange: (people: Person[]) => void;
  validationMessage?: string;
  excludeIds?: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const search = usePeopleSearch(query, true);
  const chosen = new Set(value.map((p) => p.id));
  const options = search.people.filter((p) => !chosen.has(p.id) && !excludeIds.includes(p.id));
  return (
    <Field
      label={label}
      validationState={validationMessage ? "error" : "none"}
      validationMessage={validationMessage}
      hint={search.available ? undefined : "You cannot browse people in this workspace. Ask an admin for user or team read access."}
    >
      <TagPicker
        selectedOptions={value.map((p) => p.id)}
        onOptionSelect={(_, d) => {
          if (!d.value) return;
          if (chosen.has(d.value)) {
            onChange(value.filter((p) => p.id !== d.value));
            return;
          }
          const person = options.find((p) => p.id === d.value);
          if (person) onChange([...value, { id: person.id, name: person.name }]);
          setQuery("");
        }}
      >
        <TagPickerControl>
          <TagPickerGroup aria-label={`Selected ${label.toLowerCase()}`}>
            {value.map((p) => (
              <Tag key={p.id} value={p.id} shape="circular">
                {p.name}
              </Tag>
            ))}
          </TagPickerGroup>
          <TagPickerInput aria-label={label} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={value.length ? "" : "Search people"} />
        </TagPickerControl>
        <TagPickerList>
          {options.map((p) => (
            <TagPickerOption key={p.id} value={p.id} text={p.name} secondaryContent={p.secondary ?? undefined}>
              {p.name}
            </TagPickerOption>
          ))}
        </TagPickerList>
      </TagPicker>
    </Field>
  );
}

/** Free-text email `TagPicker` (external interviewers): type an address and press Enter or comma. */
export function EmailTagsField({
  label,
  value,
  onChange,
  validationMessage,
  hint,
}: {
  label: string;
  value: readonly string[];
  onChange: (emails: string[]) => void;
  validationMessage?: string;
  hint?: string;
}) {
  const [query, setQuery] = useState("");
  const typed = query.trim().replace(/,$/, "");
  const add = () => {
    const e = typed.toLowerCase();
    if (e && !value.includes(e)) onChange([...value, e]);
    setQuery("");
  };
  return (
    <Field label={label} hint={hint} validationState={validationMessage ? "error" : "none"} validationMessage={validationMessage}>
      <TagPicker
        noPopover
        selectedOptions={[...value]}
        onOptionSelect={(_, d) => {
          if (d.value && value.includes(d.value)) onChange(value.filter((v) => v !== d.value));
        }}
      >
        <TagPickerControl>
          <TagPickerGroup aria-label={`Selected ${label.toLowerCase()}`}>
            {value.map((email) => (
              <Tag key={email} value={email} shape="circular" appearance={isEmail(email) ? "filled" : "outline"}>
                {email}
              </Tag>
            ))}
          </TagPickerGroup>
          <TagPickerInput
            aria-label={label}
            value={query}
            placeholder={value.length ? "" : "name@company.com"}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === "," || e.key === "Tab") && typed) {
                if (e.key !== "Tab") e.preventDefault();
                add();
              }
            }}
            onBlur={() => typed && add()}
          />
        </TagPickerControl>
        <TagPickerList />
      </TagPicker>
    </Field>
  );
}
