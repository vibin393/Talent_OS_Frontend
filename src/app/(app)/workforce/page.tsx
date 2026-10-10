import type { Metadata } from "next";
import { PlansView } from "@/features/workforce/plans-view";

export const metadata: Metadata = { title: "Workforce planning" };

/** `/workforce` (Epic 44): workforce plans. */
export default function WorkforcePage() {
  return <PlansView />;
}
