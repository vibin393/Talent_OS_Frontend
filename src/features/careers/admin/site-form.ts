/** Career-site settings form <-> `PATCH /api/v1/admin/career-site` (Epic 9, B5). Pure. */
import type { CareerSiteOut, CareerSiteUpdate } from "@/lib/api/types";
import { HEX_COLOR } from "../theme";

export type SiteDraft = {
  enabled: boolean;
  display_name: string;
  brand_color: string;
  about_md: string;
  privacy_contact_email: string;
  apply_requires_phone: boolean;
  labels: Record<string, string>;
};

/** Stage keys in pipeline order (unknown keys from the API follow). */
export const STAGE_ORDER = ["applied", "custom", "shortlisted", "submitted", "interviewing", "selected", "offered", "hired", "rejected", "withdrawn"];

export const STAGE_NAMES: Record<string, string> = {
  applied: "Applied",
  custom: "Custom stages",
  shortlisted: "Shortlisted",
  submitted: "Submitted to client",
  interviewing: "Interviewing",
  selected: "Selected",
  offered: "Offered",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export function stageKeys(site: Pick<CareerSiteOut, "default_stage_labels">): string[] {
  const keys = Object.keys(site.default_stage_labels);
  return [...STAGE_ORDER.filter((k) => keys.includes(k)), ...keys.filter((k) => !STAGE_ORDER.includes(k))];
}

export function siteDraft(site: CareerSiteOut): SiteDraft {
  return {
    enabled: site.enabled,
    display_name: site.display_name ?? "",
    brand_color: site.brand_color ?? "",
    about_md: site.about_md ?? "",
    privacy_contact_email: site.privacy_contact_email ?? "",
    apply_requires_phone: site.apply_requires_phone,
    labels: { ...site.candidate_stage_labels },
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // NOSONAR

export function validateSite(d: SiteDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.enabled && !d.display_name.trim()) e.display_name = "Enter the name candidates see before turning the site on";
  if (d.display_name.trim().length > 200) e.display_name = "Keep the name under 200 characters";
  if (d.brand_color && !HEX_COLOR.test(d.brand_color)) e.brand_color = "Use a hex colour like #0F6CBD";
  if (d.about_md.length > 10_000) e.about_md = `Keep this under 10,000 characters (${d.about_md.length.toLocaleString()} now)`;
  if (d.privacy_contact_email.trim() && !EMAIL.test(d.privacy_contact_email.trim())) e.privacy_contact_email = "Enter a valid email address";
  if (d.enabled && !d.privacy_contact_email.trim()) e.privacy_contact_email = "Candidates need a privacy contact before the site goes live";
  for (const [k, v] of Object.entries(d.labels)) if (v.trim().length > 60) e[`label.${k}`] = "Keep labels under 60 characters";
  return e;
}

/** Changed fields only. Blank stage labels are dropped (the default applies). */
export function siteUpdate(initial: SiteDraft, d: SiteDraft): CareerSiteUpdate {
  const out: CareerSiteUpdate = {};
  if (initial.enabled !== d.enabled) out.enabled = d.enabled;
  if (initial.display_name.trim() !== d.display_name.trim() && d.display_name.trim()) out.display_name = d.display_name.trim();
  if (initial.brand_color !== d.brand_color && d.brand_color) out.brand_color = d.brand_color.toUpperCase();
  if (initial.about_md !== d.about_md) out.about_md = d.about_md;
  if (initial.privacy_contact_email.trim() !== d.privacy_contact_email.trim() && d.privacy_contact_email.trim())
    out.privacy_contact_email = d.privacy_contact_email.trim();
  if (initial.apply_requires_phone !== d.apply_requires_phone) out.apply_requires_phone = d.apply_requires_phone;
  const clean = (labels: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(labels)
        .map(([k, v]) => [k, v.trim()] as const)
        .filter(([, v]) => v),
    );
  const a = clean(initial.labels);
  const b = clean(d.labels);
  if (JSON.stringify(Object.entries(a).sort((x, y) => (String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0))) !== JSON.stringify(Object.entries(b).sort((x, y) => (String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0)))) out.candidate_stage_labels = b;
  return out;
}
