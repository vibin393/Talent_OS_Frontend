import type { Metadata } from "next";
import { DemandDetail } from "@/features/demands/demand-detail";
import { parseDemandTab } from "@/features/demands/query";

export const metadata: Metadata = { title: "Demand" };

export default async function Page({ params, searchParams }: PageProps<"/demands/[id]">) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <DemandDetail key={id} demandId={id} initialTab={parseDemandTab(tab)} />;
}
