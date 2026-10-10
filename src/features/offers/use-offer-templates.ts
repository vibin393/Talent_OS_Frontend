"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { offerKeys, offersApi } from "./api";
import type { OfferSettingsUpdate, OfferTemplateIn, OfferTemplateUpdate } from "./types";

export function useOfferTemplates(includeArchived = false) {
  const enabled = usePermission("offer:read");
  return useQuery({
    queryKey: [...offerKeys.templates, includeArchived],
    queryFn: ({ signal }) => offersApi.templates(includeArchived, signal),
    enabled,
    staleTime: 60_000,
  });
}

export function useMergeFields() {
  const enabled = usePermission("offer:read");
  return useQuery({ queryKey: offerKeys.mergeFields, queryFn: ({ signal }) => offersApi.mergeFields(signal), enabled, staleTime: 10 * 60_000 });
}

export function useSaveOfferTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: OfferTemplateIn | OfferTemplateUpdate }) =>
      id ? offersApi.updateTemplate(id, body) : offersApi.createTemplate(body as OfferTemplateIn),
    onSuccess: () => qc.invalidateQueries({ queryKey: offerKeys.templates }),
  });
}

export function useArchiveOfferTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => offersApi.archiveTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: offerKeys.templates }),
  });
}

export function useOfferSettings() {
  const enabled = usePermission("offer_template:manage");
  return useQuery({ queryKey: offerKeys.settings, queryFn: ({ signal }) => offersApi.settings(signal), enabled });
}

export function useSaveOfferSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OfferSettingsUpdate) => offersApi.updateSettings(body),
    onSuccess: (s) => qc.setQueryData(offerKeys.settings, s),
  });
}
