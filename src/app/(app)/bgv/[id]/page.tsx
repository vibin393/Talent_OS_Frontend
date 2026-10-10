import type { Metadata } from "next";
import { BgvCaseDetail } from "@/features/bgv/case-detail";

export const metadata: Metadata = { title: "BGV case" };

export default async function Page({ params }: PageProps<"/bgv/[id]">) {
  const { id } = await params;
  return <BgvCaseDetail key={id} id={id} />;
}
