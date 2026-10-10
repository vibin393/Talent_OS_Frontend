"use client";

import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { OFFER_RELATED_ROOTS, offerKeys, offersApi } from "./api";
import type { OfferCreate, OfferDetailOut, OfferUpdate } from "./types";

/** Store the fresh offer and refresh lists plus the pipeline, demand and approvals views that show it. */
async function afterChange(qc: QueryClient, offer: OfferDetailOut): Promise<void> {
  qc.setQueryData(offerKeys.offer(offer.id), offer);
  await Promise.all([
    qc.invalidateQueries({ queryKey: offerKeys.all, predicate: (q) => q.queryKey[1] !== "detail" || q.queryKey[2] !== offer.id }),
    ...OFFER_RELATED_ROOTS.map((key) => qc.invalidateQueries({ queryKey: key })),
  ]);
}

export function useCreateOffer(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OfferCreate) => offersApi.create(applicationId, body),
    onSuccess: (offer) => afterChange(qc, offer),
  });
}

export function useUpdateOffer(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OfferUpdate) => offersApi.update(offerId, body),
    onSuccess: (offer) => afterChange(qc, offer),
  });
}

/** Submit for approval, release, or withdraw (with a reason). */
export function useOfferAction(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { action: "submit" } | { action: "release" } | { action: "withdraw"; reason: string }) =>
      a.action === "submit" ? offersApi.submit(offerId) : a.action === "release" ? offersApi.release(offerId) : offersApi.withdraw(offerId, a.reason),
    onSuccess: (offer) => afterChange(qc, offer),
  });
}
