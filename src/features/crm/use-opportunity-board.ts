"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { type OpportunityFilters, crmApi, crmKeys } from "./api";
import type {
  OpportunityCreate,
  OpportunityLineIn,
  OpportunityTransitionIn,
  OpportunityUpdate,
  SummaryGroupBy,
} from "./types";
import { invalidateCrm } from "./use-leads";

export { moveCard } from "./opportunities/board-rules";

export const OPPORTUNITY_PAGE_SIZE = 25;

export function useOpportunityBoard(filters: OpportunityFilters, enabled = true) {
  const canRead = usePermission("opportunity:read");
  return useQuery({
    queryKey: crmKeys.boardFor(filters),
    queryFn: ({ signal }) => crmApi.board(filters, signal),
    enabled: canRead && enabled,
    placeholderData: (prev) => prev,
  });
}

export function useOpportunityList(filters: OpportunityFilters, page: number, enabled = true) {
  const canRead = usePermission("opportunity:read");
  return useQuery({
    queryKey: crmKeys.opportunityList(filters, page),
    queryFn: ({ signal }) => crmApi.opportunities(filters, page, OPPORTUNITY_PAGE_SIZE, signal),
    enabled: canRead && enabled,
    placeholderData: (prev) => prev,
  });
}

export function useOpportunitySummary(groupBy: SummaryGroupBy | null, filters: OpportunityFilters) {
  return useQuery({
    queryKey: crmKeys.opportunitySummary(groupBy ?? "stage", filters),
    queryFn: ({ signal }) => crmApi.summary(groupBy ?? "stage", filters, signal),
    enabled: groupBy !== null,
  });
}

export function useOpportunity(id: string) {
  const canRead = usePermission("opportunity:read");
  return useQuery({
    queryKey: crmKeys.opportunity(id),
    queryFn: ({ signal }) => crmApi.opportunity(id, signal),
    enabled: canRead,
  });
}

export function useOpportunityHistory(id: string) {
  return useQuery({ queryKey: crmKeys.opportunityHistory(id), queryFn: ({ signal }) => crmApi.opportunityHistory(id, signal) });
}

export function useOpportunityMutations() {
  const qc = useQueryClient();
  const done = () => invalidateCrm(qc);
  return {
    create: useMutation({ mutationFn: (body: OpportunityCreate) => crmApi.createOpportunity(body), onSuccess: done }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: OpportunityUpdate }) => crmApi.updateOpportunity(id, body),
      onSuccess: done,
    }),
    lines: useMutation({
      mutationFn: ({ id, lines }: { id: string; lines: OpportunityLineIn[] }) => crmApi.replaceLines(id, lines),
      onSuccess: done,
    }),
    transition: useMutation({
      mutationFn: ({ id, body }: { id: string; body: OpportunityTransitionIn }) => crmApi.transitionOpportunity(id, body),
      onSettled: done,
    }),
    resetProbability: useMutation({ mutationFn: (id: string) => crmApi.resetProbability(id), onSuccess: done }),
  };
}
