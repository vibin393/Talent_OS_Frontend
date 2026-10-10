import type { Metadata } from "next";
import { QueueBoard } from "@/features/events/queue-board";

export const metadata: Metadata = { title: "Queue board" };

/** `/campus/events/[id]/queue` (Epic 43): hall screen. */
export default async function Page({ params }: PageProps<"/campus/events/[id]/queue">) {
  const { id } = await params;
  return <QueueBoard key={id} eventId={id} />;
}
