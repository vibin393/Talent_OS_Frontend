import type { Metadata } from "next";
import { RewardsView } from "@/features/referrals/rewards-view";

export const metadata: Metadata = { title: "Referral rewards" };

export default function Page() {
  return <RewardsView />;
}
