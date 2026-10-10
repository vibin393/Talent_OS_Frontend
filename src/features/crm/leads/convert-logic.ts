/** Convert-lead wizard state (pure, unit-tested). */
import { isApiError } from "@/lib/api/errors";
import type { LeadConvertIn, LeadOut, OpportunityLineIn, Service } from "../types";

export type ClientStep =
  | { mode: "link"; clientId: string | null; clientName: string; suggested: boolean }
  | { mode: "create"; name: string; website: string; industry: string; gstin: string };

export type ContactStep =
  | { mode: "none" }
  | { mode: "link"; contactId: string | null }
  | { mode: "create"; firstName: string; lastName: string; email: string; phone: string; title: string };

export type OpportunityStep = {
  name: string;
  service: Service;
  estimatedRevenue: string;
  currency: string;
  closeDate: string;
  ownerId: string | null;
  ownerName: string;
  accountManagerId: string | null;
  accountManagerName: string;
  lines: { title: string; positions: number }[];
};

export type WizardState = {
  step: 0 | 1 | 2;
  client: ClientStep;
  contact: ContactStep;
  opportunity: OpportunityStep;
  notice: string | null;
};

function splitName(full: string | null): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export function rolesOf(lead: Pick<LeadOut, "estimated_roles">): { title: string; positions: number }[] {
  return (lead.estimated_roles ?? [])
    .map((r) => ({ title: String(r.title ?? ""), positions: Math.max(1, Number(r.positions ?? 1) || 1) }))
    .filter((r) => r.title.trim());
}

export function initialWizard(lead: LeadOut): WizardState {
  const { first, last } = splitName(lead.contact_name);
  return {
    step: 0,
    notice: null,
    client: {
      mode: "create",
      name: lead.company_name,
      website: lead.website ?? "",
      industry: lead.industry ?? "",
      gstin: lead.gstin ?? "",
    },
    contact: first
      ? {
          mode: "create",
          firstName: first,
          lastName: last,
          email: lead.contact_email ?? "",
          phone: lead.contact_phone ?? "",
          title: lead.contact_title ?? "",
        }
      : { mode: "none" },
    opportunity: {
      name: `${lead.company_name} - staffing`,
      service: "contract_staffing",
      estimatedRevenue: lead.expected_annual_revenue ?? "0",
      currency: lead.currency,
      closeDate: "",
      ownerId: lead.owner_id,
      ownerName: lead.owner?.name ?? "",
      accountManagerId: null,
      accountManagerName: "",
      lines: rolesOf(lead),
    },
  };
}

/**
 * Apply a convert error: `409 client_exists` switches step 1 to "link" with the suggested Client and
 * returns the wizard to that step. Returns null for any other error.
 */
export function applyConvertError(state: WizardState, e: unknown): WizardState | null {
  if (!isApiError(e) || e.status !== 409 || e.code !== "client_exists") return null;
  const id = typeof e.details.client_id === "string" ? e.details.client_id : null;
  const name =
    (typeof e.details.client_name === "string" && e.details.client_name) ||
    (state.client.mode === "create" ? state.client.name : "");
  return {
    ...state,
    step: 0,
    client: { mode: "link", clientId: id, clientName: name, suggested: true },
    // A linked contact belonged to the previous client choice.
    contact: state.contact.mode === "link" ? { mode: "none" } : state.contact,
    notice: "A client with this name already exists. It has been selected; link the lead to it or pick another client.",
  };
}

const blank = (s: string) => (s.trim() ? s.trim() : null);

export function buildConvertIn(s: WizardState): LeadConvertIn {
  const client: LeadConvertIn["client"] =
    s.client.mode === "link"
      ? { mode: "link", client_id: s.client.clientId ?? "" }
      : {
          mode: "create",
          name: s.client.name.trim(),
          website: blank(s.client.website),
          industry: blank(s.client.industry),
          gstin: blank(s.client.gstin),
        };
  let contact: LeadConvertIn["contact"] = { mode: "none" };
  if (s.contact.mode === "link" && s.contact.contactId) contact = { mode: "link", contact_id: s.contact.contactId };
  if (s.contact.mode === "create") {
    contact = {
      mode: "create",
      first_name: s.contact.firstName.trim(),
      last_name: blank(s.contact.lastName),
      email: blank(s.contact.email),
      phone: blank(s.contact.phone),
      title: blank(s.contact.title),
    };
  }
  const o = s.opportunity;
  const lines: OpportunityLineIn[] = o.lines
    .filter((l) => l.title.trim())
    .map((l) => ({ title: l.title.trim(), positions: l.positions }));
  return {
    client,
    contact,
    opportunity: {
      name: o.name.trim(),
      service: o.service,
      estimated_revenue: o.estimatedRevenue.trim() || "0",
      currency: o.currency || null,
      expected_close_date: o.closeDate || null,
      owner_id: o.ownerId,
      account_manager_id: o.accountManagerId,
      lines,
    },
  };
}

/** Validation for the current step (empty = can continue). */
export function stepErrors(s: WizardState): string[] {
  const e: string[] = [];
  if (s.step === 0) {
    if (s.client.mode === "link" && !s.client.clientId) e.push("Choose a client to link.");
    if (s.client.mode === "create" && !s.client.name.trim()) e.push("Client name is required.");
  }
  if (s.step === 1 && s.contact.mode === "create" && !s.contact.firstName.trim()) e.push("Contact first name is required.");
  if (s.step === 1 && s.contact.mode === "link" && !s.contact.contactId) e.push("Choose a contact to link.");
  if (s.step === 2) {
    if (!s.opportunity.name.trim()) e.push("Opportunity name is required.");
    const rev = s.opportunity.estimatedRevenue.trim();
    if (rev && !/^\d+(\.\d{1,2})?$/.test(rev)) e.push("Estimated revenue must be a number.");
  }
  return e;
}
