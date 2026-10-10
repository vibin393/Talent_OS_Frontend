"use client";

import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { type OfferListFilters, offerKeys, offersApi } from "./api";

export function useApplicationOffers(applicationId: string) {
  const enabled = usePermission("offer:read");
  return useQuery({
    queryKey: offerKeys.application(applicationId),
    queryFn: ({ signal }) => offersApi.forApplication(applicationId, signal),
    enabled,
  });
}

export function useDemandOffers(demandId: string) {
  const enabled = usePermission("offer:read");
  return useQuery({
    queryKey: offerKeys.demand(demandId),
    queryFn: ({ signal }) => offersApi.forDemand(demandId, signal),
    enabled,
  });
}

export function useOfferList(filters: OfferListFilters) {
  const enabled = usePermission("offer:read");
  return useQuery({
    queryKey: offerKeys.list(filters),
    queryFn: ({ signal }) => offersApi.list(filters, signal),
    enabled,
    placeholderData: (prev) => prev,
  });
}
