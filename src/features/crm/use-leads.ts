"use client";

import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { activityKeys } from "@/features/activity/api";
import { usePermission } from "@/features/auth/use-permission";
import { type LeadFilters, crmApi, crmKeys } from "./api";
import type { LeadConvertIn, LeadCreate, LeadTransitionIn, LeadUpdate, ReasonKind } from "./types";

export const LEAD_PAGE_SIZE = 25;

/** Invalidate every CRM-derived cache: board, opportunity, lead and Client 360 keys. */
export function invalidateCrm(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: crmKeys.leads }),
    qc.invalidateQueries({ queryKey: crmKeys.opportunities }),
    qc.invalidateQueries({ queryKey: crmKeys.board }),
    qc.invalidateQueries({ queryKey: crmKeys.client360 }),
    qc.invalidateQueries({ queryKey: ["clients"] }),
    qc.invalidateQueries({ queryKey: ["crm", "dashboard"] }),
    qc.invalidateQueries({ queryKey: activityKeys.all }),
  ]);
}

export function useLeads(filters: LeadFilters, page: number) {
  const canRead = usePermission("lead:read");
  return useQuery({
    queryKey: crmKeys.leadList(filters, page),
    queryFn: ({ signal }) => crmApi.leads(filters, page, LEAD_PAGE_SIZE, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
}

export function useLead(id: string) {
  const canRead = usePermission("lead:read");
  return useQuery({ queryKey: crmKeys.lead(id), queryFn: ({ signal }) => crmApi.lead(id, signal), enabled: canRead });
}

export function useLeadHistory(id: string) {
  return useQuery({ queryKey: crmKeys.leadHistory(id), queryFn: ({ signal }) => crmApi.leadHistory(id, signal) });
}

export function useReasonCodes(kind?: ReasonKind) {
  return useQuery({
    queryKey: crmKeys.reasonCodes(kind),
    queryFn: ({ signal }) => crmApi.reasonCodes(kind, signal),
    staleTime: 60_000,
  });
}

export function useLeadSources() {
  return useQuery({ queryKey: crmKeys.leadSources, queryFn: ({ signal }) => crmApi.leadSources(signal), staleTime: 60_000 });
}

export function useCrmSettings() {
  return useQuery({ queryKey: crmKeys.settings, queryFn: ({ signal }) => crmApi.settings(signal), staleTime: 60_000 });
}

export function useLeadMutations() {
  const qc = useQueryClient();
  const done = () => invalidateCrm(qc);
  return {
    create: useMutation({ mutationFn: (body: LeadCreate) => crmApi.createLead(body), onSuccess: done }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: LeadUpdate }) => crmApi.updateLead(id, body),
      onSuccess: done,
    }),
    transition: useMutation({
      mutationFn: ({ id, body }: { id: string; body: LeadTransitionIn }) => crmApi.transitionLead(id, body),
      onSuccess: done,
    }),
    archive: useMutation({ mutationFn: (id: string) => crmApi.archiveLead(id), onSuccess: done }),
    convert: useMutation({
      mutationFn: ({ id, body }: { id: string; body: LeadConvertIn }) => crmApi.convertLead(id, body),
      onSuccess: done,
    }),
  };
}
