import type { Metadata } from "next";
import { Suspense } from "react";
import { ConnectionsPanel } from "@/features/calendar/connections-panel";
import { ReplyCaptureCard } from "@/features/comms/reply-capture-card";

export const metadata: Metadata = { title: "Calendar connections" };

export default function Page() {
  return (
    <Suspense>
      <ConnectionsPanel />
      <ReplyCaptureCard />
    </Suspense>
  );
}
