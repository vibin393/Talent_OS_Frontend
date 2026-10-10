import type { Metadata } from "next";
import { SourcingAgentSettings } from "@/features/agents/sourcing/sourcing-settings";

export const metadata: Metadata = { title: "Sourcing Agent" };

export default function Page() {
  return <SourcingAgentSettings />;
}
