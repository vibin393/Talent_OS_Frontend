/** Builders for the compose dialog context from the entity pages that open it. */
import type { CandidateOut, ContactOut, DemandOut } from "@/lib/api/types";
import { type ComposeContext, type ComposeRecipient, entityRecipient } from "./compose-model";

type CandidateLike = Pick<CandidateOut, "id" | "full_name" | "human_id" | "primary_email">;
type ContactLike = Pick<ContactOut, "id" | "name" | "email" | "archived_at">;

function contactRecipients(contacts: readonly ContactLike[]): ComposeRecipient[] {
  return contacts
    .filter((c) => !c.archived_at && !!c.email)
    .map((c) => entityRecipient("contact", c.id, c.name, c.email));
}

export function candidateComposeContext(c: CandidateLike): ComposeContext {
  const me = entityRecipient("candidate", c.id, c.full_name, c.primary_email ?? null);
  return {
    entityType: "candidate",
    entityId: c.id,
    label: c.full_name,
    contextRefs: { candidate_id: c.id },
    related: [{ entity_type: "candidate", entity_id: c.id }],
    suggested: [me],
    initialTo: [me],
  };
}

export function clientComposeContext(
  client: { id: string; name: string },
  contacts: readonly ContactLike[],
): ComposeContext {
  return {
    entityType: "client",
    entityId: client.id,
    label: client.name,
    contextRefs: { client_id: client.id },
    related: [{ entity_type: "client", entity_id: client.id }],
    suggested: contactRecipients(contacts),
    initialTo: [],
  };
}

export function contactComposeContext(contact: ContactLike, clientId: string, clientContacts: readonly ContactLike[]): ComposeContext {
  const to = entityRecipient("contact", contact.id, contact.name, contact.email);
  return {
    entityType: "contact",
    entityId: contact.id,
    label: contact.name,
    contextRefs: { contact_id: contact.id, client_id: clientId },
    related: [
      { entity_type: "contact", entity_id: contact.id },
      { entity_type: "client", entity_id: clientId },
    ],
    suggested: contactRecipients(clientContacts),
    initialTo: [to],
  };
}

export function demandComposeContext(
  demand: Pick<DemandOut, "id" | "req_id" | "title" | "client_id" | "hiring_manager_contact_id">,
  contacts: readonly ContactLike[],
): ComposeContext {
  const suggested = contactRecipients(contacts);
  const hm = suggested.find((r) => r.entityId === demand.hiring_manager_contact_id);
  return {
    entityType: "demand",
    entityId: demand.id,
    label: `${demand.req_id} ${demand.title}`,
    contextRefs: { demand_id: demand.id, client_id: demand.client_id },
    related: [{ entity_type: "demand", entity_id: demand.id }],
    suggested,
    initialTo: hm ? [hm] : [],
  };
}
