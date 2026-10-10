import type { Metadata } from "next";
import { CopilotUsagePage } from "@/features/ai-governance/copilot-usage-page";

export const metadata: Metadata = { title: "Copilot usage" };

export default function Page() {
  return <CopilotUsagePage />;
}
