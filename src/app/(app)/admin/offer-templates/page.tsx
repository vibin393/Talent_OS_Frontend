import type { Metadata } from "next";
import { OfferTemplatesAdmin } from "@/features/offers/offer-templates-admin";

export const metadata: Metadata = { title: "Offer letters" };

export default function Page() {
  return <OfferTemplatesAdmin />;
}
