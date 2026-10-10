import type { Metadata } from "next";
import { WorkReferrals } from "@/features/referrals/refer-view";

export const metadata: Metadata = { title: "Refer a friend" };

export default function Page() {
  return <WorkReferrals />;
}
