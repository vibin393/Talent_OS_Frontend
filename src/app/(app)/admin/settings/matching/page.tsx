import type { Metadata } from "next";
import { MatchingSettings } from "@/features/matching/matching-settings";

export const metadata: Metadata = { title: "Matching weights" };

export default function Page() {
  return <MatchingSettings />;
}
