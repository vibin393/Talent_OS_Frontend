import type { Metadata } from "next";
import { PlanDetail } from "@/features/workforce/plan-detail";

export const metadata: Metadata = { title: "Workforce plan" };

/** `/workforce/[id]` (Epic 44): lines, import, slots, plan vs actual and revisions. */
export default async function WorkforcePlanPage({ params }: PageProps<"/workforce/[id]">) {
  const { id } = await params;
  return <PlanDetail key={id} planId={id} />;
}
