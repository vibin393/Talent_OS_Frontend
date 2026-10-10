import type { Metadata } from "next";
import { WorkOpportunityApplications } from "@/features/mobility/board/my-applications";

export const metadata: Metadata = { title: "My internal applications" };

export default function Page() {
  return <WorkOpportunityApplications />;
}
