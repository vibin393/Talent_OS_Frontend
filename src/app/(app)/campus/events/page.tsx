import type { Metadata } from "next";
import { EventsList } from "@/features/events/events-list";

export const metadata: Metadata = { title: "Recruitment events" };

/** `/campus/events` (Epic 43). */
export default function Page() {
  return <EventsList />;
}
