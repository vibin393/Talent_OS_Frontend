import type { Metadata } from "next";
import { AgentSettingsPage } from "@/features/agents/demand/agent-settings-page";

export const metadata: Metadata = { title: "Demand Agent" };

export default function Page() {
  return <AgentSettingsPage />;
}
