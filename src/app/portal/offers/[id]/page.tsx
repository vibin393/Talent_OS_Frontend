import type { Metadata } from "next";
import { OfferView } from "@/features/portal/offer-view";

export const metadata: Metadata = { title: "Offer" };

export default async function Page({ params }: PageProps<"/portal/offers/[id]">) {
  const { id } = await params;
  return <OfferView id={id} />;
}
