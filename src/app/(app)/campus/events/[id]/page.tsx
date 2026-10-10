import type { Metadata } from "next";
import { EventDetail } from "@/features/events/event-detail";

export const metadata: Metadata = { title: "Recruitment event" };

/** `/campus/events/[id]` (Epic 43). */
export default async function Page({ params }: PageProps<"/campus/events/[id]">) {
  const { id } = await params;
  return <EventDetail key={id} eventId={id} />;
}
