"use client";

import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { offerKeys, offersApi } from "./api";

/** One offer with versions, history, approval requests and responses. */
export function useOffer(offerId: string | null) {
  const enabled = usePermission("offer:read");
  return useQuery({
    queryKey: offerKeys.offer(offerId ?? ""),
    queryFn: ({ signal }) => offersApi.get(offerId!, signal),
    enabled: enabled && !!offerId,
  });
}
