import type { Metadata } from "next";
import { PlacementDetail } from "@/features/placements/placement-detail";

export const metadata: Metadata = { title: "Placement" };

export default async function PlacementPage({ params }: PageProps<"/placements/[id]">) {
  const { id } = await params;
  return <PlacementDetail key={id} id={id} />;
}
