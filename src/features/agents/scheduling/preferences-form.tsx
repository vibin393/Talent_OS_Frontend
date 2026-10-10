"use client";

import {
  Body1,
  Button,
  Caption1,
  Checkbox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  SpinButton,
  Spinner,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { listTimeZones } from "@/lib/time/zones";
import { schedulingApi, schedulingKeys } from "./api";
import { WEEKDAYS, workingHoursErrors } from "./logic";
import type { SchedulingPrefsOut, Weekday, WorkingHours } from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "640px" },
  day: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: tokens.spacingHorizontalS },
  dayName: { minWidth: "110px", paddingBottom: tokens.spacingVerticalXS },
  time: { width: "120px" },
  actions: { display: "flex", gap: tokens.spacingHorizontalS },
  muted: { color: tokens.colorNeutralForeground3 },
});

const COUNTRIES: { code: string; label: string }[] = [
  { code: "IN", label: "India" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "SG", label: "Singapore" },
  { code: "AE", label: "United Arab Emirates" },
];
const NONE = "__none__";

/** `/me/scheduling` "My scheduling preferences" (the signed-in user's own row). */
export function PreferencesForm() {
  const query = useQuery({ queryKey: schedulingKeys.myPrefs, queryFn: ({ signal }) => schedulingApi.myPrefs(signal) });
  return (
    <>
      <PageHeader title="My scheduling preferences" subtitle="When the Scheduling Agent may offer interview times for you." />
      {query.isPending ? (
        <GridSkeleton rows={8} />
      ) : query.isError ? (
        <ErrorBar title="Could not load your preferences." message={errorMessage(query.error)} />
      ) : (
        <Form key={query.dataUpdatedAt} data={query.data} />
      )}
    </>
  );
}

function Form({ data }: { data: SchedulingPrefsOut }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [tz, setTz] = useState(data.timezone);
  const [hours, setHours] = useState<WorkingHours>(data.working_hours ?? {});
  const [country, setCountry] = useState<string | null>(data.holiday_country);
  const [maxPerDay, setMaxPerDay] = useState<number | null>(data.max_interviews_per_day);
  const [buffer, setBuffer] = useState<number | null>(data.buffer_minutes);
  const zones = useMemo(() => listTimeZones(data.timezone), [data.timezone]);
  const errors = workingHoursErrors(hours);
  const save = useMutation({
    mutationFn: () =>
      schedulingApi.saveMyPrefs({ timezone: tz, working_hours: hours, holiday_country: country, max_interviews_per_day: maxPerDay, buffer_minutes: buffer }),
    onSuccess: (out) => {
      queryClient.setQueryData(schedulingKeys.myPrefs, out);
      toast.success("Preferences saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const setDay = (day: Weekday, range: [string, string] | null) =>
    setHours((h) => {
      const next = { ...h };
      if (range) next[day] = [range];
      else delete next[day];
      return next;
    });

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (errors.length === 0) save.mutate();
      }}
    >
      {!data.calendar_connected && (
        <MessageBar intent="info" layout="multiline">
          <MessageBarBody>
            Your calendar is not connected, so the agent cannot see when you are busy. <AppLink href="/settings/connections">Connect your calendar</AppLink>
          </MessageBarBody>
        </MessageBar>
      )}
      <Field label="Time zone">
        <Dropdown value={tz} selectedOptions={[tz]} onOptionSelect={(_, d) => d.optionValue && setTz(d.optionValue)}>
          {zones.map((z) => (
            <Option key={z} value={z}>
              {z}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
        <legend>
          <Body1>Working hours</Body1>
        </legend>
        {WEEKDAYS.map(({ key, label }) => {
          const range = hours[key]?.[0] ?? null;
          return (
            <div key={key} className={styles.day}>
              <Checkbox className={styles.dayName} label={label} checked={!!range} onChange={(_, d) => setDay(key, d.checked ? ["09:00", "18:00"] : null)} />
              <Field label="From" size="small">
                <Input className={styles.time} type="time" disabled={!range} value={range?.[0] ?? ""} onChange={(_, d) => range && setDay(key, [d.value, range[1]])} />
              </Field>
              <Field label="To" size="small">
                <Input className={styles.time} type="time" disabled={!range} value={range?.[1] ?? ""} onChange={(_, d) => range && setDay(key, [range[0], d.value])} />
              </Field>
            </div>
          );
        })}
        {errors.length > 0 && (
          <Caption1 role="alert" style={{ color: tokens.colorPaletteRedForeground1 }}>
            {errors.join(" ")}
          </Caption1>
        )}
      </fieldset>
      <Field label="Holiday calendar" hint="National holidays of this country are never offered.">
        <Dropdown
          value={COUNTRIES.find((c) => c.code === country)?.label ?? (country ?? "None")}
          selectedOptions={[country ?? NONE]}
          onOptionSelect={(_, d) => setCountry(d.optionValue === NONE || !d.optionValue ? null : d.optionValue)}
        >
          <Option value={NONE}>None</Option>
          {COUNTRIES.map((c) => (
            <Option key={c.code} value={c.code}>
              {c.label}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Field label="Max interviews per day" hint="Leave empty for no limit">
        <SpinButton
          value={maxPerDay}
          min={1}
          max={20}
          onChange={(_, d) => {
            const n = d.value ?? (d.displayValue ? Number(d.displayValue) : null);
            setMaxPerDay(n === null || Number.isNaN(n) ? null : n);
          }}
        />
      </Field>
      <Field label="Buffer between interviews" hint="Minutes kept free before and after your other meetings">
        <SpinButton
          value={buffer}
          min={0}
          max={120}
          step={5}
          onChange={(_, d) => {
            const n = d.value ?? (d.displayValue ? Number(d.displayValue) : null);
            setBuffer(n === null || Number.isNaN(n) ? null : n);
          }}
        />
      </Field>
      {data.is_default && <Caption1 className={styles.muted}>You are using the workspace defaults until you save.</Caption1>}
      <div className={styles.actions}>
        <Button type="submit" appearance="primary" disabled={save.isPending || errors.length > 0} icon={save.isPending ? <Spinner size="tiny" /> : undefined}>
          Save
        </Button>
      </div>
    </form>
  );
}
