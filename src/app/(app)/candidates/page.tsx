import type { Metadata } from "next";
import { CandidatesView } from "@/features/candidates/candidates-view";
import { CopilotListContext } from "@/features/copilot/list-context";

export const metadata: Metadata = { title: "Candidates" };

export default function CandidatesPage() {
  return (
    <>
      <CopilotListContext kind="candidates" />
      <CandidatesView />
    </>
  );
}
