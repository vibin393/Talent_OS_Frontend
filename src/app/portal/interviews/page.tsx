import type { Metadata } from "next";
import { InterviewsView } from "@/features/portal/interviews-view";

export const metadata: Metadata = { title: "Interviews" };

export default function Page() {
  return <InterviewsView />;
}
