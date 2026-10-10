"use client";

import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import type { EmailTemplateKey } from "@/lib/api/types";
import { commsApi, commsKeys } from "./api";

/** Active email templates (optionally of one key). Needs `email_template:read`. */
export function useTemplates(key: EmailTemplateKey | null = null, includeArchived = false, enabled = true) {
  const canRead = usePermission("email_template:read");
  return useQuery({
    queryKey: commsKeys.templateList(key, includeArchived),
    queryFn: ({ signal }) => commsApi.listTemplates(key, includeArchived, signal),
    enabled: enabled && canRead,
    staleTime: 60_000,
  });
}

export function useTemplate(id: string | null) {
  return useQuery({
    queryKey: commsKeys.template(id ?? ""),
    queryFn: ({ signal }) => commsApi.getTemplate(id ?? "", signal),
    enabled: !!id,
  });
}

/** Merge-field catalog allowed for a template key (grouped). */
export function useMergeFields(key: EmailTemplateKey | null, enabled = true) {
  const canRead = usePermission("email_template:read");
  return useQuery({
    queryKey: commsKeys.mergeFields(key),
    queryFn: ({ signal }) => commsApi.mergeFields(key, signal),
    enabled: enabled && canRead,
    staleTime: 10 * 60_000,
  });
}
