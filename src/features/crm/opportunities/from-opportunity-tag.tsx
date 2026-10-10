"use client";

import { Tag } from "@fluentui/react-components";
import { Trophy16Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { usePermission } from "@/features/auth/use-permission";
import { crmApi, crmKeys } from "../api";
import type { RecordKind } from "../types";

/** "From Opportunity OPP-…" back-link for a record created by a Won conversion. Renders nothing otherwise. */
export function FromOpportunityTag({ kind, recordId }: { kind: RecordKind; recordId: string }) {
  const router = useRouter();
  const canRead = usePermission("opportunity:read");
  const link = useQuery({
    queryKey: crmKeys.recordLink(kind, recordId),
    queryFn: ({ signal }) => crmApi.recordLink(kind, recordId, signal),
    enabled: canRead && !!recordId,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const data = link.data;
  if (!data) return null;
  return (
    <Tag
      size="small"
      appearance="brand"
      icon={<Trophy16Regular />}
      title={data.name}
      role="link"
      tabIndex={0}
      style={{ cursor: "pointer" }}
      onClick={() => router.push(`/opportunities/${data.opportunity_id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/opportunities/${data.opportunity_id}`);
      }}
    >
      From Opportunity {data.human_id}
    </Tag>
  );
}
