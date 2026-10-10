/** Pure validation of the timesheet config form (Epic 25). Decimal strings only. */
import type { TimeConfigIn } from "./types";

const HOURS_2DP = /^\d{1,2}(\.\d{1,2})?$/;
const WEEK_HOURS = /^\d{1,3}(\.\d{1,2})?$/;
const MULTIPLIER = /^\d{1,4}(\.\d{1,4})?$/;

function hundredths(v: string): number {
  const [w, f = ""] = v.split(".");
  return Number(w) * 100 + Number(f.padEnd(2, "0").slice(0, 2));
}

export function configErrors(v: TimeConfigIn): Record<string, string> {
  const e: Record<string, string> = {};
  const day = (k: "hours_per_day" | "daily_cap" | "ot_daily_threshold" | "dt_daily_threshold") => {
    const val = v[k];
    if (val === null || val === undefined) return;
    if (!HOURS_2DP.test(val) || hundredths(val) > 2400) e[k] = "Hours between 0 and 24, up to 2 decimals";
  };
  day("hours_per_day");
  day("daily_cap");
  day("ot_daily_threshold");
  day("dt_daily_threshold");
  if (v.ot_weekly_threshold !== null && !WEEK_HOURS.test(v.ot_weekly_threshold)) e.ot_weekly_threshold = "Hours up to 168, 2 decimals";
  else if (v.ot_weekly_threshold !== null && hundredths(v.ot_weekly_threshold) > 16800) e.ot_weekly_threshold = "Hours up to 168, 2 decimals";
  if (
    !e.ot_daily_threshold &&
    !e.dt_daily_threshold &&
    v.ot_daily_threshold &&
    v.dt_daily_threshold &&
    hundredths(v.dt_daily_threshold) <= hundredths(v.ot_daily_threshold)
  )
    e.dt_daily_threshold = "Double time must start after overtime";
  if (v.enabled_categories.length === 0) e.enabled_categories = "Enable at least one category";
  const bad = [...Object.values(v.pay_multipliers), ...Object.values(v.bill_multipliers)].some((m) => !MULTIPLIER.test(m));
  if (bad) e.multipliers = "Multipliers are decimals like 1.5 (up to 4 decimals)";
  v.approval_route.forEach((s, i) => {
    if ((s.kind === "user" || s.kind === "client_user") && !s.ref) e[`route_${i}`] = "Required for this step kind";
  });
  return e;
}
