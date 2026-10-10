import type { Metadata } from "next";
import { PlacementsView } from "@/features/placements/placements-view";
import { CopilotListContext } from "@/features/copilot/list-context";

export const metadata: Metadata = { title: "Placements" };

export default function PlacementsPage() {
  return (
    <>
      <CopilotListContext kind="placements" />
      <PlacementsView />
    </>
  );
}
