import type { Metadata } from "next";
import { PoolDetail } from "@/features/talent-pools/pool-detail";

export const metadata: Metadata = { title: "Talent Pool" };

/** `/talent-pools/[id]` (Epic 38). */
export default async function TalentPoolPage({ params }: PageProps<"/talent-pools/[id]">) {
  const { id } = await params;
  return <PoolDetail key={id} poolId={id} />;
}
