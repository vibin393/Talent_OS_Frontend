import type { Metadata } from "next";
import { RateCardEditor } from "@/features/commercials/rate-cards/rate-card-editor";

export const metadata: Metadata = { title: "Rate card" };

export default async function RateCardPage({ params }: PageProps<"/clients/[id]/rate-cards/[cardId]">) {
  const { id, cardId } = await params;
  return <RateCardEditor key={cardId} cardId={cardId} clientId={id} />;
}
