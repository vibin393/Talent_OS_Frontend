/**
 * Client-side preview of `Backend/app/templates/incident_notice.md.j2` (the backend renders the real
 * notice when notifying). Kept in step with the template's sections: nature, data categories,
 * mitigation, DPDP steps and contact.
 */
import type { IncidentOut } from "@/lib/api/types";

export type IncidentDetails = { nature?: string; data_categories?: string[]; mitigation?: string; contact?: string };

export function incidentDetails(incident: Pick<IncidentOut, "details">): IncidentDetails {
  const d = (incident.details ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  return {
    nature: str(d.nature),
    data_categories: Array.isArray(d.data_categories) ? d.data_categories.filter((c): c is string => typeof c === "string") : undefined,
    mitigation: str(d.mitigation),
    contact: str(d.contact),
  };
}

export function incidentPreview(incident: Pick<IncidentOut, "id" | "title" | "description" | "severity" | "confirmed_at" | "details">, tenantName = "{tenant}"): string {
  const d = incidentDetails(incident);
  const categories = d.data_categories?.length
    ? d.data_categories.map((c) => `- ${c}`).join("\n")
    : "- Under investigation; we will update you as soon as this is known.";
  return [
    `# Personal data breach notification: ${incident.title}`,
    "",
    `Dear ${tenantName} administrator,`,
    "",
    `We are informing you of a personal data breach confirmed on **${new Date(incident.confirmed_at).toUTCString()}** that affects your workspace on Talent OS.`,
    "",
    "## What happened",
    d.nature ?? incident.description,
    "",
    "## Data categories involved",
    categories,
    "",
    "## What we have done",
    d.mitigation ?? "We contained the incident and are investigating. We will send updates as we learn more.",
    "",
    "## What you should do (DPDP Act 2023)",
    "- Inform the Data Protection Board of India without delay, as required for Data Fiduciaries.",
    "- Inform the affected Data Principals (candidates and users) in clear and plain language.",
    "- Record the breach and your actions in your incident register.",
    "",
    "## Contact",
    d.contact ?? "security@talentos.example",
    "",
    `Severity: ${incident.severity} · Reference: ${incident.id}`,
  ].join("\n");
}
