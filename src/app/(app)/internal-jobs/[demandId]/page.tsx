import type { Metadata } from "next";
import { InternalJobDetail } from "@/features/mobility/board/opening-detail";

export const metadata: Metadata = { title: "Internal opening" };

export default async function Page({ params }: PageProps<"/internal-jobs/[demandId]">) {
  const { demandId } = await params;
  return <InternalJobDetail key={demandId} demandId={demandId} />;
}
