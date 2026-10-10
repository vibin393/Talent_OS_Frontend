"use client";

import {
  Button,
  Caption1,
  Checkbox,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Spinner,
  Subtitle2,
  Switch,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowDown20Regular, ArrowUp20Regular, Delete20Regular, Save20Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { ErrorBar } from "@/features/admin/ui";
import { errorMessage, fieldErrors } from "@/lib/api/errors";
import { configErrors } from "./config-validation";
import { categoryLabel, ROUTE_KIND_LABELS, WEEKDAY_LABELS } from "./format";
import {
  ENTRY_MODES,
  PERIOD_KINDS,
  ROUTE_STEP_KINDS,
  TIME_CATEGORIES,
  type RouteStepKind,
  type TimeCategory,
  type TimeConfigIn,
  type TimeConfigValues,
} from "./types";

const useStyles = makeStyles({
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "960px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: tokens.spacingHorizontalM },
  checks: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
  multTable: {
    borderCollapse: "collapse",
    "& th, & td": { padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`, textAlign: "start" },
  },
  multInput: { width: "110px" },
  step: {
    display: "grid",
    gridTemplateColumns: "28px minmax(200px, 1fr) minmax(160px, 1fr) minmax(140px, 1fr) auto",
    gap: tokens.spacingHorizontalS,
    alignItems: "end",
    "@media (max-width: 720px)": { gridTemplateColumns: "1fr" },
  },
  footer: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center" },
});

const PERIOD_LABELS: Record<string, string> = { weekly: "Weekly", biweekly: "Bi-weekly", semimonthly: "Semi-monthly", monthly: "Monthly" };
const MODE_LABELS: Record<string, string> = { hours: "Hours per day", start_end: "Start / end times", days: "Days" };
const REF_KINDS: RouteStepKind[] = ["user", "client_user", "finance_role"];
const REF_LABEL: Partial<Record<RouteStepKind, string>> = { user: "User id", client_user: "Client user id", finance_role: "Role key" };

/** Pick only `TimeConfigValues` fields (drops ids / version metadata of the Out schemas). */
export function toConfigIn(v: TimeConfigValues): TimeConfigIn {
  return {
    period_kind: v.period_kind,
    week_start: v.week_start,
    entry_mode: v.entry_mode,
    hours_per_day: v.hours_per_day,
    work_days: v.work_days,
    enabled_categories: v.enabled_categories,
    ot_daily_threshold: v.ot_daily_threshold,
    dt_daily_threshold: v.dt_daily_threshold,
    ot_weekly_threshold: v.ot_weekly_threshold,
    pay_multipliers: v.pay_multipliers,
    bill_multipliers: v.bill_multipliers,
    daily_cap: v.daily_cap,
    prefill_holidays: v.prefill_holidays,
    prefill_leave: v.prefill_leave,
    holiday_calendar_id: v.holiday_calendar_id,
    approval_route: v.approval_route,
  };
}

/** Timesheet configuration form (period, entry mode, categories, thresholds, multipliers, cap, approval route). */
export function TimeConfigForm({
  initial,
  onSave,
  saveLabel = "Save",
  readOnly = false,
}: {
  initial: TimeConfigValues;
  onSave: (body: TimeConfigIn) => Promise<unknown>;
  saveLabel?: string;
  readOnly?: boolean;
}) {
  const styles = useStyles();
  const [v, setV] = useState<TimeConfigIn>(() => toConfigIn(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const errs = { ...configErrors(v), ...fieldErrors(error) };
  const set = <K extends keyof TimeConfigIn>(k: K, value: TimeConfigIn[K]) => {
    setSaved(false);
    setV((prev) => ({ ...prev, [k]: value }));
  };
  const optDec = (s: string) => (s.trim() === "" ? null : s.trim());
  const toggle = <T,>(list: T[], item: T, on: boolean) => (on ? Array.from(new Set([...list, item])) : list.filter((x) => x !== item));
  const setMult = (kind: "pay_multipliers" | "bill_multipliers", cat: string, value: string) => {
    const next = { ...v[kind] };
    if (value.trim() === "") delete next[cat];
    else next[cat] = value.trim();
    set(kind, next);
  };
  const route = v.approval_route;
  const setStep = (i: number, patch: Partial<TimeConfigIn["approval_route"][number]>) =>
    set(
      "approval_route",
      route.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    );
  const move = (i: number, d: -1 | 1) => {
    const next = [...route];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set("approval_route", next);
  };

  return (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        if (Object.keys(configErrors(v)).length) return;
        setBusy(true);
        setError(null);
        try {
          await onSave(v);
          setSaved(true);
        } catch (err) {
          setError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: "contents" }}>
        <Subtitle2 as="h2">Period and entry</Subtitle2>
        <div className={styles.grid}>
          <Field label="Period">
            <Dropdown value={PERIOD_LABELS[v.period_kind]} selectedOptions={[v.period_kind]} onOptionSelect={(_, d) => set("period_kind", d.optionValue as TimeConfigIn["period_kind"])}>
              {PERIOD_KINDS.map((p) => (
                <Option key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Week starts on">
            <Dropdown value={WEEKDAY_LABELS[v.week_start]} selectedOptions={[String(v.week_start)]} onOptionSelect={(_, d) => set("week_start", Number(d.optionValue))}>
              {WEEKDAY_LABELS.map((l, i) => (
                <Option key={l} value={String(i)}>
                  {l}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Entry mode">
            <Dropdown value={MODE_LABELS[v.entry_mode]} selectedOptions={[v.entry_mode]} onOptionSelect={(_, d) => set("entry_mode", d.optionValue as TimeConfigIn["entry_mode"])}>
              {ENTRY_MODES.map((m) => (
                <Option key={m} value={m}>
                  {MODE_LABELS[m]}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Hours per day" required validationMessage={errs.hours_per_day}>
            <Input value={v.hours_per_day} inputMode="decimal" onChange={(_, d) => set("hours_per_day", d.value)} />
          </Field>
          <Field label="Daily cap (hours)" required validationMessage={errs.daily_cap}>
            <Input value={v.daily_cap} inputMode="decimal" onChange={(_, d) => set("daily_cap", d.value)} />
          </Field>
          <Field label="Holiday calendar id" hint="Optional">
            <Input value={v.holiday_calendar_id ?? ""} onChange={(_, d) => set("holiday_calendar_id", d.value.trim() || null)} />
          </Field>
        </div>
        <Field label="Work days">
          <div className={styles.checks}>
            {WEEKDAY_LABELS.map((l, i) => (
              <Checkbox key={l} label={l} checked={v.work_days.includes(i)} onChange={(_, d) => set("work_days", toggle(v.work_days, i, !!d.checked).sort())} />
            ))}
          </div>
        </Field>
        <Field label="Enabled categories" validationMessage={errs.enabled_categories}>
          <div className={styles.checks}>
            {TIME_CATEGORIES.map((c) => (
              <Checkbox
                key={c}
                label={categoryLabel(c)}
                checked={v.enabled_categories.includes(c)}
                onChange={(_, d) => set("enabled_categories", toggle<TimeCategory>(v.enabled_categories, c, !!d.checked))}
              />
            ))}
          </div>
        </Field>
        <div className={styles.checks}>
          <Switch label="Prefill holidays" checked={v.prefill_holidays} onChange={(_, d) => set("prefill_holidays", d.checked)} />
          <Switch label="Prefill approved leave" checked={v.prefill_leave} onChange={(_, d) => set("prefill_leave", d.checked)} />
        </div>

        <Subtitle2 as="h2">Overtime</Subtitle2>
        <div className={styles.grid}>
          <Field label="OT after (hours / day)" hint="Empty = no daily OT" validationMessage={errs.ot_daily_threshold}>
            <Input value={v.ot_daily_threshold ?? ""} inputMode="decimal" onChange={(_, d) => set("ot_daily_threshold", optDec(d.value))} />
          </Field>
          <Field label="Double time after (hours / day)" hint="Empty = none" validationMessage={errs.dt_daily_threshold}>
            <Input value={v.dt_daily_threshold ?? ""} inputMode="decimal" onChange={(_, d) => set("dt_daily_threshold", optDec(d.value))} />
          </Field>
          <Field label="OT after (hours / week)" hint="Empty = no weekly OT" validationMessage={errs.ot_weekly_threshold}>
            <Input value={v.ot_weekly_threshold ?? ""} inputMode="decimal" onChange={(_, d) => set("ot_weekly_threshold", optDec(d.value))} />
          </Field>
        </div>
        <Field label="Multipliers per category" validationMessage={errs.multipliers} hint="Empty = 1.0 (regular) / category default">
          <table className={styles.multTable}>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Pay</th>
                <th scope="col">Bill</th>
              </tr>
            </thead>
            <tbody>
              {v.enabled_categories.map((c) => (
                <tr key={c}>
                  <th scope="row">{categoryLabel(c)}</th>
                  <td>
                    <Input
                      className={styles.multInput}
                      aria-label={`${categoryLabel(c)} pay multiplier`}
                      value={v.pay_multipliers[c] ?? ""}
                      inputMode="decimal"
                      onChange={(_, d) => setMult("pay_multipliers", c, d.value)}
                    />
                  </td>
                  <td>
                    <Input
                      className={styles.multInput}
                      aria-label={`${categoryLabel(c)} bill multiplier`}
                      value={v.bill_multipliers[c] ?? ""}
                      inputMode="decimal"
                      onChange={(_, d) => setMult("bill_multipliers", c, d.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Field>

        <Subtitle2 as="h2">Approval route</Subtitle2>
        {route.length === 0 && <Caption1>No steps: timesheets are approved on submission (if the tenant allows an empty route).</Caption1>}
        {route.map((s, i) => (
          <div key={i} className={styles.step}>
            <Caption1>{i + 1}.</Caption1>
            <Field label="Step kind">
              <Dropdown
                value={ROUTE_KIND_LABELS[s.kind]}
                selectedOptions={[s.kind]}
                onOptionSelect={(_, d) => setStep(i, { kind: d.optionValue as RouteStepKind, ref: REF_KINDS.includes(d.optionValue as RouteStepKind) ? s.ref : null })}
              >
                {ROUTE_STEP_KINDS.map((k) => (
                  <Option key={k} value={k}>
                    {ROUTE_KIND_LABELS[k]}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label={REF_LABEL[s.kind] ?? "Reference"} validationMessage={errs[`route_${i}`]}>
              <Input
                value={s.ref ?? ""}
                disabled={!REF_KINDS.includes(s.kind)}
                placeholder={s.kind === "finance_role" ? "finance_admin" : undefined}
                onChange={(_, d) => setStep(i, { ref: d.value.trim() || null })}
              />
            </Field>
            <Field label="Label">
              <Input value={s.label ?? ""} onChange={(_, d) => setStep(i, { label: d.value || null })} />
            </Field>
            <span>
              <Button appearance="subtle" aria-label="Move up" icon={<ArrowUp20Regular />} disabled={i === 0} onClick={() => move(i, -1)} />
              <Button appearance="subtle" aria-label="Move down" icon={<ArrowDown20Regular />} disabled={i === route.length - 1} onClick={() => move(i, 1)} />
              <Button
                appearance="subtle"
                aria-label="Remove step"
                icon={<Delete20Regular />}
                onClick={() => set("approval_route", route.filter((_, j) => j !== i))}
              />
            </span>
          </div>
        ))}
        <div>
          <Button icon={<Add20Regular />} onClick={() => set("approval_route", [...route, { kind: "placement_account_manager", ref: null, label: null }])}>
            Add step
          </Button>
        </div>
      </fieldset>

      <ErrorBar message={error ? errorMessage(error) : null} />
      {!readOnly && (
        <div className={styles.footer}>
          <Button type="submit" appearance="primary" icon={busy ? <Spinner size="tiny" /> : <Save20Regular />} disabled={busy || Object.keys(configErrors(v)).length > 0}>
            {saveLabel}
          </Button>
          <span aria-live="polite">{saved ? "Saved" : ""}</span>
        </div>
      )}
    </form>
  );
}
