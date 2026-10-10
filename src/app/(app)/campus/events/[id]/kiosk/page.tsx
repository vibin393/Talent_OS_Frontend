import type { Metadata } from "next";
import { Kiosk } from "@/features/events/kiosk";

export const metadata: Metadata = { title: "Check-in kiosk" };

/** `/campus/events/[id]/kiosk` (Epic 43): tablet check-in desk. */
export default async function Page({ params }: PageProps<"/campus/events/[id]/kiosk">) {
  const { id } = await params;
  return <Kiosk key={id} eventId={id} />;
}
