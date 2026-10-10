"use client";

import { MessageBar, MessageBarActions, MessageBarBody, MessageBarTitle } from "@fluentui/react-components";
import { useQueries, useQuery } from "@tanstack/react-query";
import { AppLink } from "@/components/app-link";
import { usePermission } from "@/features/auth/use-permission";
import { legalEntitiesApi, legalEntityKeys } from "./api";
import { readinessBannerText } from "./readiness";

/** FR-76: "Complete PAN, GST and bank details before your first Invoice" on a Legal Entity page. */
export function ReadinessBanner({ legalEntityId }: { legalEntityId: string }) {
  const readiness = useQuery({
    queryKey: legalEntityKeys.readiness(legalEntityId),
    queryFn: ({ signal }) => legalEntitiesApi.readiness(legalEntityId, signal),
  });
  const text = readinessBannerText(readiness.data);
  if (!text) return null;
  return (
    <MessageBar intent="warning" layout="multiline" style={{ marginBottom: 12 }}>
      <MessageBarBody>
        <MessageBarTitle>Not ready for invoicing</MessageBarTitle>
        {text}
      </MessageBarBody>
    </MessageBar>
  );
}

/**
 * Settings home (Finance roles, i.e. holders of `legal_entity:write`): one banner when any active Legal Entity
 * is not ready for invoicing yet.
 */
export function LegalEntitiesReadinessSummary() {
  const canWrite = usePermission("legal_entity:write");
  const list = useQuery({ queryKey: legalEntityKeys.list, queryFn: ({ signal }) => legalEntitiesApi.list(signal), enabled: canWrite });
  const active = (list.data ?? []).filter((e) => e.status === "active");
  const readiness = useQueries({
    queries: active.map((e) => ({
      queryKey: legalEntityKeys.readiness(e.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => legalEntitiesApi.readiness(e.id, signal),
    })),
  });
  const notReady = active.filter((_, i) => readiness[i]?.data && !readiness[i].data.ready_for_invoicing);
  if (!canWrite || notReady.length === 0) return null;
  return (
    <MessageBar intent="warning" layout="multiline" style={{ marginBottom: 12 }}>
      <MessageBarBody>
        <MessageBarTitle>Legal entities need attention</MessageBarTitle>
        Complete PAN, GST and bank details before your first Invoice ({notReady.map((e) => e.name).join(", ")}).
      </MessageBarBody>
      <MessageBarActions>
        <AppLink href="/settings/legal-entities">Open legal entities</AppLink>
      </MessageBarActions>
    </MessageBar>
  );
}
