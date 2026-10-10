import type { Metadata } from "next";
import { ProgramsAdmin } from "@/features/referrals/programs-admin";

export const metadata: Metadata = { title: "Referral programs" };

export default function Page() {
  return <ProgramsAdmin />;
}
