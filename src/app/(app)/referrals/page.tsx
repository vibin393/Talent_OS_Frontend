import type { Metadata } from "next";
import { ReferralsList } from "@/features/referrals/referrals-list";

export const metadata: Metadata = { title: "Referrals" };

export default function Page() {
  return <ReferralsList />;
}
