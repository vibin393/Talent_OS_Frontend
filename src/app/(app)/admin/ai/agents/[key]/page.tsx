import type { Metadata } from "next";
import { AgentDetail } from "@/features/agents-settings/agent-detail";

export const metadata: Metadata = { title: "Agent settings" };

export default async function Page({ params }: PageProps<"/admin/ai/agents/[key]">) {
  const { key } = await params;
  return <AgentDetail key={key} agentKey={key} />;
}
