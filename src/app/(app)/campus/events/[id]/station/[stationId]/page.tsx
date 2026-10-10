import type { Metadata } from "next";
import { StationView } from "@/features/events/station-view";

export const metadata: Metadata = { title: "Interviewer station" };

/** `/campus/events/[id]/station/[stationId]` (Epic 43): interviewer station. */
export default async function Page({ params }: PageProps<"/campus/events/[id]/station/[stationId]">) {
  const { id, stationId } = await params;
  return <StationView key={`${id}-${stationId}`} eventId={id} stationId={stationId} />;
}
