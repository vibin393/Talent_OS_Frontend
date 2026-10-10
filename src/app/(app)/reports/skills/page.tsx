import type { Metadata } from "next";
import { SkillInsightsView } from "@/features/skills/insights-view";

export const metadata: Metadata = { title: "Skills supply and demand" };

export default function Page() {
  return <SkillInsightsView />;
}
