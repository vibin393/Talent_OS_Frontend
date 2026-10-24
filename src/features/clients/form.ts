/** Pure form state <-> API body mapping for the client and contact drawers. */
import type {
  ClientCreate,
  ClientOut,
  ClientStatus,
  ClientUpdate,
  ContactCreate,
  ContactOut,
  ContactType,
  ContactUpdate,
} from "@/lib/api/types";
import { cleanLocations, isValidGstin, normalizeGstin } from "./format";

export type LocationRow = { city: string; state: string; country: string };

export type ClientDraft = {
  name: string;
  status: ClientStatus;
  industry: string;
  website: string;
  gstin: string;
  ownerId: string | null;
  ownerName: string;
  locations: LocationRow[];
};

export type FieldErrors = Partial<Record<string, string>>;

export function clientDraft(c?: ClientOut | null): ClientDraft {
  return {
    name: c?.name ?? "",
    status: c?.status ?? "prospect",
    industry: c?.industry ?? "",
    website: c?.website ?? "",
    gstin: c?.gstin ?? "",
    ownerId: c?.owner_id ?? null,
    ownerName: c?.owner?.name ?? "",
    locations: (c?.locations ?? []).map((l) => ({ city: l.city, state: l.state ?? "", country: l.country })),
  };
}

const blank = (s: string) => (s.trim() === "" ? null : s.trim());

export function validateClientDraft(d: ClientDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!d.name.trim()) errors.name = "Enter the client name";
  else if (d.name.trim().length > 200) errors.name = "Use at most 200 characters";
  if (!isValidGstin(d.gstin)) errors.gstin = "GSTIN must look like 22AAAAA0000A1Z5";
  d.locations.forEach((l, i) => {
    const any = l.city.trim() || l.state.trim() || l.country.trim();
    if (any && (!l.city.trim() || !l.country.trim())) errors[`locations.${i}`] = "Enter at least a city and a country";
  });
  return errors;
}

export function buildClientCreate(d: ClientDraft): ClientCreate {
  const body: ClientCreate = {
    name: d.name.trim(),
    status: d.status,
    industry: blank(d.industry),
    website: blank(d.website),
    gstin: d.gstin.trim() ? normalizeGstin(d.gstin) : null,
    locations: cleanLocations(d.locations),
  };
  if (d.ownerId) body.owner_id = d.ownerId;
  return body;
}

/** Only the fields that differ from `c` (empty object when nothing changed). */
export function buildClientUpdate(c: ClientOut, d: ClientDraft): ClientUpdate {
  const next = buildClientCreate(d);
  const body: ClientUpdate = {};
  if (next.name !== c.name) body.name = next.name;
  if (next.status !== c.status) body.status = next.status;
  if ((next.industry ?? null) !== (c.industry ?? null)) body.industry = next.industry;
  if ((next.website ?? null) !== (c.website ?? null)) body.website = next.website;
  if ((next.gstin ?? null) !== (c.gstin ?? null)) body.gstin = next.gstin;
  if (d.ownerId && d.ownerId !== c.owner_id) body.owner_id = d.ownerId;
  const before = JSON.stringify(cleanLocations(clientDraft(c).locations));
  if (JSON.stringify(next.locations) !== before) body.locations = next.locations;
  return body;
}

export type ContactDraft = { name: string; title: string; email: string; phone: string; type: ContactType };

export function contactDraft(c?: ContactOut | null): ContactDraft {
  return {
    name: c?.name ?? "",
    title: c?.title ?? "",
    email: c?.email ?? "",
    phone: c?.phone ?? "",
    type: c?.type ?? "hiring_manager",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // NOSONAR

export function validateContactDraft(d: ContactDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!d.name.trim()) errors.name = "Enter the contact's name";
  if (d.email.trim() && !EMAIL_RE.test(d.email.trim())) errors.email = "Enter a valid email address";
  if (d.phone.trim() && !/^[+()\d\s.-]{5,40}$/.test(d.phone.trim())) errors.phone = "Enter a valid phone number";
  return errors;
}

export function buildContactCreate(d: ContactDraft): ContactCreate {
  return {
    name: d.name.trim(),
    title: blank(d.title),
    email: d.email.trim() ? d.email.trim().toLowerCase() : null,
    phone: blank(d.phone),
    type: d.type,
  };
}

export function buildContactUpdate(c: ContactOut, d: ContactDraft): ContactUpdate {
  const next = buildContactCreate(d);
  const body: ContactUpdate = {};
  if (next.name !== c.name) body.name = next.name;
  if ((next.title ?? null) !== (c.title ?? null)) body.title = next.title;
  if ((next.email ?? null) !== (c.email ?? null)) body.email = next.email;
  // The API stores E.164; only send the phone when the text itself changed.
  if ((next.phone ?? null) !== (c.phone ?? null)) body.phone = next.phone;
  if (next.type !== c.type) body.type = next.type;
  return body;
}

/** Map API 422 field names (`body.gstin`, `body.locations.0.city`) onto draft error keys. */
export function mapServerFields(fields: Record<string, string>, raw: unknown): FieldErrors {
  const out: FieldErrors = {};
  // Pydantic prefixes custom validator messages with "Value error, ".
  for (const [k, v] of Object.entries(fields)) out[k] = v.replace(/^Value error, /, "");
  if (Array.isArray(raw)) {
    for (const f of raw) {
      if (typeof f !== "object" || f === null) continue;
      const field = (f as { field?: unknown }).field;
      const message = (f as { message?: unknown }).message;
      if (typeof field !== "string" || typeof message !== "string") continue;
      const m = /locations\.(\d+)/.exec(field);
      if (m) out[`locations.${m[1]}`] = message.replace(/^Value error, /, "");
    }
  }
  return out;
}
