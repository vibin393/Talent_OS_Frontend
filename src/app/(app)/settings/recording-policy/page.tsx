import type { Metadata } from "next";
import { RecordingPolicyPage } from "@/features/settings/recording-policy/recording-policy-page";

export const metadata: Metadata = { title: "Recording policy" };

export default function Page() {
  return <RecordingPolicyPage />;
}
