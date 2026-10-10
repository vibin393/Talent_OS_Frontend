import type { Metadata } from "next";
import { RateCardTemplatesView } from "@/features/commercials/rate-cards/templates-view";

export const metadata: Metadata = { title: "Rate card templates" };

export default function RateCardTemplatesPage() {
  return <RateCardTemplatesView />;
}
