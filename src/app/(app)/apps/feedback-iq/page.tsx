import type { Metadata } from "next";
import { FeedbackIqDashboard } from "@/features/modules/feedbackiq/feedbackiq-dashboard";

export const metadata: Metadata = { title: "Feedback IQ" };

// Native Feedback IQ dashboard (native unification) — rendered in the Talent OS shell via the module
// gateway, not an iframe.
export default function Page() {
  return <FeedbackIqDashboard />;
}
