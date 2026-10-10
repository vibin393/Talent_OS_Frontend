import type { Metadata } from "next";
import { PortalScheduling } from "@/features/agents/scheduling/portal-scheduling";

export const metadata: Metadata = { title: "Pick a time" };

export default function Page() {
  return <PortalScheduling />;
}
