import type { ClientLocation, ClientStatus, ContactType } from "@/lib/api/types";

export const CLIENT_STATUSES: readonly ClientStatus[] = ["prospect", "active", "inactive"];

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  prospect: "Prospect",
  active: "Active",
  inactive: "Inactive",
};

export const CLIENT_STATUS_COLORS: Record<ClientStatus, "informative" | "success" | "subtle"> = {
  prospect: "informative",
  active: "success",
  inactive: "subtle",
};

export const CONTACT_TYPES: readonly ContactType[] = ["hiring_manager", "hr", "procurement", "finance", "other"];

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  hiring_manager: "Hiring manager",
  hr: "HR",
  procurement: "Procurement",
  finance: "Finance",
  other: "Other",
};

/** Same pattern as the backend (`GSTIN_RE`), applied after trimming and upper-casing. */
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function normalizeGstin(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidGstin(value: string): boolean {
  const v = normalizeGstin(value);
  return v === "" || GSTIN_PATTERN.test(v);
}

/** "Pune, MH, India" */
export function formatLocation(l: Pick<ClientLocation, "city" | "state" | "country">): string {
  return [l.city, l.state, l.country]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
}

/** Locations as one line ("Pune, India; Austin, TX, USA"), "—" when none. */
export function formatLocations(locations: readonly ClientLocation[] | null | undefined, max = 3): string {
  const list = (locations ?? []).map(formatLocation).filter(Boolean);
  if (list.length === 0) return "—";
  const shown = list.slice(0, max).join("; ");
  return list.length > max ? `${shown} +${list.length - max} more` : shown;
}

/** Location rows from the form: trimmed, fully blank rows dropped, `state` null when empty. */
export function cleanLocations(rows: readonly { city: string; state: string; country: string }[]): ClientLocation[] {
  return rows
    .map((r) => ({ city: r.city.trim(), state: r.state.trim(), country: r.country.trim() }))
    .filter((r) => r.city || r.state || r.country)
    .map((r) => ({ city: r.city, state: r.state || null, country: r.country }));
}

/** Host part of a website for display ("https://www.acme.com/x" -> "www.acme.com"). */
export function websiteLabel(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}
