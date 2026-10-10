"use client";

import { useQuery } from "@tanstack/react-query";
import { clientKeys, clientsApi } from "@/features/clients/api";
import { usePermission } from "@/features/auth/use-permission";
import type { DemandOut } from "@/lib/api/types";
import { demandComposeContext } from "./compose-contexts";
import { EmailButton } from "./email-button";

/** "Email" on a demand: suggests the client's contacts (hiring manager pre-filled when known). */
export function DemandEmailButton({ demand }: { demand: DemandOut }) {
  const canSend = usePermission("email:send");
  const canReadContacts = usePermission("contact:read");
  const contacts = useQuery({
    queryKey: [...clientKeys.contacts(demand.client_id), "compose"],
    queryFn: ({ signal }) => clientsApi.listContacts(demand.client_id, false, 1, 100, signal),
    enabled: canSend && canReadContacts,
    staleTime: 60_000,
  });
  return <EmailButton context={() => demandComposeContext(demand, contacts.data?.items ?? [])} />;
}
