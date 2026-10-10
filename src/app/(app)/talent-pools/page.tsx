import type { Metadata } from "next";
import { PoolsView } from "@/features/talent-pools/pools-view";

export const metadata: Metadata = { title: "Talent Pools" };

/** `/talent-pools` (Epic 38). */
export default function TalentPoolsPage() {
  return <PoolsView />;
}
