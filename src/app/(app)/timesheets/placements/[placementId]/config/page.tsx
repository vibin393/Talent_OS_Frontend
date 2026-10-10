import type { Metadata } from "next";
import { PlacementTimeConfigPage } from "@/features/timesheets/config-pages";

export const metadata: Metadata = { title: "Timesheet config" };

export default async function Page({ params }: PageProps<"/timesheets/placements/[placementId]/config">) {
  const { placementId } = await params;
  return <PlacementTimeConfigPage key={placementId} placementId={placementId} />;
}
