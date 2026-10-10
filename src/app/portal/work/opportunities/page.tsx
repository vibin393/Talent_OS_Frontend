import type { Metadata } from "next";
import { WorkOpportunitiesBoard } from "@/features/mobility/board/board-view";

export const metadata: Metadata = { title: "Opportunities" };

export default function Page() {
  return <WorkOpportunitiesBoard />;
}
