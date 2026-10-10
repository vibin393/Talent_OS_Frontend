/** Candidate profile form <-> API mapping (Epic 9, `PATCH /portal/profile`). Pure. */
import type { PortalProfile, PortalProfileUpdate } from "@/lib/api/types";

export type ProfileDraft = {
  full_name: string;
  phones: string;
  city: string;
  state: string;
  country: string;
  links: string;
  headline: string;
  notice_period_days: string;
  comp_amount: string;
  comp_currency: string;
  comp_unit: string;
  willing_to_relocate: "" | "yes" | "no";
  work_authorization: string;
};

export const COMP_UNITS = [
  { value: "annual", label: "Per year" },
  { value: "monthly", label: "Per month" },
  { value: "daily", label: "Per day" },
  { value: "hourly", label: "Per hour" },
] as const;

const lines = (raw: string) =>
  raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export function profileDraft(p: PortalProfile): ProfileDraft {
  return {
    full_name: p.full_name,
    phones: p.phones.join("\n"),
    city: p.location?.city ?? "",
    state: p.location?.state ?? "",
    country: p.location?.country ?? "",
    links: p.links.join("\n"),
    headline: p.headline ?? "",
    notice_period_days: p.notice_period_days == null ? "" : String(p.notice_period_days),
    comp_amount: p.expected_compensation?.amount ?? "",
    comp_currency: p.expected_compensation?.currency ?? "",
    comp_unit: p.expected_compensation?.unit ?? "",
    willing_to_relocate: p.willing_to_relocate == null ? "" : p.willing_to_relocate ? "yes" : "no",
    work_authorization: p.work_authorization ?? "",
  };
}

export function validateProfile(d: ProfileDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.full_name.trim()) e.full_name = "Enter your name";
  else if (d.full_name.trim().length > 200) e.full_name = "Keep your name under 200 characters";
  if (lines(d.phones).length > 5) e.phones = "Add at most 5 phone numbers";
  if (lines(d.links).length > 10) e.links = "Add at most 10 links";
  if (d.notice_period_days.trim()) {
    const n = Number(d.notice_period_days);
    if (!Number.isInteger(n) || n < 0 || n > 365) e.notice_period_days = "Enter a number of days from 0 to 365";
  }
  const amount = d.comp_amount.trim();
  if (amount && !/^\d{1,12}(\.\d{1,2})?$/.test(amount)) e.comp_amount = "Enter an amount like 1200000 or 95.50";
  if (d.comp_currency.trim() && !/^[A-Za-z]{3}$/.test(d.comp_currency.trim())) e.comp_currency = "Use a 3-letter currency code, like INR";
  if (amount && !d.comp_currency.trim()) e.comp_currency = "Add the currency";
  return e;
}

/** Only the fields that changed, in the API shape (unchanged fields are not sent). */
export function profileUpdate(initial: ProfileDraft, d: ProfileDraft): PortalProfileUpdate {
  const out: PortalProfileUpdate = {};
  const changed = (...keys: (keyof ProfileDraft)[]) => keys.some((k) => initial[k].trim() !== d[k].trim());
  if (changed("full_name")) out.full_name = d.full_name.trim();
  if (changed("phones")) out.phones = lines(d.phones);
  if (changed("city", "state", "country"))
    out.location = { city: d.city.trim() || null, state: d.state.trim() || null, country: d.country.trim() || null };
  if (changed("links")) out.links = lines(d.links);
  if (changed("headline")) out.headline = d.headline.trim();
  if (changed("notice_period_days") && d.notice_period_days.trim()) out.notice_period_days = Number(d.notice_period_days);
  if (changed("comp_amount", "comp_currency", "comp_unit") && d.comp_amount.trim())
    out.expected_compensation = {
      amount: d.comp_amount.trim(),
      currency: d.comp_currency.trim().toUpperCase() || null,
      unit: (d.comp_unit || null) as "annual" | "monthly" | "daily" | "hourly" | null,
    };
  if (changed("willing_to_relocate") && d.willing_to_relocate) out.willing_to_relocate = d.willing_to_relocate === "yes";
  if (changed("work_authorization")) out.work_authorization = d.work_authorization.trim();
  return out;
}
