import type { Metadata } from "next";
import { AgentsList } from "@/features/agents-settings/agents-list";

export const metadata: Metadata = { title: "AI agents" };

export default function Page() {
  return <AgentsList />;
}
