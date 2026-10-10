/** Marketplace labels and pure UI logic (Epic 69, spec Part D): badges, filters, wizard gating, schema-driven fields. */
import type { InstallationStatus, InstallState, JsonSchema, Listing, PublisherKind, ScopeLine } from "./api";

export type BadgeColor = "brand" | "informative" | "subtle" | "success" | "warning" | "danger";

export const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All categories" },
  { value: "job_boards", label: "Job boards" },
  { value: "hrms", label: "HRMS" },
  { value: "accounting", label: "Accounting" },
  { value: "payroll", label: "Payroll" },
  { value: "calendar", label: "Calendar" },
  { value: "telephony", label: "Telephony" },
  { value: "speech_to_text", label: "Speech-to-text" },
  { value: "assessment", label: "Assessments" },
  { value: "bgv", label: "Background verification" },
  { value: "esignature", label: "eSignature" },
  { value: "einvoice", label: "E-invoicing" },
  { value: "messaging", label: "Messaging" },
  { value: "finance_compliance", label: "Finance compliance" },
  { value: "bi", label: "BI" },
  { value: "other", label: "Other" },
];

export const PUBLISHER_OPTIONS: { value: "" | PublisherKind; label: string }[] = [
  { value: "", label: "All publishers" },
  { value: "platform", label: "Talent OS" },
  { value: "partner", label: "Verified partners" },
  { value: "tenant", label: "Private" },
];

export function categoryLabel(value: string | null | undefined): string {
  return CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? "Other";
}

export function publisherBadge(kind: PublisherKind, label: string): { label: string; color: BadgeColor } {
  if (kind === "platform") return { label: "Talent OS", color: "brand" };
  if (kind === "tenant") return { label: "Private", color: "subtle" };
  return { label: label || "Verified partner", color: "informative" };
}

/** The card's state badge (none when not installed). */
export function installStateBadge(state: InstallState): { label: string; color: BadgeColor } | null {
  switch (state) {
    case "installed":
      return { label: "Installed", color: "success" };
    case "configured":
      return { label: "Configured", color: "success" };
    case "pending_approval":
      return { label: "Pending approval", color: "warning" };
    case "pending_consent":
      return { label: "Pending consent", color: "warning" };
    case "reconsent_required":
      return { label: "Re-consent required", color: "warning" };
    case "degraded":
      return { label: "Needs attention", color: "danger" };
    case "suspended":
      return { label: "Suspended", color: "danger" };
    default:
      return null;
  }
}

export const STATUS_LABELS: Record<InstallationStatus, { label: string; color: BadgeColor }> = {
  pending_consent: { label: "Pending consent", color: "warning" },
  pending_approval: { label: "Pending approval", color: "warning" },
  active: { label: "Active", color: "success" },
  degraded: { label: "Degraded", color: "danger" },
  reconsent_required: { label: "Re-consent required", color: "warning" },
  suspended: { label: "Suspended", color: "danger" },
  uninstalled: { label: "Uninstalled", color: "subtle" },
};

export function healthLabel(h: string | null | undefined): string {
  if (h === "ok") return "OK";
  if (h === "degraded") return "Degraded";
  if (h === "failing") return "Failing";
  return "Not checked";
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  dead: "Dead",
};

export function directionLabel(direction: string, name: string): string {
  return direction === "in" ? `Receives from ${name}` : `Sends to ${name}`;
}

const COUNTRIES: Record<string, string> = { IN: "India", US: "United States", GB: "United Kingdom", SG: "Singapore", DE: "Germany", IE: "Ireland", AE: "United Arab Emirates" };

export function countryName(code: string): string {
  return COUNTRIES[code?.toUpperCase()] ?? code;
}

/** Primary action on the listing page. */
export function listingAction(listing: Pick<Listing, "kind" | "install_state" | "install_allowed" | "manage_path">, canManage: boolean):
  | { kind: "install"; disabledReason: string | null }
  | { kind: "manage" }
  | { kind: "open"; href: string } {
  if (listing.kind === "legacy_connector" || listing.kind === "calendar") return { kind: "open", href: listing.manage_path ?? "/settings" };
  if (listing.install_state !== "not_installed") return { kind: "manage" };
  if (!canManage) return { kind: "install", disabledReason: "You need the Manage integrations permission" };
  if (!listing.install_allowed) return { kind: "install", disabledReason: "Not allowed by your app policy" };
  return { kind: "install", disabledReason: null };
}

export const WIZARD_STEPS = ["Review access", "Configure", "Test", "Finish"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

/** Steps shown for a listing (Apps skip "Test"). */
export function wizardSteps(kind: Listing["kind"]): WizardStep[] {
  return kind === "app" ? ["Review access", "Configure", "Finish"] : [...WIZARD_STEPS];
}

/** "Review access" may advance only with the consent checkbox and a 10-500 character purpose per sensitive scope. */
export function reviewAccessComplete(scopes: ScopeLine[], purposes: Record<string, string>, consent: boolean): boolean {
  if (!consent) return false;
  return scopes.filter((s) => s.sensitive).every((s) => {
    const n = (purposes[s.key] ?? "").trim().length;
    return n >= 10 && n <= 500;
  });
}

export type FormField = {
  name: string;
  label: string;
  help: string | null;
  kind: "text" | "number" | "boolean" | "select";
  options: string[];
  required: boolean;
  defaultValue: unknown;
};

/** Form fields generated from a manifest's JSON Schema (labels from ``title``, help from ``description``). */
export function schemaFields(schema: JsonSchema | null | undefined): FormField[] {
  const props = schema?.properties ?? {};
  const required = new Set(schema?.required ?? []);
  return Object.entries(props)
    .filter(([name]) => name !== "mode")
    .map(([name, p]) => {
      const kind: FormField["kind"] = p.enum
        ? "select"
        : p.type === "boolean"
          ? "boolean"
          : p.type === "integer" || p.type === "number"
            ? "number"
            : "text";
      return {
        name,
        label: p.title ?? name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
        help: p.description ?? null,
        kind,
        options: (p.enum ?? []).map(String),
        required: required.has(name),
        defaultValue: p.default,
      };
    });
}

/** Missing required config fields / secrets for the "Configure" step. */
export function configureComplete(fields: FormField[], values: Record<string, unknown>, secretNames: string[], secrets: Record<string, string>): boolean {
  const configOk = fields.filter((f) => f.required && f.kind !== "boolean").every((f) => `${values[f.name] ?? ""}`.trim() !== "");
  return configOk && secretNames.every((n) => (secrets[n] ?? "").trim() !== "");
}

/** "Saved · ends in {last4} · changed {date}" for a stored secret (never its value). */
export function secretCaption(fingerprint: string | null, rotatedAt: string | null): string {
  const date = rotatedAt ? new Date(rotatedAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";
  return `Saved · ends in ${fingerprint ?? "····"} · changed ${date}`;
}

export function uninstallErasureCaption(name: string, supported: boolean): string | null {
  return supported ? null : `${name} can't receive deletion requests from Talent OS. Contact them directly.`;
}

export function policyWarning(affected: number): string | null {
  if (affected <= 0) return null;
  return `${affected} installed ${affected === 1 ? "app is" : "apps are"} no longer allowed by this policy. They keep running until you uninstall them.`;
}
