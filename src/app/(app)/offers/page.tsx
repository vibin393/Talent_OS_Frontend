import type { Metadata } from "next";
import { Suspense } from "react";
import { OffersList } from "@/features/offers/offers-list";

export const metadata: Metadata = { title: "Offers" };

export default function Page() {
  return (
    <Suspense>
      <OffersList />
    </Suspense>
  );
}
